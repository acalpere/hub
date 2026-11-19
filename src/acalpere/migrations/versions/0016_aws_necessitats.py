"""AWS: necessitats creades per l'usuari i nivell de coneixement de cada fitxa

Additiva: dues taules noves.

Revision ID: 0016
Revises: 0015
Create Date: 2026-11-19 16:00:00
"""

import sqlalchemy as sa
from alembic import op

revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "aws_needs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("tagline", sa.Text(), nullable=False),
        sa.Column("what", sa.Text(), nullable=False),
        sa.Column("services", sa.JSON(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_table(
        "aws_marks",
        sa.Column(
            "user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
        ),
        sa.Column("key", sa.String(length=80), primary_key=True),
        sa.Column("level", sa.Integer(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("aws_marks")
    op.drop_table("aws_needs")
