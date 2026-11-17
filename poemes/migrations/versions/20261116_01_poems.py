"""Crea la taula de poemes.

Revision ID: 20261116_01
Revises: 20261114_03
Create Date: 2026-11-16
"""

import sqlalchemy as sa
from alembic import op

revision = "20261116_01"
down_revision = "20261114_03"
branch_labels = None
depends_on = None


def upgrade() -> None:
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
    op.create_index("ix_poems_updated_at", "poems", ["updated_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_poems_updated_at", table_name="poems")
    op.drop_table("poems")
