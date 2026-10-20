"""Alta i autenticació d'usuaris."""

from __future__ import annotations

import re
from dataclasses import replace

from ..domain.errors import AuthError, Conflict, InvalidInput, NotFound
from ..domain.identity import ADMIN, ROLES, Profile, User
from ..domain.ports import PasswordHasher, UserRepository

MIN_PASSWORD = 8
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_PHONE = re.compile(r"^\+?[0-9 ().-]{6,25}$")


def _clean_profile(first_name: str, last_name: str, email: str, phone: str) -> Profile:
    first_name, last_name = first_name.strip(), last_name.strip()
    email, phone = email.strip(), phone.strip()
    if email and not _EMAIL.match(email):
        raise InvalidInput("El correu electrònic no és vàlid")
    if phone and not _PHONE.match(phone):
        raise InvalidInput("El telèfon no és vàlid")
    return Profile(first_name, last_name, email, phone)


class AuthService:
    def __init__(self, users: UserRepository, hasher: PasswordHasher):
        self._users = users
        self._hasher = hasher
        # Es verifica contra aquest hash si l'usuari no existeix, perquè el temps de resposta
        # no delati quins noms d'usuari són vàlids.
        self._decoy = hasher.hash("decoy-password")

    def login(self, username: str, password: str) -> User:
        username, password = username.strip(), password.strip()
        if not username or not password:
            raise AuthError("Usuari i clau són requerits.")
        user = self._users.by_username(username)
        ok = self._hasher.verify(password, user.password_hash if user else self._decoy)
        if not user or not ok:
            raise AuthError("Usuari o clau incorrectes.")
        return user

    def get(self, user_id: int) -> User | None:
        return self._users.get(user_id)

    def list_users(self) -> list[User]:
        return self._users.list()

    def create(
        self,
        username: str,
        password: str,
        role: str,
        first_name: str = "",
        last_name: str = "",
        email: str = "",
        phone: str = "",
    ) -> User:
        username = username.strip()
        if not username:
            raise InvalidInput("Cal un nom d'usuari")
        if role not in ROLES:
            raise InvalidInput(f"Rol no vàlid: {role}")
        if len(password) < MIN_PASSWORD:
            raise InvalidInput(f"La clau ha de tenir almenys {MIN_PASSWORD} caràcters")
        if self._users.by_username(username):
            raise Conflict("Aquest usuari ja existeix")
        profile = _clean_profile(first_name, last_name, email, phone)
        return self._users.add(username, self._hasher.hash(password), role, profile)

    def update_user(
        self,
        user_id: int,
        username: str,
        role: str,
        first_name: str,
        last_name: str,
        email: str,
        phone: str,
    ) -> User:
        user = self._users.get(user_id)
        if user is None:
            raise NotFound("Usuari no trobat")
        username = username.strip()
        if not username:
            raise InvalidInput("Cal un nom d'usuari")
        if role not in ROLES:
            raise InvalidInput(f"Rol no vàlid: {role}")
        other = self._users.by_username(username)
        if other and other.id != user_id:
            raise Conflict("Aquest usuari ja existeix")
        if user.role == ADMIN and role != ADMIN:
            admins = [u for u in self._users.list() if u.role == ADMIN]
            if len(admins) <= 1:
                raise InvalidInput("Ha de quedar com a mínim un administrador")
        profile = _clean_profile(first_name, last_name, email, phone)
        self._users.update(user_id, username, role, profile)
        return self._users.get(user_id)  # type: ignore[return-value]

    def set_role(self, username: str, role: str) -> User:
        if role not in ROLES:
            raise InvalidInput(f"Rol no vàlid: {role}")
        user = self._users.by_username(username.strip())
        if user is None:
            raise NotFound("Usuari no trobat")
        self._users.set_role(user.id, role)
        return replace(user, role=role)

    def reset_password(self, username: str, new: str) -> User:
        """Restabliment d'administrador (des de la CLI): no demana la clau actual."""
        user = self._users.by_username(username.strip())
        if user is None:
            raise NotFound("Usuari no trobat")
        if len(new) < MIN_PASSWORD:
            raise InvalidInput(f"La clau ha de tenir almenys {MIN_PASSWORD} caràcters")
        self._users.set_password(user.id, self._hasher.hash(new))
        return user

    def change_password(self, user_id: int, current: str, new: str) -> None:
        user = self._users.get(user_id)
        if not user or not self._hasher.verify(current, user.password_hash):
            raise AuthError("La clau actual no és correcta.")
        if len(new) < MIN_PASSWORD:
            raise InvalidInput(f"La clau ha de tenir almenys {MIN_PASSWORD} caràcters")
        self._users.set_password(user_id, self._hasher.hash(new))
