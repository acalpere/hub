"""Cyrano: l'historial també desa la marca de temps de cada versió

Additiva: una columna nova, buida per defecte.

Revision ID: 0013
Revises: 0012
Create Date: 2026-11-18 15:00:00
"""

import sqlalchemy as sa
from alembic import op

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("cyrano_revisions", sa.Column("stamp", sa.String(length=10), nullable=True))


def downgrade() -> None:
    op.drop_column("cyrano_revisions", "stamp")
