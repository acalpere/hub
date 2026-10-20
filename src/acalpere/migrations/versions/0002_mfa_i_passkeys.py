"""segon factor (TOTP) i claus d'accés (WebAuthn)

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-20 18:30:00
"""

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Additiva: la versió anterior del codi ignora la columna i la taula noves.
    op.add_column("users", sa.Column("totp_secret", sa.String(length=64), nullable=True))
    op.create_table(
        "passkeys",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("credential_id", sa.String(length=512), nullable=False),
        sa.Column("public_key", sa.Text(), nullable=False),
        sa.Column("sign_count", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=80), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("credential_id"),
    )
    op.create_index("ix_passkeys_user_id", "passkeys", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_passkeys_user_id", table_name="passkeys")
    op.drop_table("passkeys")
    op.drop_column("users", "totp_secret")
