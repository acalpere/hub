"""AWS (apunts d'estudi): necessitats pròpies i nivell de coneixement de cada fitxa."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

LEVELS = (1, 2, 3, 4)  # 1 = no en tinc idea (vermell) … 4 = ho domino (verd); sense marca = 0


@dataclass(frozen=True)
class CustomNeed:
    id: int | None
    name: str
    tagline: str
    what: str
    services: list[dict] = field(default_factory=list)  # [{"name": ..., "why": ...}]
    created_at: datetime | None = None


@dataclass(frozen=True)
class SavedAnswer:
    """Resposta del tutor desada al «calaix de sastre», titulada amb la pregunta."""

    id: int | None
    question: str
    answer: str
    created_at: datetime | None = None
