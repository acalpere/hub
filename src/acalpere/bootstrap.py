"""Arrel de composició: l'únic lloc on els ports es connecten amb els adaptadors."""

from __future__ import annotations

from dataclasses import dataclass

from .adapters.persistence.engine import make_session_factory
from .adapters.persistence.repos import (
    SqlAgentRepository,
    SqlCalendarRepository,
    SqlContentRepository,
    SqlInheritanceRepository,
    SqlSiteRepository,
    SqlUserRepository,
)
from .application.auth import AuthService
from .application.calendar import CalendarService
from .application.hub import HubService
from .application.inheritance import InheritanceService
from .application.menu import MenuService
from .config import Settings
from .security import BcryptHasher


@dataclass
class Container:
    settings: Settings
    auth: AuthService
    menu: MenuService
    calendar: CalendarService
    inheritance: InheritanceService
    hub: HubService


def _ssm_value(settings: Settings, name: str) -> str:
    import boto3

    ssm = boto3.client("ssm", region_name=settings.aws_region)
    return ssm.get_parameter(Name=name, WithDecryption=True)["Parameter"]["Value"]


def database_url(settings: Settings) -> str:
    if settings.database_url_ssm_param:
        return _ssm_value(settings, settings.database_url_ssm_param)
    return settings.database_url


def resolved_settings(settings: Settings) -> Settings:
    """Còpia amb el secret de sessió ja llegit d'SSM (si està configurat)."""
    if settings.secret_key_ssm_param:
        return settings.model_copy(
            update={"secret_key": _ssm_value(settings, settings.secret_key_ssm_param)}
        )
    return settings


def build_container(settings: Settings) -> Container:
    settings = resolved_settings(settings)
    url = database_url(settings)
    if settings.auto_migrate:
        from .migrate import upgrade

        upgrade(settings.database_url_unpooled or url)
    sf = make_session_factory(url)
    sites = SqlSiteRepository(sf)
    return Container(
        settings=settings,
        auth=AuthService(SqlUserRepository(sf), BcryptHasher()),
        menu=MenuService(SqlContentRepository(sf)),
        calendar=CalendarService(SqlCalendarRepository(sf)),
        inheritance=InheritanceService(SqlInheritanceRepository(sf)),
        hub=HubService(sites, SqlAgentRepository(sf)),
    )
