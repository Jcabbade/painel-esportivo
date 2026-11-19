"""Entrada do servidor: `python -m painel.main`."""
import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path

import uvicorn

from painel import config, db, repo
from painel.api import create_app
from painel.espn.client import EspnClient
from painel.sync import Syncer, next_live_interval

log = logging.getLogger("painel")

WINDOW_EVERY = 600          # janela de dias: a cada 10 min
STANDINGS_EVERY = 6 * 3600  # classificações: a cada 6 h
STATIC_DIR = Path(__file__).parents[2] / "frontend" / "dist"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _setup_logging() -> None:
    config.DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    handler = RotatingFileHandler(config.DB_PATH.parent / "painel.log", maxBytes=2_000_000, backupCount=3,
                                  encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
    logging.basicConfig(level=logging.INFO, handlers=[handler, logging.StreamHandler()])


async def _window_loop(syncer: Syncer) -> None:
    last_standings = None
    while True:
        try:
            today = syncer.today()
            days = [today + timedelta(days=i) for i in range(-3, 8)]
            await asyncio.to_thread(syncer.sync_local_days, days)
            if last_standings is None or (_now() - last_standings).total_seconds() >= STANDINGS_EVERY:
                await asyncio.to_thread(syncer.sync_standings)
                last_standings = _now()
        except Exception:
            log.exception("erro no laço da janela de dias")
        await asyncio.sleep(WINDOW_EVERY)


async def _live_loop(syncer: Syncer) -> None:
    while True:
        try:
            await asyncio.to_thread(syncer.sync_live)
            wait = next_live_interval(repo.has_live_games(syncer.conn, _now()))
        except Exception:
            log.exception("erro no laço ao vivo")
            wait = 60
        await asyncio.sleep(wait)


def build_app():
    sync_conn = db.connect(config.DB_PATH)
    db.init_schema(sync_conn)
    syncer = Syncer(sync_conn, EspnClient(), config.LEAGUES, clock=_now)

    @asynccontextmanager
    async def lifespan(app):
        tasks = [asyncio.create_task(_window_loop(syncer)), asyncio.create_task(_live_loop(syncer))]
        yield
        for t in tasks:
            t.cancel()

    app = create_app(lambda: db.connect(config.DB_PATH), STATIC_DIR)
    app.router.lifespan_context = lifespan
    return app


def main() -> None:
    _setup_logging()
    uvicorn.run(build_app(), host="0.0.0.0", port=config.PORT, log_config=None)


if __name__ == "__main__":
    main()
