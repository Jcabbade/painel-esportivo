import re

from conftest import with_status
from painel.config import league
from painel.espn.parse import parse_scoreboard, parse_standings


def test_parse_soccer_final(fixture):
    games = parse_scoreboard(league("PL"), fixture("sb_PL_20261108.json"))
    assert len(games) == 5
    for g in games:
        assert g.status == "final"
        assert g.sport == "soccer" and g.league == "PL"
        assert g.start_utc.tzinfo is not None
        assert isinstance(g.home.score, int) and isinstance(g.away.score, int)
        assert g.home.team_id != g.away.team_id
    assert any(g.venue for g in games)


def test_parse_nba_records(fixture):
    games = parse_scoreboard(league("NBA"), fixture("sb_NBA_20261117.json"))
    assert len(games) == 5
    assert all(re.fullmatch(r"\d+-\d+", g.home.record or "") for g in games)


def test_parse_scheduled_has_no_score(fixture):
    p = with_status(fixture("sb_NFL_20261116.json"), "pre", "STATUS_SCHEDULED")
    (g,) = parse_scoreboard(league("NFL"), p)
    assert g.status == "scheduled"
    assert g.home.score is None and g.away.score is None


def test_parse_live_status(fixture):
    p = with_status(fixture("sb_PL_20261108.json"), "in", "STATUS_SECOND_HALF", "67'")
    (g,) = parse_scoreboard(league("PL"), p)
    assert g.status == "live"
    assert g.status_detail == "67'"
    assert isinstance(g.home.score, int)


def test_parse_postponed_status(fixture):
    sb = fixture("sb_PL_20261108.json")
    (g,) = parse_scoreboard(league("PL"), with_status(sb, "post", "STATUS_POSTPONED"))
    assert g.status == "postponed"
    assert g.home.score is None and g.away.score is None
    (g,) = parse_scoreboard(league("PL"), with_status(sb, "post", "STATUS_CANCELED"))
    assert g.status == "canceled"


def test_parse_standings_ranks(fixture):
    ranks = parse_standings(fixture("standings_PL.json"))
    assert len(ranks) == 20
    assert sorted(ranks.values()) == list(range(1, 21))


def test_parse_standings_empty():
    assert parse_standings({}) == {}
