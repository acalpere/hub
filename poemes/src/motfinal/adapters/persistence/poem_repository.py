from __future__ import annotations

import json
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from motfinal.adapters.persistence.models import PoemRecord
from motfinal.domain.models import Poem, PoemStatus


def _aware(value: datetime | None) -> datetime | None:
    # SQLite no conserva la zona horària; tot s'emmagatzema en UTC.
    if value is not None and value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value


def _load_marks(raw: str | None) -> tuple[int, ...]:
    try:
        return tuple(sorted({int(n) for n in json.loads(raw or "[]")}))
    except (ValueError, TypeError):
        return ()


def _to_domain(record: PoemRecord) -> Poem:
    return Poem(
        id=record.id,
        title=record.title,
        body=record.body,
        status=PoemStatus(record.status),
        created_at=_aware(record.created_at),  # type: ignore[arg-type]
        updated_at=_aware(record.updated_at),  # type: ignore[arg-type]
        status_changed_at=_aware(record.status_changed_at),  # type: ignore[arg-type]
        finished_at=_aware(record.finished_at),
        published_at=_aware(record.published_at),
        marks=_load_marks(record.marks),
    )


def _fill(record: PoemRecord, poem: Poem) -> None:
    record.title = poem.title
    record.body = poem.body
    record.status = poem.status.value
    record.created_at = poem.created_at
    record.updated_at = poem.updated_at
    record.status_changed_at = poem.status_changed_at
    record.finished_at = poem.finished_at
    record.published_at = poem.published_at
    record.marks = json.dumps(list(poem.marks))


class SqlAlchemyPoemRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def list(self) -> list[Poem]:
        rows = self._session.scalars(select(PoemRecord).order_by(PoemRecord.updated_at.desc()))
        return [_to_domain(row) for row in rows]

    def get(self, poem_id: int) -> Poem | None:
        record = self._session.get(PoemRecord, poem_id)
        return _to_domain(record) if record else None

    def add(self, poem: Poem) -> Poem:
        record = PoemRecord()
        _fill(record, poem)
        self._session.add(record)
        self._session.commit()
        return _to_domain(record)

    def update(self, poem: Poem) -> Poem | None:
        record = self._session.get(PoemRecord, poem.id)
        if record is None:
            return None
        _fill(record, poem)
        self._session.commit()
        return _to_domain(record)

    def delete(self, poem_id: int) -> bool:
        record = self._session.get(PoemRecord, poem_id)
        if record is None:
            return False
        self._session.delete(record)
        self._session.commit()
        return True
