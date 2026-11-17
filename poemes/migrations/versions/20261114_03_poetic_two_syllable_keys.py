"""Converteix les claus de dues síl·labes en claus de rima poètica.

Revision ID: 20261114_03
Revises: 20261114_02
Create Date: 2026-11-14
"""

from __future__ import annotations

import unicodedata

import sqlalchemy as sa
from alembic import op

revision = "20261114_03"
down_revision = "20261114_02"
branch_labels = None
depends_on = None

_ACCENTS = str.maketrans(
    {
        "à": "a",
        "á": "a",
        "è": "e",
        "é": "e",
        "í": "i",
        "ï": "i",
        "ò": "o",
        "ó": "o",
        "ú": "u",
        "ü": "u",
    }
)
_VOWELS = frozenset("aàáeèéiíïoòóuúü")
_STRESSED_VOWELS = frozenset("àáèéíòóú")


def _normalize(value: str) -> str:
    return unicodedata.normalize("NFC", value.lower().replace("’", "'"))


def _nucleus(syllable: str) -> str:
    value = _normalize(syllable)
    for index, letter in enumerate(value):
        if letter in _STRESSED_VOWELS:
            return value[index:]
    for index, letter in enumerate(value):
        if letter not in _VOWELS:
            continue
        if (
            letter in "uü"
            and index > 0
            and value[index - 1] in "qg"
            and index + 1 < len(value)
            and value[index + 1] in _VOWELS
        ):
            continue
        return value[index:]
    return value


def _poetic_key(syllables: list[str]) -> str | None:
    if len(syllables) < 2:
        return None
    first = _nucleus(syllables[-2]).translate(_ACCENTS)
    last = _normalize(syllables[-1]).translate(_ACCENTS)
    return f"{first}|{last}"


def _exact_key(syllables: list[str]) -> str | None:
    if len(syllables) < 2:
        return None
    return "|".join(_normalize(part).translate(_ACCENTS) for part in syllables[-2:])


def _rebuild(key_builder) -> None:
    words = sa.table(
        "words",
        sa.column("id", sa.Integer),
        sa.column("syllables", sa.JSON),
        sa.column("last_two_syllables_key", sa.String(length=160)),
    )
    connection = op.get_bind()
    rows = connection.execute(sa.select(words.c.id, words.c.syllables))
    update = (
        words.update()
        .where(words.c.id == sa.bindparam("word_id"))
        .values(last_two_syllables_key=sa.bindparam("ending_key"))
    )
    batch: list[dict[str, object]] = []
    for row in rows:
        batch.append({"word_id": row.id, "ending_key": key_builder(row.syllables)})
        if len(batch) == 5000:
            connection.execute(update, batch)
            batch.clear()
    if batch:
        connection.execute(update, batch)


def upgrade() -> None:
    _rebuild(_poetic_key)


def downgrade() -> None:
    _rebuild(_exact_key)
