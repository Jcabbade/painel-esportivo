import sqlite3
from datetime import date, datetime, time, timedelta, timezone

from painel import config
from painel.models import Game


def iso(dt: datetime) -> str:
    """UTC em ISO 8601 com 'Z' — formato único no banco, comparável como texto."""
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def upsert_games(conn: sqlite3.Connection, games: list[Game], now: datetime) -> None:
    for g in games:
        for s in (g.home, g.away):
            conn.execute(
                """INSERT INTO teams(sport, team_id, name, short_name, abbrev, logo) VALUES (?,?,?,?,?,?)
                   ON CONFLICT(sport, team_id) DO UPDATE SET name=excluded.name, short_name=excluded.short_name,
                   abbrev=excluded.abbrev, logo=COALESCE(excluded.logo, teams.logo)""",
                (g.sport, s.team_id, s.name, s.short_name, s.abbrev, s.logo),
            )
        conn.execute(
            """INSERT INTO games(id, league, sport, start_utc, status, status_detail, home_team_id, away_team_id,
                   home_score, away_score, home_record, away_record, venue, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
               ON CONFLICT(id) DO UPDATE SET league=excluded.league, sport=excluded.sport,
                   start_utc=excluded.start_utc, status=excluded.status, status_detail=excluded.status_detail,
                   home_team_id=excluded.home_team_id, away_team_id=excluded.away_team_id,
                   home_score=excluded.home_score, away_score=excluded.away_score,
                   home_record=excluded.home_record, away_record=excluded.away_record,
                   venue=excluded.venue, updated_at=excluded.updated_at""",
            (g.id, g.league, g.sport, iso(g.start_utc), g.status, g.status_detail, g.home.team_id, g.away.team_id,
             g.home.score, g.away.score, g.home.record, g.away.record, g.venue, iso(now)),
        )
    conn.commit()


_GAMES_SQL = """
SELECT g.*,
  th.name h_name, th.short_name h_short, th.abbrev h_abbrev, th.logo h_logo,
  ta.name a_name, ta.short_name a_short, ta.abbrev a_abbrev, ta.logo a_logo,
  sh.rank h_rank, sa.rank a_rank,
  fh.team_id IS NOT NULL h_fav, fa.team_id IS NOT NULL a_fav
FROM games g
JOIN teams th ON th.sport = g.sport AND th.team_id = g.home_team_id
JOIN teams ta ON ta.sport = g.sport AND ta.team_id = g.away_team_id
LEFT JOIN standings sh ON sh.league = g.league AND sh.team_id = g.home_team_id
LEFT JOIN standings sa ON sa.league = g.league AND sa.team_id = g.away_team_id
LEFT JOIN favorites fh ON fh.sport = g.sport AND fh.team_id = g.home_team_id
LEFT JOIN favorites fa ON fa.sport = g.sport AND fa.team_id = g.away_team_id
WHERE g.start_utc >= ? AND g.start_utc < ?
ORDER BY g.start_utc, g.league, g.id
"""


def _side(r: sqlite3.Row, p: str, which: str) -> dict:
    return {
        "team_id": r[f"{which}_team_id"],
        "name": r[f"{p}_name"],
        "short_name": r[f"{p}_short"],
        "abbrev": r[f"{p}_abbrev"],
        "logo": r[f"{p}_logo"],
        "score": r[f"{which}_score"],
        "record": r[f"{which}_record"],
        "rank": r[f"{p}_rank"],
        "favorite": bool(r[f"{p}_fav"]),
    }


def games_for_local_day(conn: sqlite3.Connection, day: date) -> list[dict]:
    start = datetime.combine(day, time(0), tzinfo=config.TZ)
    end = datetime.combine(day + timedelta(days=1), time(0), tzinfo=config.TZ)
    rows = conn.execute(_GAMES_SQL, (iso(start), iso(end))).fetchall()
    return [
        {
            "id": r["id"],
            "league": r["league"],
            "sport": r["sport"],
            "start_utc": r["start_utc"],
            "status": r["status"],
            "status_detail": r["status_detail"],
            "venue": r["venue"],
            "home": _side(r, "h", "home"),
            "away": _side(r, "a", "away"),
        }
        for r in rows
    ]


def set_standings(conn: sqlite3.Connection, league: str, ranks: dict[str, int], now: datetime) -> None:
    conn.execute("DELETE FROM standings WHERE league = ?", (league,))
    conn.executemany(
        "INSERT INTO standings(league, team_id, rank, updated_at) VALUES (?,?,?,?)",
        [(league, tid, rank, iso(now)) for tid, rank in ranks.items()],
    )
    conn.commit()


def add_favorite(conn: sqlite3.Connection, sport: str, team_id: str) -> None:
    conn.execute("INSERT OR IGNORE INTO favorites(sport, team_id) VALUES (?,?)", (sport, team_id))
    conn.commit()


def remove_favorite(conn: sqlite3.Connection, sport: str, team_id: str) -> None:
    conn.execute("DELETE FROM favorites WHERE sport = ? AND team_id = ?", (sport, team_id))
    conn.commit()


def list_favorites(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute(
        """SELECT f.sport, f.team_id, t.name, t.logo FROM favorites f
           LEFT JOIN teams t ON t.sport = f.sport AND t.team_id = f.team_id ORDER BY t.name"""
    ).fetchall()
    return [dict(r) for r in rows]


def log_sync(conn: sqlite3.Connection, league: str, kind: str, ok: bool, message: str | None, now: datetime) -> None:
    conn.execute(
        "INSERT INTO sync_log(league, kind, ok, message, at) VALUES (?,?,?,?,?)",
        (league, kind, int(ok), message, iso(now)),
    )
    conn.commit()


def sync_health(conn: sqlite3.Connection) -> list[dict]:
    out = []
    for lg in config.LEAGUES:
        ok = conn.execute("SELECT MAX(at) at FROM sync_log WHERE league=? AND kind='scoreboard' AND ok=1", (lg.key,)).fetchone()["at"]
        err = conn.execute(
            "SELECT message, at FROM sync_log WHERE league=? AND kind='scoreboard' AND ok=0 ORDER BY at DESC LIMIT 1", (lg.key,)
        ).fetchone()
        err_at = err["at"] if err else None
        out.append({
            "league": lg.key,
            "last_ok": ok,
            "last_error": err["message"] if err else None,
            "last_error_at": err_at,
            "failing": err_at is not None and (ok is None or err_at > ok),
        })
    return out


LIVE_MAX_AGE = timedelta(hours=6)


def live_leagues(conn: sqlite3.Connection, now: datetime) -> set[str]:
    """Ligas com jogo em andamento: 'live' ou 'scheduled' que já passou do horário, iniciados há menos de 6 h.

    O limite de 6 h evita que um jogo que nunca mais foi atualizado (PC desligado, evento removido pela ESPN)
    deixe o laço ao vivo consultando a ESPN para sempre.
    """
    rows = conn.execute(
        """SELECT DISTINCT league FROM games
           WHERE status IN ('live', 'scheduled') AND start_utc <= ? AND start_utc > ?""",
        (iso(now), iso(now - LIVE_MAX_AGE)),
    )
    return {r["league"] for r in rows}


def has_live_games(conn: sqlite3.Connection, now: datetime) -> bool:
    return bool(live_leagues(conn, now))
