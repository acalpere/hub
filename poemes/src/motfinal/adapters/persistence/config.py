from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def sqlalchemy_url(value: str) -> str:
    if value.startswith("postgres://"):
        return value.replace("postgres://", "postgresql+psycopg://", 1)
    if value.startswith("postgresql://") and "+psycopg" not in value:
        return value.replace("postgresql://", "postgresql+psycopg://", 1)
    return value


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "MotFinal"
    environment: str = "development"
    log_level: str = "INFO"
    database_url: str = "sqlite:///./motfinal.db"
    database_url_unpooled: str | None = None
    semantic_enabled: bool = True
    semantic_provider: Literal["local", "bedrock"] = "local"
    semantic_model: str = "intfloat/multilingual-e5-small"
    bedrock_model_id: str = "cohere.embed-multilingual-v3"
    bedrock_region: str = "eu-west-1"
    semantic_threshold: float = Field(default=0.38, ge=-1, le=1)
    semantic_relative_margin: float = Field(default=0.022, ge=0, le=1)
    semantic_candidate_limit: int = Field(default=1200, ge=100, le=10000)
    access_password_hash: str | None = None
    session_secret: str | None = None
    session_hours: int = Field(default=12, ge=1, le=168)
    definitions_enabled: bool = True
    definitions_timeout: float = Field(default=5.0, gt=0.1, le=10)

    @field_validator("database_url", "database_url_unpooled", mode="before")
    @classmethod
    def normalize_database_url(cls, value: str | None) -> str | None:
        return sqlalchemy_url(value) if value else value

    @property
    def migration_url(self) -> str:
        return self.database_url_unpooled or self.database_url


@lru_cache
def get_settings() -> Settings:
    return Settings()
