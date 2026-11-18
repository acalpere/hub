"""Cyrano de Bergerac: text de l'obra en línies i entrada al menú

Additiva: només crea una taula nova i una entrada de menú.

Revision ID: 0010
Revises: 0009
Create Date: 2026-11-18 11:00:00
"""

import sqlalchemy as sa
from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "cyrano_lines",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("act", sa.Integer(), nullable=False),
        sa.Column("scene", sa.Integer(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=10), nullable=False),
        sa.Column("speaker", sa.String(length=80), nullable=True),
        sa.Column("stamp", sa.String(length=10), nullable=True),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("norm", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_cyrano_lines_scene", "cyrano_lines", ["act", "scene", "position"])

    contents = sa.table(
        "contents",
        sa.column("name", sa.String),
        sa.column("url", sa.Text),
        sa.column("roles", sa.String),
        sa.column("position", sa.Integer),
    )
    bind = op.get_bind()
    if not bind.execute(sa.select(contents.c.url).where(contents.c.url == "/cyrano")).first():
        bind.execute(
            contents.insert().values(name="Cyrano", url="/cyrano", roles="admin", position=27)
        )


def downgrade() -> None:
    contents = sa.table("contents", sa.column("name", sa.String), sa.column("url", sa.Text))
    op.get_bind().execute(contents.delete().where(contents.c.url == "/cyrano"))
    op.drop_index("ix_cyrano_lines_scene", table_name="cyrano_lines")
    op.drop_table("cyrano_lines")
