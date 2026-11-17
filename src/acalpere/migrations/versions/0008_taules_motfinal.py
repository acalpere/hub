"""taules de motfinal (poemes/): lèxic de paraules i poemes

Additiva: només crea taules noves. Reflecteix les migracions pròpies de motfinal
(poemes/migrations) en estat final; si motfinal es separa, aquestes taules es queden com són.

Revision ID: 0008
Revises: 0007
Create Date: 2026-11-16 12:00:00
"""

import sqlalchemy as sa
from alembic import op

revision = "0008"
down_revision = "0007"
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
        sa.Column("last_two_syllables_key", sa.String(length=160), nullable=True),
        sa.Column("is_final_stressed", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("normalized_text"),
    )
    op.create_index(
        "ix_words_final_key_stress_text",
        "words",
        ["final_syllable_key", "is_final_stressed", "normalized_text"],
    )
    op.create_index(
        "ix_words_last_two_key_stress_text",
        "words",
        ["last_two_syllables_key", "is_final_stressed", "normalized_text"],
    )
    op.create_table(
        "poems",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status_changed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_poems_updated_at", "poems", ["updated_at"])


def downgrade() -> None:
    op.drop_index("ix_poems_updated_at", table_name="poems")
    op.drop_table("poems")
    op.drop_index("ix_words_last_two_key_stress_text", table_name="words")
    op.drop_index("ix_words_final_key_stress_text", table_name="words")
    op.drop_table("words")
