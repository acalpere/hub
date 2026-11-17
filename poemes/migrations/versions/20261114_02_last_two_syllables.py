"""Afegeix la clau indexada de les dues darreres síl·labes.

Revision ID: 20261114_02
Revises: 20261114_01
Create Date: 2026-11-14
"""

from __future__ import annotations

import unicodedata

import sqlalchemy as sa
from alembic import op

revision = "20261114_02"
down_revision = "20261114_01"
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


def _key(syllables: list[str]) -> str | None:
    if len(syllables) < 2:
        return None
    return "|".join(
        unicodedata.normalize("NFC", part.lower().replace("’", "'")).translate(_ACCENTS)
        for part in syllables[-2:]
    )


def upgrade() -> None:
    op.add_column(
        "words", sa.Column("last_two_syllables_key", sa.String(length=160), nullable=True)
    )

    words = sa.table(
        "words",
        sa.column("id", sa.Integer),
        sa.column("syllables", sa.JSON),
        sa.column("last_two_syllables_key", sa.String(length=160)),
    )
    connection = op.get_bind()
    rows = connection.execute(sa.select(words.c.id, words.c.syllables))
    batch: list[dict[str, object]] = []
    update = (
        words.update()
        .where(words.c.id == sa.bindparam("word_id"))
        .values(last_two_syllables_key=sa.bindparam("ending_key"))
    )
    for row in rows:
        batch.append({"word_id": row.id, "ending_key": _key(row.syllables)})
        if len(batch) == 5000:
            connection.execute(update, batch)
            batch.clear()
    if batch:
        connection.execute(update, batch)

    op.create_index(
        "ix_words_last_two_key_stress_text",
        "words",
        ["last_two_syllables_key", "is_final_stressed", "normalized_text"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_words_last_two_key_stress_text", table_name="words")
    with op.batch_alter_table("words") as batch_op:
        batch_op.drop_column("last_two_syllables_key")
