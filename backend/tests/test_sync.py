from datetime import date, datetime, timezone

import pytest

from conftest import load_fixture, with_status
from painel import config, db, repo
from painel.espn.client import EspnError
from painel.sync import Syncer, espn_dates_for_local_day, next_live_interval

NOW = datetime(2026, 11, 19, 15, 0, tzinfo=timezone.utc)


class FakeClient:
    def __init__(self):
        self.calls: list[tuple[str, date | None]] = []
        self.failing: set[str] = set()
        self.payloads = {
            "PL": load_fixture("sb_PL_20261108.json"),
            "NBA": load_fixture("sb_NBA_20261117.json"),
        }

    def scoreboard(self, league, day):
        self.calls.append((league.key, day))
        if league.key in self.failing:
            raise EspnError("503")
        return self.payloads.get(league.key, {"events": []})

    def standings(self, league):
        self.calls.append((league.key, None))
        return load_fixture("standings_PL.json") if league.key == "PL" else {}


@pytest.fixture
def env(tmp_path):
    conn = db.connect(tmp_path / "t.db")
    db.init_schema(conn)
    client = FakeClient()
    leagues = [config.league("PL"), config.league("NBA")]
    return conn, client, Syncer(conn, client, leagues, clock=lambda: NOW)


def test_espn_dates_for_local_day():
    assert espn_dates_for_local_day(date(2026, 11, 19)) == [date(2026, 11, 18), date(2026, 11, 19)]


def test_sync_local_days_dedupes_dates(env):
    conn, client, s = env
    s.sync_local_days([date(2026, 11, 19), date(2026, 11, 20)])
    pl_days = sorted(d for k, d in client.calls if k == "PL")
    assert pl_days == [date(2026, 11, 18), date(2026, 11, 19), date(2026, 11, 20)]


def test_sync_stores_games_and_logs_ok(env):
    conn, client, s = env
    s.sync_local_days([date(2026, 11, 19)])
    n = conn.execute("SELECT COUNT(*) c FROM games").fetchone()["c"]
    assert n == 10  # 5 PL + 5 NBA (mesmo payload para as duas datas, sem duplicar)
    health = {h["league"]: h for h in repo.sync_health(conn)}
    assert health["PL"]["last_ok"] and not health["PL"]["failing"]


def test_sync_records_error_and_keeps_games(env):
    conn, client, s = env
    s.sync_local_days([date(2026, 11, 19)])
    client.failing.add("PL")
    s.clock = lambda: datetime(2026, 11, 19, 15, 10, tzinfo=timezone.utc)
    s.sync_local_days([date(2026, 11, 19)])
    assert conn.execute("SELECT COUNT(*) c FROM games WHERE league='PL'").fetchone()["c"] == 5
    health = {h["league"]: h for h in repo.sync_health(conn)}
    assert health["PL"]["failing"] is True
    assert health["NBA"]["failing"] is False


def test_sync_live_only_live_leagues(env):
    conn, client, s = env
    client.payloads["PL"] = with_status(client.payloads["PL"], "in", "STATUS_FIRST_HALF", "30'")
    client.payloads["PL"]["events"][0]["date"] = "2026-11-19T14:30Z"  # começou há 30 min
    s.sync_local_days([date(2026, 11, 19)])
    client.calls.clear()
    s.sync_live()
    assert {k for k, _ in client.calls} == {"PL"}


def test_sync_standings_only_soccer(env):
    conn, client, s = env
    s.sync_standings()
    assert [k for k, _ in client.calls] == ["PL"]
    assert conn.execute("SELECT COUNT(*) c FROM standings WHERE league='PL'").fetchone()["c"] == 20


def test_next_live_interval():
    assert next_live_interval(True) == 30
    assert next_live_interval(False) == 600


def test_malformed_payload_logs_error_and_continues(env):
    conn, client, s = env
    client.payloads["PL"] = {"events": [{"id": "x", "competitions": [{}], "status": {"type": {"state": "pre"}}}]}
    s.sync_local_days([date(2026, 11, 19)])
    health = {h["league"]: h for h in repo.sync_health(conn)}
    assert health["PL"]["failing"] is True
    assert health["NBA"]["failing"] is False
    assert conn.execute("SELECT COUNT(*) c FROM games WHERE league='NBA'").fetchone()["c"] == 5
