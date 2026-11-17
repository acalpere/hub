from __future__ import annotations

from collections.abc import Iterable

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from motfinal.adapters.persistence.models import WordRecord
from motfinal.domain.models import Word


class SqlAlchemyWordRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def search(
        self,
        ending_key: str,
        syllable_count: int,
        final_stressed: bool | None,
        limit: int,
        offset: int = 0,
    ) -> tuple[list[Word], int]:
        ending_column = (
            WordRecord.final_syllable_key
            if syllable_count == 1
            else WordRecord.last_two_syllables_key
        )
        conditions = [ending_column == ending_key]
        if final_stressed is not None:
            conditions.append(WordRecord.is_final_stressed.is_(final_stressed))

        total = self.session.scalar(
            select(func.count()).select_from(WordRecord).where(*conditions)
        ) or 0
        records = self.session.scalars(
            select(WordRecord)
            .where(*conditions)
            .order_by(func.length(WordRecord.normalized_text), WordRecord.normalized_text)
            .limit(limit)
            .offset(offset)
        ).all()
        return [self._to_domain(record) for record in records], total

    def add_many(self, words: Iterable[Word]) -> int:
        values = list(words)
        if not values:
            return 0
        normalized = [word.normalized_text for word in values]
        existing = set(
            self.session.scalars(
                select(WordRecord.normalized_text).where(
                    WordRecord.normalized_text.in_(normalized)
                )
            ).all()
        )
        new_records = [
            WordRecord(
                text=word.text,
                normalized_text=word.normalized_text,
                syllables=list(word.syllables),
                final_syllable=word.final_syllable,
                final_syllable_key=word.final_syllable_key,
                last_two_syllables_key=word.last_two_syllables_key,
                is_final_stressed=word.is_final_stressed,
            )
            for word in values
            if word.normalized_text not in existing
        ]
        self.session.add_all(new_records)
        self.session.commit()
        return len(new_records)

    @staticmethod
    def _to_domain(record: WordRecord) -> Word:
        return Word(
            id=record.id,
            text=record.text,
            normalized_text=record.normalized_text,
            syllables=tuple(record.syllables),
            final_syllable=record.final_syllable,
            final_syllable_key=record.final_syllable_key,
            last_two_syllables_key=record.last_two_syllables_key,
            is_final_stressed=record.is_final_stressed,
        )
