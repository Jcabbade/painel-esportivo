from dataclasses import dataclass
from pathlib import Path
from typing import Literal
from zoneinfo import ZoneInfo

Sport = Literal["soccer", "basketball", "football"]


@dataclass(frozen=True)
class League:
    key: str
    path: str
    name: str
    sport: Sport


LEAGUES: list[League] = [
    League("NFL", "football/nfl", "NFL", "football"),
    League("NBA", "basketball/nba", "NBA", "basketball"),
    League("BRA", "soccer/bra.1", "Brasileirão", "soccer"),
    League("CDB", "soccer/bra.copa_do_brazil", "Copa do Brasil", "soccer"),
    League("LIB", "soccer/conmebol.libertadores", "Libertadores", "soccer"),
    League("SUL", "soccer/conmebol.sudamericana", "Sul-Americana", "soccer"),
    League("PL", "soccer/eng.1", "Premier League", "soccer"),
    League("UCL", "soccer/uefa.champions", "Champions League", "soccer"),
    League("ESP", "soccer/esp.1", "La Liga", "soccer"),
    League("ITA", "soccer/ita.1", "Serie A", "soccer"),
    League("ALE", "soccer/ger.1", "Bundesliga", "soccer"),
]

_BY_KEY = {lg.key: lg for lg in LEAGUES}


def league(key: str) -> League:
    return _BY_KEY[key]


TZ = ZoneInfo("America/Sao_Paulo")
PORT = 8765
DB_PATH = Path(__file__).parents[1] / "data" / "painel.db"

ESPN_SITE = "https://site.api.espn.com/apis/site/v2/sports"
ESPN_STANDINGS = "https://site.api.espn.com/apis/v2/sports"
USER_AGENT = "Mozilla/5.0 (painel-esportivo pessoal)"
MIN_REQUEST_INTERVAL = 0.5
