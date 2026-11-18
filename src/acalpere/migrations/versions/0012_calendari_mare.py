"""canvia el nom de l'entrada de menú «Calendari de la mare» per «Calendari mare»

Només dades del menú (additiva: no toca l'esquema).

Revision ID: 0012
Revises: 0011
Create Date: 2026-11-18 14:00:00
"""

import sqlalchemy as sa
from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def _rename(old: str, new: str) -> None:
    contents = sa.table("contents", sa.column("name", sa.String), sa.column("url", sa.Text))
    op.get_bind().execute(
        contents.update()
        .where(contents.c.url == "/apps/calendari/", contents.c.name == old)
        .values(name=new)
    )


def upgrade() -> None:
    _rename("Calendari de la mare", "Calendari mare")


def downgrade() -> None:
    _rename("Calendari mare", "Calendari de la mare")
