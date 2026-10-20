"""Identitat: usuaris, rols i accés als continguts del menú."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

ADMIN = "admin"
GERMA = "germa"
USUARI = "usuari"  # sense res per defecte: només el que l'administrador li autoritzi
ROLES = (ADMIN, GERMA, USUARI)


@dataclass(frozen=True)
class User:
    id: int
    username: str
    password_hash: str
    role: str
    created_at: datetime | None = None
    totp_secret: str | None = None  # secret base32 de l'aplicació d'autenticació (MFA)
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    phone: str | None = None

    @property
    def is_admin(self) -> bool:
        return self.role == ADMIN


@dataclass(frozen=True)
class Profile:
    """Dades personals d'un usuari (a més del nom d'usuari amb què entra)."""

    first_name: str = ""
    last_name: str = ""
    email: str = ""
    phone: str = ""


@dataclass(frozen=True)
class Passkey:
    """Clau d'accés (WebAuthn) d'un usuari: p. ex. la petjada digital del mòbil."""

    id: int | None
    user_id: int
    credential_id: str  # base64url
    public_key: str  # base64url del COSE
    sign_count: int = 0
    label: str = ""
    created_at: datetime | None = None


@dataclass(frozen=True)
class PasskeyCredential:
    """Resultat de verificar un registre de clau d'accés."""

    credential_id: str
    public_key: str
    sign_count: int


@dataclass(frozen=True)
class Content:
    """Entrada del menú principal: una app o secció, visible només per a certs rols."""

    id: int
    name: str
    url: str
    roles: tuple[str, ...]
    position: int = 0

    def visible_to(self, role: str) -> bool:
        return role in self.roles
