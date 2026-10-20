"""Hub: les webs pròpies i els agents (p. ex. de màrqueting) que es gestionen des d'aquí."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

SITE_STATUSES = ("active", "paused", "archived")


@dataclass(frozen=True)
class Site:
    id: int | None
    name: str
    url: str
    status: str = "active"
    notes: str = ""
    created_at: datetime | None = None


@dataclass(frozen=True)
class Agent:
    id: int | None
    name: str
    kind: str  # marketing, ...: text lliure perquè n'hi pot haver de molts tipus
    enabled: bool = True
    site_id: int | None = None
    config: dict = field(default_factory=dict)
    created_at: datetime | None = None
