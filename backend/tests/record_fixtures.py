"""Baixa respostas reais da ESPN usadas como fixtures dos testes. Rodar uma vez."""
import json
from pathlib import Path

import httpx

OUT = Path(__file__).parent / "fixtures"
SITE = "https://site.api.espn.com/apis/site/v2/sports"
STAND = "https://site.api.espn.com/apis/v2/sports"
FILES = {
    "sb_PL_20261108.json": f"{SITE}/soccer/eng.1/scoreboard?dates=20261108",
    "sb_NBA_20261117.json": f"{SITE}/basketball/nba/scoreboard?dates=20261117",
    "sb_NFL_20261116.json": f"{SITE}/football/nfl/scoreboard?dates=20261116",
    "sb_UCL_20261104.json": f"{SITE}/soccer/uefa.champions/scoreboard?dates=20261104",
    "standings_PL.json": f"{STAND}/soccer/eng.1/standings",
}

if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    with httpx.Client(headers={"User-Agent": "Mozilla/5.0 (painel-esportivo pessoal)"}, timeout=30) as c:
        for name, url in FILES.items():
            r = c.get(url)
            r.raise_for_status()
            (OUT / name).write_text(json.dumps(r.json(), ensure_ascii=False, indent=1), encoding="utf-8")
            print(name, len(r.content))
