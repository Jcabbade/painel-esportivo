import sqlite3
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS teams (
    sport TEXT NOT NULL,
    team_id TEXT NOT NULL,
    name TEXT NOT NULL,
    short_name TEXT,
    abbrev TEXT,
    logo TEXT,
    PRIMARY KEY (sport, team_id)
);
CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    league TEXT NOT NULL,
    sport TEXT NOT NULL,
    start_utc TEXT NOT NULL,
    status TEXT NOT NULL,
    status_detail TEXT,
    home_team_id TEXT NOT NULL,
    away_team_id TEXT NOT NULL,
    home_score INTEGER,
    away_score INTEGER,
    home_record TEXT,
    away_record TEXT,
    venue TEXT,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_games_start ON games(start_utc);
CREATE TABLE IF NOT EXISTS standings (
    league TEXT NOT NULL,
    team_id TEXT NOT NULL,
    rank INTEGER NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (league, team_id)
);
CREATE TABLE IF NOT EXISTS favorites (
    sport TEXT NOT NULL,
    team_id TEXT NOT NULL,
    PRIMARY KEY (sport, team_id)
);
CREATE TABLE IF NOT EXISTS sync_log (
    league TEXT NOT NULL,
    kind TEXT NOT NULL,
    ok INTEGER NOT NULL,
    message TEXT,
    at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_sync_log ON sync_log(league, ok, at);
"""


def connect(path: Path | str) -> sqlite3.Connection:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def init_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA)
    conn.commit()
