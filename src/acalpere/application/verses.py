"""Casos d'ús dels versos: alta, canvi, baixa i un d'aleatori per a la capçalera."""

from __future__ import annotations

import random

from ..domain.errors import InvalidInput, NotFound
from ..domain.ports import VerseRepository
from ..domain.verses import FONT_RANGE, LENGTH_RANGE, Verse, VerseSettings


class VerseService:
    def __init__(self, verses: VerseRepository):
        self._verses = verses

    def list(self) -> list[Verse]:
        return self._verses.list()

    def random(self, exclude_id: int | None = None) -> Verse | None:
        """Un vers a l'atzar; si n'hi ha més d'un, mai el que ja es veu (`exclude_id`)."""
        verses = self._verses.list()
        options = [v for v in verses if v.id != exclude_id] or verses
        return random.choice(options) if options else None

    def create(self, text: str) -> Verse:
        return self._verses.save(Verse(None, self._clean(text)))

    def update(self, verse_id: int, text: str) -> Verse:
        verse = self._verses.get(verse_id)
        if verse is None:
            raise NotFound("Vers no trobat")
        return self._verses.save(Verse(verse.id, self._clean(text), verse.created_at))

    def delete(self, verse_id: int) -> None:
        if not self._verses.delete(verse_id):
            raise NotFound("Vers no trobat")

    def settings(self) -> VerseSettings:
        return self._verses.settings()

    def update_settings(
        self, max_length: int, font_large: float, font_small: float
    ) -> VerseSettings:
        if not LENGTH_RANGE[0] <= max_length <= LENGTH_RANGE[1]:
            raise InvalidInput(
                f"El màxim de caràcters ha d'estar entre {LENGTH_RANGE[0]} i {LENGTH_RANGE[1]}"
            )
        for size in (font_large, font_small):
            if not FONT_RANGE[0] <= size <= FONT_RANGE[1]:
                raise InvalidInput(
                    f"La mida de la lletra ha d'estar entre {FONT_RANGE[0]} i {FONT_RANGE[1]} rem"
                )
        return self._verses.save_settings(
            VerseSettings(max_length, round(font_large, 2), round(font_small, 2))
        )

    def _clean(self, text: str) -> str:
        text = " ".join(text.split())
        limit = self._verses.settings().max_length
        if not text:
            raise InvalidInput("Cal un vers")
        if len(text) > limit:
            raise InvalidInput(f"El vers no pot passar dels {limit} caràcters")
        return text
