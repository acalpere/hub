"""autoritzacions del Hub: quines webs i agents veu cada usuari

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-20 19:00:00
"""

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Additiva: només taules noves.
    op.create_table(
        "user_sites",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("site_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["site_id"], ["sites.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "site_id"),
    )
    op.create_table(
        "user_agents",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("agent_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "agent_id"),
    )


def downgrade() -> None:
    op.drop_table("user_agents")
    op.drop_table("user_sites")
