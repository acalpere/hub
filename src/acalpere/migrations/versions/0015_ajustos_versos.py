"""Versos: límit de caràcters i mida de la lletra, editables des de Gestió

Additiva: una taula nova, amb una sola fila (id 1) amb els valors per defecte.

Revision ID: 0015
Revises: 0014
Create Date: 2026-11-19 12:00:00
"""

import sqlalchemy as sa
from alembic import op

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "verse_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("max_length", sa.Integer(), nullable=False),
        sa.Column("font_large", sa.Float(), nullable=False),  # rem, pantalla gran
        sa.Column("font_small", sa.Float(), nullable=False),  # rem, pantalla petita
    )
    op.execute(
        "INSERT INTO verse_settings (id, max_length, font_large, font_small) "
        "VALUES (1, 70, 1.05, 0.8)"
    )


def downgrade() -> None:
    op.drop_table("verse_settings")
