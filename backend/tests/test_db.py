from painel import config, db


def test_init_schema_creates_tables(tmp_path):
    conn = db.connect(tmp_path / "sub" / "t.db")
    db.init_schema(conn)
    db.init_schema(conn)  # idempotente
    names = {r["name"] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    assert {"teams", "games", "standings", "favorites", "sync_log"} <= names


def test_league_lookup():
    assert config.league("UCL").path == "soccer/uefa.champions"
    assert config.league("NBA").sport == "basketball"
    assert len(config.LEAGUES) == 7
