"""Segon factor (TOTP) i claus d'accés (WebAuthn / petjada digital)."""

from __future__ import annotations

from ..domain.errors import AuthError, InvalidInput, NotFound
from ..domain.identity import Passkey, User
from ..domain.ports import PasskeyRepository, PasskeyVerifier, TotpAuthenticator, UserRepository


class MfaService:
    def __init__(
        self,
        users: UserRepository,
        totp: TotpAuthenticator,
        passkeys: PasskeyRepository,
        verifier: PasskeyVerifier,
    ):
        self._users = users
        self._totp = totp
        self._passkeys = passkeys
        self._verifier = verifier

    # TOTP
    def new_totp_secret(self, user: User) -> tuple[str, str]:
        secret = self._totp.new_secret()
        return secret, self._totp.uri(secret, user.username)

    def enable_totp(self, user: User, secret: str, code: str) -> None:
        if not self._totp.verify(secret, code):
            raise AuthError("El codi no és correcte.")
        self._users.set_totp_secret(user.id, secret)

    def check_totp(self, user: User, code: str) -> None:
        if not user.totp_secret or not self._totp.verify(user.totp_secret, code):
            raise AuthError("El codi no és correcte.")

    def reset_totp(self, username: str) -> None:
        user = self._users.by_username(username.strip())
        if user is None:
            raise NotFound("Usuari no trobat")
        self._users.set_totp_secret(user.id, None)

    # claus d'accés
    def passkeys(self, user: User) -> list[Passkey]:
        return self._passkeys.for_user(user.id)

    def registration_options(self, user: User, rp_id: str) -> tuple[dict, bytes]:
        existing = [p.credential_id for p in self._passkeys.for_user(user.id)]
        return self._verifier.registration_options(rp_id, user.id, user.username, existing)

    def register_passkey(
        self, user: User, response: dict, challenge: bytes, rp_id: str, origin: str, label: str
    ) -> Passkey:
        cred = self._verifier.verify_registration(response, challenge, rp_id, origin)
        label = label.strip()[:80] or "Aquest dispositiu"
        return self._passkeys.add(
            Passkey(None, user.id, cred.credential_id, cred.public_key, cred.sign_count, label)
        )

    def delete_passkey(self, user: User, passkey_id: int) -> None:
        if not self._passkeys.delete(user.id, passkey_id):
            raise NotFound("Clau d'accés no trobada")

    def authentication_options(self, rp_id: str) -> tuple[dict, bytes]:
        return self._verifier.authentication_options(rp_id)

    def login_with_passkey(self, response: dict, challenge: bytes, rp_id: str, origin: str) -> User:
        passkey = self._passkeys.by_credential_id(self._verifier.credential_id(response))
        user = self._users.get(passkey.user_id) if passkey else None
        if passkey is None or user is None:
            raise AuthError("Clau d'accés desconeguda.")
        count = self._verifier.verify_authentication(response, challenge, rp_id, origin, passkey)
        self._passkeys.set_sign_count(passkey.id, count)
        return user


def require_code(code: str) -> str:
    code = code.strip()
    if not code:
        raise InvalidInput("Cal el codi")
    return code
