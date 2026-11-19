from dataclasses import dataclass
from datetime import datetime
from typing import Literal

Status = Literal["scheduled", "live", "final", "postponed", "canceled"]


@dataclass
class TeamSide:
    team_id: str
    name: str
    short_name: str
    abbrev: str
    logo: str | None
    score: int | None
    record: str | None


@dataclass
class Game:
    id: str
    league: str
    sport: str
    start_utc: datetime
    status: Status
    status_detail: str
    home: TeamSide
    away: TeamSide
    venue: str | None
