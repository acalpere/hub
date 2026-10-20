"""Entorn d'Alembic. L'URL ve de migrate.py o, des de la CLI `alembic`, de la configuració."""

from __future__ import annotations

from alembic import context
from sqlalchemy import create_engine, pool

from acalpere.adapters.persistence.engine import normalize_url
from acalpere.adapters.persistence.models import Base

config = context.config
target_metadata = Base.metadata


def _url() -> str:
    url = config.get_main_option("sqlalchemy.url")
    if url:
        return url
    from acalpere.config import get_settings

    settings = get_settings()
    return normalize_url(settings.database_url_unpooled or settings.database_url)


def run_migrations_offline() -> None:
    context.configure(url=_url(), target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = create_engine(_url(), poolclass=pool.NullPool)
    with engine.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata, render_as_batch=True
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
