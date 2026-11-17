"""afegeix Poemes al menú d'aplicacions

Revision ID: 0007
Revises: 0006
Create Date: 2026-11-14 18:00:00
"""

import sqlalchemy as sa
from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    contents = sa.table(
        "contents",
        sa.column("name", sa.String),
        sa.column("url", sa.Text),
        sa.column("roles", sa.String),
        sa.column("position", sa.Integer),
    )
    bind = op.get_bind()
    url = "/apps/poemes/"
    exists = bind.execute(sa.select(contents.c.url).where(contents.c.url == url)).first()
    if not exists:
        bind.execute(
            contents.insert().values(name="Poemes", url="/apps/poemes/", roles="admin", position=25)
        )


def downgrade() -> None:
    contents = sa.table(
        "contents",
        sa.column("name", sa.String),
        sa.column("url", sa.Text),
    )
    op.get_bind().execute(
        contents.delete().where(contents.c.url == "/apps/poemes/", contents.c.name == "Poemes")
    )
