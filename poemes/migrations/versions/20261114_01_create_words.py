"""Crea el lèxic analitzat.

Revision ID: 20261114_01
Revises:
Create Date: 2026-11-14
"""

import sqlalchemy as sa
from alembic import op

revision = "20261114_01"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "words",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("text", sa.String(length=160), nullable=False),
        sa.Column("normalized_text", sa.String(length=160), nullable=False),
        sa.Column("syllables", sa.JSON(), nullable=False),
        sa.Column("final_syllable", sa.String(length=32), nullable=False),
        sa.Column("final_syllable_key", sa.String(length=32), nullable=False),
        sa.Column("is_final_stressed", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("normalized_text"),
    )
    op.create_index(
        "ix_words_final_key_stress_text",
        "words",
        ["final_syllable_key", "is_final_stressed", "normalized_text"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_words_final_key_stress_text", table_name="words")
    op.drop_table("words")
