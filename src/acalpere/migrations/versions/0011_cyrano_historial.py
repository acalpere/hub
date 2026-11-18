"""Cyrano: historial de versions de cada línia

Additiva: només crea una taula nova.

Revision ID: 0011
Revises: 0010
Create Date: 2026-11-18 12:00:00
"""

import sqlalchemy as sa
from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "cyrano_revisions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("line_id", sa.Integer(), nullable=False),
        sa.Column("speaker", sa.String(length=80), nullable=True),
        sa.Column("kind", sa.String(length=10), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("edited_by", sa.String(length=80), nullable=True),
        sa.Column("edited_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["line_id"], ["cyrano_lines.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_cyrano_revisions_line", "cyrano_revisions", ["line_id", "id"])


def downgrade() -> None:
    op.drop_index("ix_cyrano_revisions_line", table_name="cyrano_revisions")
    op.drop_table("cyrano_revisions")
