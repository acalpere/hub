"""Arrel de composició: l'únic lloc on els ports es connecten amb els adaptadors."""

from __future__ import annotations

from dataclasses import dataclass

from .adapters.crypto import AesGcmCipher, PlainCipher
from .adapters.passkeys import WebAuthnVerifier
from .adapters.persistence.engine import make_session_factory
from .adapters.persistence.repos import (
    SqlAccessRepository,
    SqlAgentRepository,
    SqlCalendarRepository,
    SqlContentRepository,
    SqlInheritanceRepository,
    SqlPasskeyRepository,
    SqlSiteRepository,
    SqlUserRepository,
)
from .application.auth import AuthService
from .application.calendar import CalendarService
from .application.hub import HubService
from .application.inheritance import InheritanceService
from .application.menu import MenuService
from .application.mfa import MfaService
from .config import Settings
from .domain.ports import Cipher
from .security import BcryptHasher, Totp


@dataclass
class Container:
    settings: Settings
    auth: AuthService
    mfa: MfaService
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
    """Còpia amb els secrets (sessió, clau de xifratge) ja llegits d'SSM (si està configurat)."""
    update = {}
    if settings.secret_key_ssm_param:
        update["secret_key"] = _ssm_value(settings, settings.secret_key_ssm_param)
    if settings.data_key_ssm_param:
        update["data_key"] = _ssm_value(settings, settings.data_key_ssm_param)
    return settings.model_copy(update=update) if update else settings


def make_cipher(settings: Settings) -> Cipher:
    if settings.data_key:
        return AesGcmCipher(settings.data_key)
    if settings.env == "local":
        return PlainCipher()  # només en local: sense clau, les dades es desen sense xifrar
    raise RuntimeError("Falta la clau de xifratge de les dades (ACALPERE_DATA_KEY[_SSM_PARAM]).")


def build_container(settings: Settings) -> Container:
    settings = resolved_settings(settings)
    url = database_url(settings)
    if settings.auto_migrate:
        from .migrate import upgrade

        upgrade(settings.database_url_unpooled or url)
    sf = make_session_factory(url)
    sites = SqlSiteRepository(sf)
    users = SqlUserRepository(sf)
    access = SqlAccessRepository(sf)
    contents = SqlContentRepository(sf)
    return Container(
        settings=settings,
        auth=AuthService(users, BcryptHasher()),
        mfa=MfaService(users, Totp(), SqlPasskeyRepository(sf), WebAuthnVerifier()),
        menu=MenuService(contents, access),
        calendar=CalendarService(SqlCalendarRepository(sf)),
        inheritance=InheritanceService(SqlInheritanceRepository(sf, make_cipher(settings))),
        hub=HubService(sites, SqlAgentRepository(sf), access, users, contents),
    )
