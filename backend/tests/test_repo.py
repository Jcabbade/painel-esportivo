from datetime import date, datetime, timedelta, timezone

import pytest

from painel import db, repo
from painel.models import Game, TeamSide

NOW = datetime(2026, 11, 19, 12, 0, tzinfo=timezone.utc)


def side(tid, score=None):
    return TeamSide(tid, f"Time {tid}", f"T{tid}", f"T{tid}", None, score, None)


def game(gid, start, league="PL", sport="soccer", home="1", away="2", status="final", hs=1, as_=0):
    return Game(gid, league, sport, start, status, "FT", side(home, hs), side(away, as_), "Estádio")


@pytest.fixture
def conn(tmp_path):
    c = db.connect(tmp_path / "t.db")
    db.init_schema(c)
    return c


def test_upsert_is_idempotent_and_updates_score(conn):
    g = game("10", NOW)
    repo.upsert_games(conn, [g], NOW)
    g.home.score = 3
    repo.upsert_games(conn, [g], NOW)
    rows = conn.execute("SELECT home_score FROM games").fetchall()
    assert [r["home_score"] for r in rows] == [3]


def test_games_for_local_day_uses_sao_paulo_midnight(conn):
    late = game("a", datetime(2026, 11, 20, 2, 30, tzinfo=timezone.utc))  # 23:30 de 19/11 em Brasília
    next_day = game("b", datetime(2026, 11, 20, 3, 30, tzinfo=timezone.utc))  # 00:30 de 20/11
    repo.upsert_games(conn, [late, next_day], NOW)
    assert [g["id"] for g in repo.games_for_local_day(conn, date(2026, 11, 19))] == ["a"]
    assert [g["id"] for g in repo.games_for_local_day(conn, date(2026, 11, 20))] == ["b"]


def test_output_shape_and_order(conn):
    repo.upsert_games(conn, [game("y", datetime(2026, 11, 19, 20, 0, tzinfo=timezone.utc)),
                             game("x", datetime(2026, 11, 19, 15, 0, tzinfo=timezone.utc))], NOW)
    out = repo.games_for_local_day(conn, date(2026, 11, 19))
    assert [g["id"] for g in out] == ["x", "y"]
    g = out[0]
    assert g["start_utc"] == "2026-11-19T15:00:00Z"
    assert g["home"]["name"] == "Time 1" and g["home"]["score"] == 1
    assert g["venue"] == "Estádio"


def test_rank_and_favorite_in_output(conn):
    repo.upsert_games(conn, [game("1", NOW)], NOW)
    repo.set_standings(conn, "PL", {"1": 3}, NOW)
    repo.add_favorite(conn, "soccer", "1")
    (g,) = repo.games_for_local_day(conn, date(2026, 11, 19))
    assert g["home"]["rank"] == 3 and g["home"]["favorite"] is True
    assert g["away"]["rank"] is None and g["away"]["favorite"] is False


def test_favorites_keyed_by_sport(conn):
    repo.upsert_games(conn, [game("1", NOW), game("2", NOW, league="NBA", sport="basketball")], NOW)
    repo.add_favorite(conn, "basketball", "1")
    by_id = {g["id"]: g for g in repo.games_for_local_day(conn, date(2026, 11, 19))}
    assert by_id["2"]["home"]["favorite"] is True
    assert by_id["1"]["home"]["favorite"] is False
    assert [f["sport"] for f in repo.list_favorites(conn)] == ["basketball"]
    repo.remove_favorite(conn, "basketball", "1")
    assert repo.list_favorites(conn) == []


def test_sync_health_failing(conn):
    t = lambda h, m: datetime(2026, 11, 19, h, m, tzinfo=timezone.utc)
    repo.log_sync(conn, "PL", "scoreboard", True, None, t(10, 0))
    repo.log_sync(conn, "PL", "scoreboard", False, "503", t(10, 5))
    (h,) = [x for x in repo.sync_health(conn) if x["league"] == "PL"]
    assert h["failing"] is True and h["last_error"] == "503"
    assert h["last_ok"] == "2026-11-19T10:00:00Z"
    repo.log_sync(conn, "PL", "scoreboard", True, None, t(10, 10))
    (h,) = [x for x in repo.sync_health(conn) if x["league"] == "PL"]
    assert h["failing"] is False


def test_sync_health_lists_all_leagues(conn):
    keys = [h["league"] for h in repo.sync_health(conn)]
    assert keys == ["NFL", "NBA", "PL", "UCL", "ESP", "ITA", "ALE"]


def test_has_live_games(conn):
    repo.upsert_games(conn, [game("1", NOW)], NOW)
    assert repo.has_live_games(conn, NOW) is False
    repo.upsert_games(conn, [game("2", NOW, status="live")], NOW)
    assert repo.has_live_games(conn, NOW) is True
    assert repo.live_leagues(conn, NOW) == {"PL"}


def test_live_leagues_ignores_old_live(conn):
    old = game("old", NOW - timedelta(hours=7), league="NBA", sport="basketball", status="live")
    repo.upsert_games(conn, [old], NOW)
    assert repo.live_leagues(conn, NOW) == set()
    assert repo.has_live_games(conn, NOW) is False


def test_live_leagues_includes_started_scheduled(conn):
    started = game("s", NOW - timedelta(minutes=2), status="scheduled")
    later = game("l", NOW + timedelta(hours=1), league="NBA", sport="basketball", status="scheduled")
    repo.upsert_games(conn, [started, later], NOW)
    assert repo.live_leagues(conn, NOW) == {"PL"}


def test_sync_health_ignores_standings(conn):
    t = lambda h, m: datetime(2026, 11, 19, h, m, tzinfo=timezone.utc)
    repo.log_sync(conn, "PL", "scoreboard", True, None, t(10, 0))
    repo.log_sync(conn, "PL", "scoreboard", False, "503", t(10, 5))
    repo.log_sync(conn, "PL", "standings", True, None, t(10, 6))
    repo.log_sync(conn, "UCL", "scoreboard", True, None, t(10, 0))
    repo.log_sync(conn, "UCL", "standings", False, "formato", t(10, 6))
    h = {x["league"]: x for x in repo.sync_health(conn)}
    assert h["PL"]["failing"] is True and h["PL"]["last_ok"] == "2026-11-19T10:00:00Z"
    assert h["UCL"]["failing"] is False
