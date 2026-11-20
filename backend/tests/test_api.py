from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from conftest import load_fixture
from painel import api, config, db, repo
from painel.espn.parse import parse_scoreboard, parse_standings

NOW = datetime(2026, 11, 8, 20, 0, tzinfo=timezone.utc)


@pytest.fixture
def setup(tmp_path):
    path = tmp_path / "t.db"
    conn = db.connect(path)
    db.init_schema(conn)
    games = parse_scoreboard(config.league("PL"), load_fixture("sb_PL_20261108.json"))
    repo.upsert_games(conn, games, NOW)
    repo.set_standings(conn, "PL", parse_standings(load_fixture("standings_PL.json")), NOW)
    for lg in config.LEAGUES:
        repo.log_sync(conn, lg.key, "scoreboard", True, None, NOW)
    now = {"t": NOW + timedelta(minutes=1)}
    app = api.create_app(lambda: db.connect(path), static_dir=None, clock=lambda: now["t"])
    return TestClient(app), conn, games, now


def test_leagues(setup):
    client, *_ = setup
    r = client.get("/api/leagues")
    assert [x["key"] for x in r.json()] == ["NFL", "NBA", "BRA", "CDB", "LIB", "SUL", "PL", "UCL", "ESP", "ITA", "ALE"]


def test_games_endpoint_shape(setup):
    client, *_ = setup
    r = client.get("/api/games", params={"date": "2026-11-08"})
    assert r.status_code == 200
    body = r.json()
    assert body["date"] == "2026-11-08"
    assert len(body["games"]) == 5
    g = body["games"][0]
    assert g["start_utc"].endswith("Z")
    assert isinstance(g["home"]["rank"], int)
    assert g["home"]["favorite"] is False
    assert body["stale"] is False and body["errors"] == []
    assert body["updated_at"] == "2026-11-08T20:00:00Z"


def test_games_endpoint_reports_stale(setup):
    client, conn, _, now = setup
    repo.log_sync(conn, "PL", "scoreboard", False, "ESPN respondeu 503", NOW + timedelta(seconds=30))
    body = client.get("/api/games", params={"date": "2026-11-08"}).json()
    assert body["stale"] is True
    assert body["errors"][0]["league"] == "PL"
    assert body["errors"][0]["message"] == "ESPN respondeu 503"


def test_games_endpoint_stale_when_old(setup):
    client, _, _, now = setup
    now["t"] = NOW + timedelta(minutes=16)
    assert client.get("/api/games", params={"date": "2026-11-08"}).json()["stale"] is True


def test_favorites_roundtrip(setup):
    client, _, games, _ = setup
    tid = games[0].home.team_id
    assert client.put(f"/api/favorites/soccer/{tid}").status_code == 204
    assert [f["team_id"] for f in client.get("/api/favorites").json()] == [tid]
    body = client.get("/api/games", params={"date": "2026-11-08"}).json()
    assert any(g["home"]["favorite"] for g in body["games"] if g["home"]["team_id"] == tid)
    assert client.delete(f"/api/favorites/soccer/{tid}").status_code == 204
    assert client.get("/api/favorites").json() == []


def test_favorite_invalid_sport_422(setup):
    client, *_ = setup
    assert client.put("/api/favorites/hockey/1").status_code == 422


def test_invalid_date_422(setup):
    client, *_ = setup
    assert client.get("/api/games", params={"date": "19-11-2026"}).status_code == 422


def test_status(setup):
    client, *_ = setup
    assert len(client.get("/api/status").json()) == 11
