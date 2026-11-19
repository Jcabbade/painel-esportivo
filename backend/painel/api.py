import sqlite3
from collections.abc import Callable
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import FileResponse

from painel import config, repo

STALE_AFTER = timedelta(minutes=15)
SportParam = Literal["soccer", "basketball", "football"]


def create_app(conn_factory: Callable[[], sqlite3.Connection], static_dir: Path | None,
               clock: Callable[[], datetime] = lambda: datetime.now(timezone.utc)) -> FastAPI:
    app = FastAPI(title="Painel Esportivo")

    def with_conn(fn):
        conn = conn_factory()
        try:
            return fn(conn)
        finally:
            conn.close()

    @app.get("/api/leagues")
    def leagues():
        return [{"key": lg.key, "name": lg.name, "sport": lg.sport} for lg in config.LEAGUES]

    @app.get("/api/games")
    def games(date: date | None = None):
        day = date or clock().astimezone(config.TZ).date()

        def run(conn):
            health = repo.sync_health(conn)
            oks = [h["last_ok"] for h in health]
            updated_at = None if None in oks else min(oks)
            errors = [{"league": h["league"], "message": h["last_error"], "at": h["last_error_at"]}
                      for h in health if h["failing"]]
            too_old = updated_at is None or clock() - datetime.fromisoformat(
                updated_at.replace("Z", "+00:00")) > STALE_AFTER
            return {
                "date": day.isoformat(),
                "games": repo.games_for_local_day(conn, day),
                "updated_at": updated_at,
                "stale": bool(errors) or too_old,
                "errors": errors,
            }

        return with_conn(run)

    @app.get("/api/favorites")
    def favorites():
        return with_conn(repo.list_favorites)

    @app.put("/api/favorites/{sport}/{team_id}", status_code=204)
    def add_favorite(sport: SportParam, team_id: str):
        with_conn(lambda c: repo.add_favorite(c, sport, team_id))
        return Response(status_code=204)

    @app.delete("/api/favorites/{sport}/{team_id}", status_code=204)
    def remove_favorite(sport: SportParam, team_id: str):
        with_conn(lambda c: repo.remove_favorite(c, sport, team_id))
        return Response(status_code=204)

    @app.get("/api/status")
    def status():
        return with_conn(repo.sync_health)

    if static_dir and static_dir.is_dir():
        root = static_dir.resolve()

        @app.get("/{path:path}", include_in_schema=False)
        def spa(path: str):
            if path.startswith("api/"):
                raise HTTPException(404)
            target = (root / path).resolve()
            if path and target.is_file() and root in target.parents:
                return FileResponse(target)
            return FileResponse(root / "index.html")

    return app
