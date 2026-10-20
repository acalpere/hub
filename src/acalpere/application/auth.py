"""Alta i autenticació d'usuaris."""

from __future__ import annotations

from dataclasses import replace

from ..domain.errors import AuthError, Conflict, InvalidInput, NotFound
from ..domain.identity import ROLES, User
from ..domain.ports import PasswordHasher, UserRepository

MIN_PASSWORD = 8


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

    def create(self, username: str, password: str, role: str) -> User:
        username = username.strip()
        if not username:
            raise InvalidInput("Cal un nom d'usuari")
        if role not in ROLES:
            raise InvalidInput(f"Rol no vàlid: {role}")
        if len(password) < MIN_PASSWORD:
            raise InvalidInput(f"La clau ha de tenir almenys {MIN_PASSWORD} caràcters")
        if self._users.by_username(username):
            raise Conflict("Aquest usuari ja existeix")
        return self._users.add(username, self._hasher.hash(password), role)

    def set_role(self, username: str, role: str) -> User:
        if role not in ROLES:
            raise InvalidInput(f"Rol no vàlid: {role}")
        user = self._users.by_username(username.strip())
        if user is None:
            raise NotFound("Usuari no trobat")
        self._users.set_role(user.id, role)
        return replace(user, role=role)

    def change_password(self, user_id: int, current: str, new: str) -> None:
        user = self._users.get(user_id)
        if not user or not self._hasher.verify(current, user.password_hash):
            raise AuthError("La clau actual no és correcta.")
        if len(new) < MIN_PASSWORD:
            raise InvalidInput(f"La clau ha de tenir almenys {MIN_PASSWORD} caràcters")
        self._users.set_password(user_id, self._hasher.hash(new))
