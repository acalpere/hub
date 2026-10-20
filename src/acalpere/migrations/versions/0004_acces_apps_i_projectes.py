"""autoritzacions d'apps, permís de treballar amb agents i webs dels projectes germans

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-20 20:00:00
"""

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None

# (nom, adreça): cada projecte, a AWS i en local. Es poden editar o treure des del Hub.
PROJECT_SITES = [
    ("lafidelfil · AWS", "https://lafidelfil.cat"),
    ("lafidelfil · local", "http://localhost:5173"),
    ("artselegendi · AWS", "https://arseligendi.com"),
    ("artselegendi · local", "http://localhost:8000"),
    ("lalira · AWS", "https://lalira.acalpere.cat"),
    ("lalira · local", "http://localhost:5500"),
]


def upgrade() -> None:
    # Additiva: una taula nova, una columna amb valor per defecte i files noves.
    op.create_table(
        "user_contents",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("content_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["content_id"], ["contents.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "content_id"),
    )
    op.add_column(
        "user_agents",
        sa.Column("can_work", sa.Boolean(), server_default=sa.false(), nullable=False),
    )
    sites = sa.table(
        "sites",
        sa.column("name", sa.String),
        sa.column("url", sa.Text),
        sa.column("status", sa.String),
        sa.column("notes", sa.Text),
    )
    bind = op.get_bind()
    for name, url in PROJECT_SITES:
        exists = bind.execute(sa.select(sites.c.url).where(sites.c.url == url)).first()
        if not exists:
            bind.execute(sites.insert().values(name=name, url=url, status="active", notes=""))


def downgrade() -> None:
    op.drop_column("user_agents", "can_work")
    op.drop_table("user_contents")
