"""corregeix la ruta del menú de Poemes

Revision ID: 0009
Revises: 0008
Create Date: 2026-11-17 10:00:00
"""

import sqlalchemy as sa
from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    contents = sa.table(
        "contents",
        sa.column("name", sa.String),
        sa.column("url", sa.Text),
    )
    op.get_bind().execute(
        contents.update()
        .where(contents.c.name == "Poemes")
        .where(contents.c.url.in_(["/poemes", "/poemes/"]))
        .values(url="/apps/poemes/")
    )


def downgrade() -> None:
    contents = sa.table(
        "contents",
        sa.column("name", sa.String),
        sa.column("url", sa.Text),
    )
    op.get_bind().execute(
        contents.update()
        .where(contents.c.name == "Poemes")
        .where(contents.c.url == "/apps/poemes/")
        .values(url="/poemes")
    )
