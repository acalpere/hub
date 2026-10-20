"""Hash de contrasenyes amb bcrypt. Verifica també els hashes `$2y$` de PHP de la web antiga."""

from __future__ import annotations

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
