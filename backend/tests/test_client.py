import time
from datetime import date

import httpx
import pytest

from painel.config import league
from painel.espn.client import EspnClient, EspnError


def make(handler, min_interval=0.0):
    return EspnClient(http=httpx.Client(transport=httpx.MockTransport(handler)), min_interval=min_interval)


def test_scoreboard_builds_url():
    seen = {}

    def handler(req):
        seen["url"], seen["ua"] = str(req.url), req.headers.get("user-agent")
        return httpx.Response(200, json={"events": []})

    assert make(handler).scoreboard(league("PL"), date(2026, 11, 8)) == {"events": []}
    assert seen["url"].endswith("/soccer/eng.1/scoreboard?dates=20261108")
    assert "painel-esportivo" in seen["ua"]


def test_standings_url():
    seen = {}

    def handler(req):
        seen["url"] = str(req.url)
        return httpx.Response(200, json={})

    make(handler).standings(league("ESP"))
    assert seen["url"] == "https://site.api.espn.com/apis/v2/sports/soccer/esp.1/standings"


def test_error_status_raises():
    with pytest.raises(EspnError):
        make(lambda req: httpx.Response(503)).scoreboard(league("NBA"), date(2026, 11, 8))


def test_invalid_json_raises():
    with pytest.raises(EspnError):
        make(lambda req: httpx.Response(200, content=b"<html>")).scoreboard(league("NBA"), date(2026, 11, 8))


def test_network_error_raises():
    def handler(req):
        raise httpx.ConnectError("sem rede")

    with pytest.raises(EspnError):
        make(handler).scoreboard(league("NBA"), date(2026, 11, 8))


def test_throttle():
    c = make(lambda req: httpx.Response(200, json={}), min_interval=0.2)
    t0 = time.perf_counter()
    c.standings(league("PL"))
    c.standings(league("PL"))
    assert time.perf_counter() - t0 >= 0.2
