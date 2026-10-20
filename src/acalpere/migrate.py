"""Aplica les migracions d'Alembic (empaquetades a acalpere/migrations)."""

from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config

from .adapters.persistence.engine import normalize_url


def _config(database_url: str) -> Config:
    cfg = Config()
    cfg.set_main_option("script_location", str(Path(__file__).parent / "migrations"))
    # '%' s'ha d'escapar perquè ConfigParser no el prengui per interpolació.
    cfg.set_main_option("sqlalchemy.url", normalize_url(database_url).replace("%", "%%"))
    return cfg


def upgrade(database_url: str, revision: str = "head") -> None:
    command.upgrade(_config(database_url), revision)
