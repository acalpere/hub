from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence
from typing import Protocol

from motfinal.domain.models import Poem, Word


class WordRepository(Protocol):
    def search(
        self,
        ending_key: str,
        syllable_count: int,
        final_stressed: bool | None,
        limit: int,
        offset: int = 0,
    ) -> tuple[list[Word], int]: ...

    def add_many(self, words: Iterable[Word]) -> int: ...


class WordAnalyzer(Protocol):
    def analyze(self, text: str) -> Word: ...


class SemanticRanker(Protocol):
    def rank(
        self,
        context: str,
        words: Sequence[Word],
        definitions: Mapping[str, Sequence[str]] | None = None,
    ) -> list[tuple[Word, float]]: ...


class DefinitionProvider(Protocol):
    def get_many(self, words: Sequence[str]) -> dict[str, tuple[str, ...]]: ...

    def get_synonyms(self, word: str) -> tuple[str, ...]: ...

    def known_synonyms(self, word: str) -> tuple[str, ...]: ...


class PoemRepository(Protocol):
    def list(self) -> list[Poem]: ...

    def get(self, poem_id: int) -> Poem | None: ...

    def add(self, poem: Poem) -> Poem: ...

    def update(self, poem: Poem) -> Poem | None: ...

    def delete(self, poem_id: int) -> bool: ...


class SynonymProvider(Protocol):
    def get_synonyms(self, word: str) -> tuple[str, ...]: ...
