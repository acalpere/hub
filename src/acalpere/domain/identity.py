"""Identitat: usuaris, rols i accés als continguts del menú."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

ADMIN = "admin"
GERMA = "germa"
ROLES = (ADMIN, GERMA)


@dataclass(frozen=True)
class User:
    id: int
    username: str
    password_hash: str
    role: str
    created_at: datetime | None = None

    @property
    def is_admin(self) -> bool:
        return self.role == ADMIN


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
