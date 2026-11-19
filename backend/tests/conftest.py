import copy
import json
from pathlib import Path

import pytest

FIX = Path(__file__).parent / "fixtures"


def load_fixture(name: str) -> dict:
    return json.loads((FIX / name).read_text(encoding="utf-8"))


@pytest.fixture
def fixture():
    return load_fixture


def with_status(payload: dict, state: str, name: str, short: str = "") -> dict:
    """Cópia do scoreboard com o primeiro evento num status escolhido."""
    p = copy.deepcopy(payload)
    p["events"] = p["events"][:1]
    t = p["events"][0]["status"]["type"]
    t["state"], t["name"] = state, name
    if short:
        t["shortDetail"] = short
    return p
