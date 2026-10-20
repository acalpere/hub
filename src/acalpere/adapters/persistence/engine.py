"""Motor i sessions de SQLAlchemy (PostgreSQL a Neon; SQLite en local i proves)."""

from __future__ import annotations

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import sessionmaker


def normalize_url(url: str) -> str:
    """Neon dóna `postgresql://...`; SQLAlchemy ha de saber que fem servir psycopg 3."""
    for prefix in ("postgresql://", "postgres://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix) :]
    return url


def make_engine(url: str) -> Engine:
    url = normalize_url(url)
    if url.startswith("sqlite"):
        engine = create_engine(url, connect_args={"check_same_thread": False})

        @event.listens_for(engine, "connect")
        def _fk_on(dbapi_connection, _):
            dbapi_connection.execute("PRAGMA foreign_keys=ON")

        return engine
    # pool_pre_ping: Neon atura el còmput en repòs i les connexions velles es tallen.
    return create_engine(url, pool_pre_ping=True, pool_size=2, max_overflow=2, pool_recycle=300)


def make_session_factory(url: str) -> sessionmaker:
    return sessionmaker(make_engine(url), expire_on_commit=False)
