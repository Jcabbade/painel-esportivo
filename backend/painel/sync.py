import logging
import sqlite3
from collections.abc import Callable, Iterable
from datetime import date, datetime, timedelta

from painel import config, repo
from painel.config import League
from painel.espn.client import EspnClient, EspnError
from painel.espn.parse import parse_scoreboard, parse_standings

log = logging.getLogger(__name__)

LIVE_INTERVAL = 30
IDLE_INTERVAL = 600


def espn_dates_for_local_day(day: date) -> list[date]:
    """A ESPN agrupa jogos pelo dia dos EUA, atrasado em relação a Brasília."""
    return [day - timedelta(days=1), day]


def next_live_interval(has_live: bool) -> int:
    return LIVE_INTERVAL if has_live else IDLE_INTERVAL


class Syncer:
    def __init__(self, conn: sqlite3.Connection, client: EspnClient, leagues: list[League],
                 clock: Callable[[], datetime]):
        self.conn = conn
        self.client = client
        self.leagues = leagues
        self.clock = clock

    def today(self) -> date:
        return self.clock().astimezone(config.TZ).date()

    def sync_local_days(self, days: Iterable[date]) -> None:
        espn_days = sorted({d for day in days for d in espn_dates_for_local_day(day)})
        for lg in self.leagues:
            self._sync_league(lg, espn_days)

    def sync_live(self) -> None:
        live = repo.live_leagues(self.conn, self.clock())
        days = espn_dates_for_local_day(self.today())
        for lg in self.leagues:
            if lg.key in live:
                self._sync_league(lg, days)

    def sync_standings(self) -> None:
        for lg in self.leagues:
            if lg.sport != "soccer":
                continue
            try:
                ranks = parse_standings(self.client.standings(lg))
            except Exception as e:
                log.warning("classificação %s: %s", lg.key, e)
                repo.log_sync(self.conn, lg.key, "standings", False, str(e), self.clock())
                continue
            repo.set_standings(self.conn, lg.key, ranks, self.clock())
            repo.log_sync(self.conn, lg.key, "standings", True, None, self.clock())

    def _sync_league(self, lg: League, espn_days: list[date]) -> None:
        for d in espn_days:
            try:
                games = parse_scoreboard(lg, self.client.scoreboard(lg, d))
            except EspnError as e:
                log.warning("scoreboard %s %s: %s", lg.key, d, e)
                repo.log_sync(self.conn, lg.key, "scoreboard", False, str(e), self.clock())
                return
            except Exception as e:  # resposta em formato inesperado: não pode parar as outras ligas
                log.exception("scoreboard %s %s: formato inesperado", lg.key, d)
                repo.log_sync(self.conn, lg.key, "scoreboard", False, f"resposta inesperada da ESPN: {e!r}",
                              self.clock())
                return
            repo.upsert_games(self.conn, games, self.clock())
        repo.log_sync(self.conn, lg.key, "scoreboard", True, None, self.clock())
