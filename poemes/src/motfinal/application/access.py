from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import time
from collections.abc import Callable

_N, _R, _P = 2**14, 8, 1


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=_N, r=_R, p=_P)
    return f"scrypt${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, salt_hex, digest_hex = stored.split("$")
        if scheme != "scrypt":
            return False
        digest = hashlib.scrypt(
            password.encode(), salt=bytes.fromhex(salt_hex), n=_N, r=_R, p=_P
        )
        return hmac.compare_digest(digest, bytes.fromhex(digest_hex))
    except ValueError:
        return False


class AccessControl:
    """Una sola contrasenya per protegir els poemes; la sessió és un testimoni signat."""

    def __init__(
        self,
        password_hash: str | None,
        secret: str | None,
        ttl_seconds: int = 12 * 3600,
        clock: Callable[[], float] = time.time,
    ) -> None:
        self._password_hash = password_hash
        self._secret = (secret or "").encode()
        self._ttl = ttl_seconds
        self._clock = clock

    @property
    def configured(self) -> bool:
        return bool(self._password_hash and self._secret)

    def login(self, password: str) -> str | None:
        if not self.configured or not verify_password(password, self._password_hash or ""):
            return None
        expires = str(int(self._clock()) + self._ttl)
        return f"{expires}.{self._sign(expires)}"

    def is_valid(self, token: str | None) -> bool:
        if not self.configured or not token or "." not in token:
            return False
        expires, signature = token.split(".", 1)
        if not hmac.compare_digest(signature, self._sign(expires)):
            return False
        return expires.isdigit() and int(expires) > self._clock()

    def _sign(self, value: str) -> str:
        mac = hmac.new(self._secret, value.encode(), hashlib.sha256).digest()
        return base64.urlsafe_b64encode(mac).decode().rstrip("=")
