import threading
import time
from datetime import date

import httpx

from painel import config
from painel.config import League


class EspnError(Exception):
    pass


class EspnClient:
    def __init__(self, http: httpx.Client | None = None, min_interval: float = config.MIN_REQUEST_INTERVAL):
        self._http = http or httpx.Client(timeout=20)
        self._min_interval = min_interval
        self._last = 0.0
        self._lock = threading.Lock()

    def scoreboard(self, league: League, day: date) -> dict:
        return self._get(f"{config.ESPN_SITE}/{league.path}/scoreboard", {"dates": day.strftime("%Y%m%d")})

    def standings(self, league: League) -> dict:
        return self._get(f"{config.ESPN_STANDINGS}/{league.path}/standings")

    def _get(self, url: str, params: dict | None = None) -> dict:
        with self._lock:
            wait = self._min_interval - (time.perf_counter() - self._last)
            if wait > 0:
                time.sleep(wait)
            try:
                r = self._http.get(url, params=params, headers={"User-Agent": config.USER_AGENT})
            except httpx.HTTPError as e:
                raise EspnError(f"falha de rede: {e}") from e
            finally:
                self._last = time.perf_counter()
        if r.status_code != 200:
            raise EspnError(f"ESPN respondeu {r.status_code} em {url}")
        try:
            return r.json()
        except ValueError as e:
            raise EspnError(f"resposta inválida da ESPN em {url}") from e
