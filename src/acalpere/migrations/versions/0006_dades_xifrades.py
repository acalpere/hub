"""columna de dades xifrades per a l'herència

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-21 12:00:00
"""

import sqlalchemy as sa
from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None

TABLES = ("fills", "finques", "pisos", "parametres", "missatges")


def upgrade() -> None:
    # Additiva: la versió anterior ignora la columna. Les dades es xifren després amb
    # `acalpere encrypt-herencia`, que necessita la clau (no és una migració d'esquema).
    for table in TABLES:
        op.add_column(table, sa.Column("dades", sa.Text(), nullable=True))
    # Finca i fill de cada pis, i la data dels missatges, també es xifren: les columnes passen a
    # admetre nuls un cop xifrades.
    with op.batch_alter_table("pisos") as batch:
        batch.alter_column("fill_codi", existing_type=sa.Integer(), nullable=True)
        batch.alter_column("finca_codi", existing_type=sa.Integer(), nullable=True)
    with op.batch_alter_table("missatges") as batch:
        batch.alter_column("dia_i_hora", existing_type=sa.DateTime(), nullable=True)


def downgrade() -> None:
    with op.batch_alter_table("missatges") as batch:
        batch.alter_column("dia_i_hora", existing_type=sa.DateTime(), nullable=False)
    with op.batch_alter_table("pisos") as batch:
        batch.alter_column("finca_codi", existing_type=sa.Integer(), nullable=False)
        batch.alter_column("fill_codi", existing_type=sa.Integer(), nullable=False)
    for table in reversed(TABLES):
        op.drop_column(table, "dades")
