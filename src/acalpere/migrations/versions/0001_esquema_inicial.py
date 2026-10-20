"""esquema inicial

Revision ID: 0001
Revises:
Create Date: 2026-10-20 16:29:06.065166
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "configuracio",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("clau", sa.String(length=100), nullable=False),
        sa.Column("valor", sa.Text(), nullable=True),
        sa.Column("tipus", sa.String(length=10), nullable=False),
        sa.Column("descripcio", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("clau"),
    )
    op.create_table(
        "contents",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("roles", sa.String(length=80), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "darrera_modificacio",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "fills",
        sa.Column("codi", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("nom", sa.String(length=45), nullable=True),
        sa.Column("comentari", sa.Text(), nullable=False),
        sa.Column("dia_i_hora", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("codi"),
    )
    op.create_table(
        "finques",
        sa.Column("codi", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("nom", sa.String(length=45), nullable=True),
        sa.Column("taxacio", sa.Integer(), nullable=True),
        sa.Column("comunitat", sa.Integer(), nullable=True),
        sa.Column("comunitat2", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("codi"),
    )
    op.create_table(
        "germans",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("nom", sa.String(length=100), nullable=False),
        sa.Column("codi", sa.String(length=20), nullable=False),
        sa.Column("color", sa.String(length=7), nullable=False),
        sa.Column("actiu", sa.Boolean(), nullable=False),
        sa.Column(
            "data_creacio",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("codi"),
    )
    op.create_table(
        "missatges",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("autor", sa.String(length=50), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("dia_i_hora", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "modalitats",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("nom", sa.String(length=50), nullable=False),
        sa.Column("codi", sa.String(length=20), nullable=False),
        sa.Column("descripcio", sa.Text(), nullable=True),
        sa.Column("actiu", sa.Boolean(), nullable=False),
        sa.Column(
            "data_creacio",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("codi"),
    )
    op.create_table(
        "parametres",
        sa.Column("fill_codi", sa.Integer(), autoincrement=False, nullable=False),
        sa.Column("vol", sa.Integer(), nullable=False),
        sa.Column("valor_vol", sa.Integer(), nullable=False),
        sa.Column("llivia", sa.Boolean(), nullable=False),
        sa.Column("taxacio", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("fill_codi"),
    )
    op.create_table(
        "sites",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("username", sa.String(length=50), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    # Noms d'usuari únics sense distingir majúscules (l'autogeneració no detecta aquest índex)
    op.create_index("ux_users_username_lower", "users", [sa.text("lower(username)")], unique=True)
    op.create_table(
        "agents",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("kind", sa.String(length=50), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("site_id", sa.Integer(), nullable=True),
        sa.Column(
            "config", sa.JSON().with_variant(postgresql.JSONB(), "postgresql"), nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["site_id"], ["sites.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "assignacions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("data_assignacio", sa.Date(), nullable=False),
        sa.Column("germa_id", sa.Integer(), nullable=False),
        sa.Column("modalitat_id", sa.Integer(), nullable=False),
        sa.Column("creat_per", sa.Integer(), nullable=True),
        sa.Column("modificat_per", sa.Integer(), nullable=True),
        sa.Column(
            "data_creacio",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "data_modificacio",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["creat_per"], ["germans.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["germa_id"], ["germans.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["modalitat_id"], ["modalitats.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["modificat_per"], ["germans.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "data_assignacio", "germa_id", "modalitat_id", name="unique_assignacio"
        ),
    )
    with op.batch_alter_table("assignacions", schema=None) as batch_op:
        batch_op.create_index("idx_assignacions_data", ["data_assignacio"], unique=False)

    op.create_table(
        "pisos",
        sa.Column("codi", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("finca_codi", sa.Integer(), nullable=False),
        sa.Column("fill_codi", sa.Integer(), nullable=False),
        sa.Column("pis", sa.String(length=20), nullable=True),
        sa.Column("porta", sa.String(length=20), nullable=True),
        sa.Column("nom", sa.String(length=40), nullable=False),
        sa.Column("taxacio", sa.Integer(), nullable=True),
        sa.Column("taxacio2", sa.Integer(), nullable=False),
        sa.Column("rendiment", sa.Integer(), nullable=True),
        sa.Column("rendiment2", sa.Integer(), nullable=False),
        sa.Column("prorrateig", sa.Integer(), nullable=False),
        sa.Column("prorrateig2", sa.Integer(), nullable=False),
        sa.Column("actual", sa.Integer(), nullable=False),
        sa.Column("proposta_pere", sa.Integer(), nullable=False),
        sa.Column("proposta_jordi", sa.Integer(), nullable=False),
        sa.Column("proposta_rosamaria", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["fill_codi"],
            ["fills.codi"],
        ),
        sa.ForeignKeyConstraint(
            ["finca_codi"],
            ["finques.codi"],
        ),
        sa.PrimaryKeyConstraint("codi"),
    )
    with op.batch_alter_table("pisos", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_pisos_fill_codi"), ["fill_codi"], unique=False)
        batch_op.create_index(batch_op.f("ix_pisos_finca_codi"), ["finca_codi"], unique=False)

    op.create_table(
        "historial_canvis",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("assignacio_id", sa.Integer(), nullable=True),
        sa.Column("data_assignacio", sa.Date(), nullable=False),
        sa.Column("germa_id", sa.Integer(), nullable=False),
        sa.Column("modalitat_id", sa.Integer(), nullable=False),
        sa.Column("accio", sa.String(length=10), nullable=False),
        sa.Column(
            "data_canvi",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column("usuari_canvi", sa.Integer(), nullable=True),
        sa.Column("detalls_canvi", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["assignacio_id"], ["assignacions.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["germa_id"], ["germans.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["modalitat_id"], ["modalitats.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["usuari_canvi"], ["germans.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("historial_canvis")
    with op.batch_alter_table("pisos", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_pisos_finca_codi"))
        batch_op.drop_index(batch_op.f("ix_pisos_fill_codi"))

    op.drop_table("pisos")
    with op.batch_alter_table("assignacions", schema=None) as batch_op:
        batch_op.drop_index("idx_assignacions_data")

    op.drop_table("assignacions")
    op.drop_table("agents")
    op.drop_index("ux_users_username_lower", table_name="users")
    op.drop_table("users")
    op.drop_table("sites")
    op.drop_table("parametres")
    op.drop_table("modalitats")
    op.drop_table("missatges")
    op.drop_table("germans")
    op.drop_table("finques")
    op.drop_table("fills")
    op.drop_table("darrera_modificacio")
    op.drop_table("contents")
    op.drop_table("configuracio")
