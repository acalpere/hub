from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from motfinal.adapters.persistence.config import get_settings

settings = get_settings()
_engine_options: dict[str, object] = {"pool_pre_ping": True}
if settings.database_url.startswith("sqlite"):
    _engine_options["connect_args"] = {"check_same_thread": False}
else:
    _engine_options.update({"pool_recycle": 300, "pool_size": 5, "max_overflow": 10})

engine = create_engine(settings.database_url, **_engine_options)
SessionFactory = sessionmaker(bind=engine, expire_on_commit=False, class_=Session)


def get_session() -> Iterator[Session]:
    with SessionFactory() as session:
        yield session
