"""Cyrano: línies revisades (xec verd)

Additiva: una columna nova amb valor per defecte; la versió anterior del codi la ignora.

Revision ID: 0019
Revises: 0018
Create Date: 2026-11-26 10:00:00
"""

import sqlalchemy as sa
from alembic import op

revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "cyrano_lines",
        sa.Column("reviewed", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("cyrano_lines", "reviewed")
