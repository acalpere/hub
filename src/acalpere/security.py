"""Hash de contrasenyes amb bcrypt. Verifica també els hashes `$2y$` de PHP de la web antiga."""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import struct
import time
from urllib.parse import quote

import bcrypt


class BcryptHasher:
    def hash(self, password: str) -> str:
        return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()

    def verify(self, password: str, stored: str) -> bool:
        try:
            # PHP genera `$2y$`; és el mateix algorisme que `$2b$`.
            return bcrypt.checkpw(password.encode(), stored.replace("$2y$", "$2b$", 1).encode())
        except ValueError:
            return False


def hash_password(password: str) -> str:
    return BcryptHasher().hash(password)


class Totp:
    """TOTP (RFC 6238): 6 xifres, 30 s, tolera un pas de diferència de rellotge."""

    STEP = 30
    DIGITS = 6

    def new_secret(self) -> str:
        return base64.b32encode(secrets.token_bytes(20)).decode()

    def code(self, secret: str, at: float | None = None) -> str:
        counter = int((time.time() if at is None else at) // self.STEP)
        key = base64.b32decode(secret, casefold=True)
        digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
        offset = digest[-1] & 0x0F
        number = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
        return str(number % 10**self.DIGITS).zfill(self.DIGITS)

    def verify(self, secret: str, code: str) -> bool:
        code = code.replace(" ", "")
        now = time.time()
        return any(
            hmac.compare_digest(self.code(secret, now + drift * self.STEP), code)
            for drift in (-1, 0, 1)
        )

    def uri(self, secret: str, username: str) -> str:
        return (
            f"otpauth://totp/acalpere:{quote(username)}?secret={secret}&issuer=acalpere"
            f"&digits={self.DIGITS}&period={self.STEP}"
        )
