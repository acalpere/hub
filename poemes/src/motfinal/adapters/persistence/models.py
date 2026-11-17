from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Index, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class WordRecord(Base):
    __tablename__ = "words"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    text: Mapped[str] = mapped_column(String(160), nullable=False)
    normalized_text: Mapped[str] = mapped_column(String(160), nullable=False, unique=True)
    syllables: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    final_syllable: Mapped[str] = mapped_column(String(32), nullable=False)
    final_syllable_key: Mapped[str] = mapped_column(String(32), nullable=False)
    last_two_syllables_key: Mapped[str | None] = mapped_column(String(160), nullable=True)
    is_final_stressed: Mapped[bool] = mapped_column(Boolean, nullable=False)

    __table_args__ = (
        Index(
            "ix_words_final_key_stress_text",
            "final_syllable_key",
            "is_final_stressed",
            "normalized_text",
        ),
        Index(
            "ix_words_last_two_key_stress_text",
            "last_two_syllables_key",
            "is_final_stressed",
            "normalized_text",
        ),
    )


class PoemRecord(Base):
    __tablename__ = "poems"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="in_progress")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status_changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (Index("ix_poems_updated_at", "updated_at"),)
