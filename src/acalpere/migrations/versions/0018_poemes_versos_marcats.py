"""Poemes: versos marcats (fluorescent)

Additiva: una columna nova amb valor per defecte; la versió anterior del codi la ignora.

Revision ID: 0018
Revises: 0017
Create Date: 2026-11-25 12:00:00
"""

import sqlalchemy as sa
from alembic import op

revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("poems", sa.Column("marks", sa.Text(), nullable=False, server_default="[]"))


def downgrade() -> None:
    op.drop_column("poems", "marks")
