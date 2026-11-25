from __future__ import annotations

from collections.abc import Callable
from dataclasses import replace
from datetime import UTC, datetime

from motfinal.application.ports import PoemRepository
from motfinal.domain.models import Poem, PoemStatus


class PoemNotFound(Exception):
    pass


def _now() -> datetime:
    return datetime.now(UTC)


def provisional_title(body: str, limit: int = 60) -> str:
    """Títol provisional: el primer vers no buit, retallat i sense puntuació final."""
    for line in body.splitlines():
        verse = " ".join(line.split()).strip(" ,;:.!?…-—")
        if verse:
            if len(verse) > limit:
                verse = verse[: limit - 1].rsplit(" ", 1)[0] + "…"
            return verse
    return "Sense títol"


class ManagePoems:
    """Casos d'ús dels poemes: crear, desar, canviar d'estat i esborrar."""

    def __init__(self, repository: PoemRepository, clock: Callable[[], datetime] = _now) -> None:
        self._repository = repository
        self._clock = clock

    def list(self) -> list[Poem]:
        return self._repository.list()

    def get(self, poem_id: int) -> Poem:
        poem = self._repository.get(poem_id)
        if poem is None:
            raise PoemNotFound(poem_id)
        return poem

    def create(
        self, title: str, body: str, status: PoemStatus, marks: tuple[int, ...] = ()
    ) -> Poem:
        now = self._clock()
        poem = Poem(
            title=title.strip() or provisional_title(body),
            body=body,
            status=status,
            created_at=now,
            updated_at=now,
            status_changed_at=now,
            finished_at=now if status is PoemStatus.FINISHED else None,
            published_at=now if status is PoemStatus.PUBLISHED else None,
            marks=tuple(sorted(set(marks))),
        )
        return self._repository.add(poem)

    def save(
        self,
        poem_id: int,
        title: str,
        body: str,
        status: PoemStatus,
        marks: tuple[int, ...] | None = None,
    ) -> Poem:
        current = self.get(poem_id)
        now = self._clock()
        changes: dict[str, object] = {
            "title": title.strip() or provisional_title(body),
            "body": body,
            "updated_at": now,
        }
        if marks is not None:
            changes["marks"] = tuple(sorted(set(marks)))
        if status is not current.status:
            changes["status"] = status
            changes["status_changed_at"] = now
            if status is PoemStatus.FINISHED:
                changes["finished_at"] = now
            elif status is PoemStatus.PUBLISHED:
                changes["published_at"] = now
        updated = self._repository.update(replace(current, **changes))
        if updated is None:
            raise PoemNotFound(poem_id)
        return updated

    def delete(self, poem_id: int) -> None:
        if not self._repository.delete(poem_id):
            raise PoemNotFound(poem_id)
