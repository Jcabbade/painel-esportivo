from datetime import datetime

from painel.config import League
from painel.models import Game, Status, TeamSide

_POSTPONED = {"STATUS_POSTPONED", "STATUS_DELAYED"}
_CANCELED = {"STATUS_CANCELED", "STATUS_ABANDONED", "STATUS_FORFEIT"}


def _status(status_type: dict) -> Status:
    state, name = status_type.get("state"), status_type.get("name", "")
    if state == "pre":
        return "scheduled"
    if state == "in":
        return "live"
    if name in _POSTPONED:
        return "postponed"
    if name in _CANCELED:
        return "canceled"
    return "final"


def _parse_dt(value: str) -> datetime:
    # A ESPN usa "2026-11-08T14:00Z" (sem segundos).
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _record(competitor: dict) -> str | None:
    records = competitor.get("records") or []
    for r in records:
        if r.get("type") == "total" and r.get("summary"):
            return r["summary"]
    return records[0].get("summary") if records else None


def _side(competitor: dict, with_score: bool) -> TeamSide:
    t = competitor["team"]
    score = competitor.get("score")
    return TeamSide(
        team_id=str(t["id"]),
        name=t.get("displayName") or t.get("name", ""),
        short_name=t.get("shortDisplayName") or t.get("displayName", ""),
        abbrev=t.get("abbreviation", ""),
        logo=t.get("logo"),
        score=int(float(score)) if with_score and score not in (None, "") else None,
        record=_record(competitor),
    )


def parse_scoreboard(league: League, payload: dict) -> list[Game]:
    games: list[Game] = []
    for ev in payload.get("events", []):
        comp = ev["competitions"][0]
        status_type = ev["status"]["type"]
        status = _status(status_type)
        with_score = status in ("live", "final")
        sides = {c["homeAway"]: _side(c, with_score) for c in comp["competitors"]}
        venue = (comp.get("venue") or {}).get("fullName")
        games.append(
            Game(
                id=str(ev["id"]),
                league=league.key,
                sport=league.sport,
                start_utc=_parse_dt(ev["date"]),
                status=status,
                status_detail=status_type.get("shortDetail") or status_type.get("detail", ""),
                home=sides["home"],
                away=sides["away"],
                venue=venue,
            )
        )
    return games


def parse_standings(payload: dict) -> dict[str, int]:
    ranks: dict[str, int] = {}
    for child in payload.get("children", []):
        for entry in child.get("standings", {}).get("entries", []):
            for stat in entry.get("stats", []):
                if stat.get("name") == "rank" and stat.get("value") is not None:
                    ranks[str(entry["team"]["id"])] = int(stat["value"])
    return ranks
