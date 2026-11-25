"""Versos marcats dels poemes.

Revision ID: 20261125_01
Revises: 20261116_01
Create Date: 2026-11-25
"""

import sqlalchemy as sa
from alembic import op

revision = "20261125_01"
down_revision = "20261116_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("poems", sa.Column("marks", sa.Text(), nullable=False, server_default="[]"))


def downgrade() -> None:
    op.drop_column("poems", "marks")
