"""Configuració per variables d'entorn (prefix ACALPERE_) o fitxer .env."""

from __future__ import annotations

from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="ACALPERE_", env_file=".env", extra="ignore")

    env: str = "local"  # local | dev | prod
    database_url: str = Field(
        "sqlite:///./acalpere.db",
        validation_alias=AliasChoices("ACALPERE_DATABASE_URL", "DATABASE_URL"),
    )
    # Connexió directa, sense pooler: és la que convé per a les migracions d'Alembic.
    database_url_unpooled: str | None = Field(
        None,
        validation_alias=AliasChoices("ACALPERE_DATABASE_URL_UNPOOLED", "DATABASE_URL_UNPOOLED"),
    )
    # A AWS, la cadena de connexió de Neon es llegeix de SSM Parameter Store.
    database_url_ssm_param: str | None = None
    auto_migrate: bool = True  # aplica `alembic upgrade head` en arrencar (local i proves)
    secret_key: str = "dev-only-secret-change-me"
    # A AWS, el secret de les sessions també es llegeix de SSM (SecureString).
    secret_key_ssm_param: str | None = None
    session_hours: int = 12
    aws_region: str = "eu-west-1"
    # Origens permesos per CORS (frontend de Vite en local). A AWS tot va pel mateix domini.
    cors_origins: str = ""
    # Domini de les claus d'accés (WebAuthn). Sense valor, es dedueix de l'origen de la petició.
    rp_id: str | None = None
    # Mostra el frontend antic (calendari i herència) tal com era, sobre l'API nova.
    serve_legacy_ui: bool = True

    @property
    def secure_cookies(self) -> bool:
        return self.env != "local"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
