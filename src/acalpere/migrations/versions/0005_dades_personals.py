"""dades personals dels usuaris i apps autoritzades expressament

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-20 21:00:00
"""

import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Additiva: columnes noves (nul·lables) i files noves.
    op.add_column("users", sa.Column("first_name", sa.String(length=100), nullable=True))
    op.add_column("users", sa.Column("last_name", sa.String(length=150), nullable=True))
    op.add_column("users", sa.Column("email", sa.String(length=200), nullable=True))
    op.add_column("users", sa.Column("phone", sa.String(length=30), nullable=True))

    # El menú passa a dependre només de les autoritzacions expresses: es converteix el que cada
    # usuari ja veia pel seu rol en autoritzacions, perquè no perdi res i es pugui treure.
    bind = op.get_bind()
    users = sa.table("users", sa.column("id", sa.Integer), sa.column("role", sa.String))
    contents = sa.table("contents", sa.column("id", sa.Integer), sa.column("roles", sa.String))
    grants = sa.table(
        "user_contents", sa.column("user_id", sa.Integer), sa.column("content_id", sa.Integer)
    )
    for uid, role in bind.execute(sa.select(users.c.id, users.c.role)).all():
        if role == "admin":
            continue
        for cid, roles in bind.execute(sa.select(contents.c.id, contents.c.roles)).all():
            if role not in roles.split(","):
                continue
            has = bind.execute(
                sa.select(grants.c.user_id).where(
                    grants.c.user_id == uid, grants.c.content_id == cid
                )
            ).first()
            if not has:
                bind.execute(grants.insert().values(user_id=uid, content_id=cid))


def downgrade() -> None:
    op.drop_column("users", "phone")
    op.drop_column("users", "email")
    op.drop_column("users", "last_name")
    op.drop_column("users", "first_name")
