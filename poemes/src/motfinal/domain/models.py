from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum


class StressFilter(StrEnum):
    ANY = "any"
    TONIC = "tonic"
    UNSTRESSED = "unstressed"

    @property
    def final_stressed(self) -> bool | None:
        return {
            StressFilter.ANY: None,
            StressFilter.TONIC: True,
            StressFilter.UNSTRESSED: False,
        }[self]


@dataclass(frozen=True, slots=True)
class Word:
    text: str
    normalized_text: str
    syllables: tuple[str, ...]
    final_syllable: str
    final_syllable_key: str
    last_two_syllables_key: str | None
    is_final_stressed: bool
    id: int | None = None

    def ending_key(self, syllable_count: int) -> str:
        if syllable_count == 1:
            return self.final_syllable_key
        if syllable_count == 2:
            return self.last_two_syllables_key or ""
        return ""


@dataclass(frozen=True, slots=True)
class SearchQuery:
    word: str
    syllable_count: int = 1
    stress: StressFilter = StressFilter.ANY
    context: str | None = None
    include_definitions: bool = False
    limit: int = 50
    offset: int = 0


@dataclass(frozen=True, slots=True)
class SearchHit:
    word: Word
    semantic_score: float | None = None
    definitions: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class SearchResult:
    hits: tuple[SearchHit, ...]
    total: int
    contextual: bool
    ending_syllables: tuple[str, ...]
    truncated_candidates: bool = False


class PoemStatus(StrEnum):
    IN_PROGRESS = "in_progress"
    FINISHED = "finished"
    PUBLISHED = "published"


@dataclass(frozen=True, slots=True)
class Poem:
    title: str
    body: str
    status: PoemStatus
    created_at: datetime
    updated_at: datetime
    status_changed_at: datetime
    finished_at: datetime | None = None
    published_at: datetime | None = None
    id: int | None = None
    marks: tuple[int, ...] = ()  # números dels versos marcats (fluorescent)
