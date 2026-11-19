"""Versos: frases curtes que es mostren a la capçalera."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

# Per defecte, perquè càpiga en dues línies a la capçalera fins i tot en un mòbil estret.
DEFAULT_MAX_LENGTH = 70
LENGTH_RANGE = (10, 300)
FONT_RANGE = (0.6, 2.0)  # rem


@dataclass(frozen=True)
class Verse:
    id: int | None
    text: str
    created_at: datetime | None = None


@dataclass(frozen=True)
class VerseSettings:
    """Ajustos dels versos, canviables des de Gestió."""

    max_length: int = DEFAULT_MAX_LENGTH
    font_large: float = 1.05  # rem, pantalles grans
    font_small: float = 0.8  # rem, pantalles petites
