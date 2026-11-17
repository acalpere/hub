from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from motfinal.domain.models import PoemStatus


class SearchHitResponse(BaseModel):
    word: str
    syllables: list[str]
    final_syllable: str
    final_stressed: bool
    stress_label: str
    definitions: list[str]
    semantic_score: float | None = None


class SearchQueryResponse(BaseModel):
    word: str
    syllable_count: int
    ending_syllables: list[str]
    stress: str
    context: str | None
    include_definitions: bool
    limit: int
    offset: int


class SearchResponse(BaseModel):
    query: SearchQueryResponse
    results: list[SearchHitResponse]
    total: int
    contextual: bool
    truncated_candidates: bool


class SynonymsResponse(BaseModel):
    word: str
    synonyms: list[str]
    source: str = "Softcatalà · Viccionari"


class DefinitionsResponse(BaseModel):
    word: str
    definitions: list[str]
    source: str = "Viccionari"


class PoemInput(BaseModel):
    title: str = Field(default="", max_length=200)
    body: str = Field(default="", max_length=50_000)
    status: PoemStatus = PoemStatus.IN_PROGRESS


class PoemResponse(BaseModel):
    id: int
    title: str
    body: str
    status: PoemStatus
    created_at: datetime
    updated_at: datetime
    status_changed_at: datetime
    finished_at: datetime | None
    published_at: datetime | None


class WordInfo(BaseModel):
    synonyms: bool
    definition: bool


class WordsInfoResponse(BaseModel):
    words: dict[str, WordInfo]


class LoginInput(BaseModel):
    password: str = Field(max_length=200)


class SessionResponse(BaseModel):
    required: bool
    authenticated: bool
