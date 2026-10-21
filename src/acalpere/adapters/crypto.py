"""Xifratge de dades en repòs (AES-256-GCM). La clau viu fora de la base de dades (SSM a AWS)."""

from __future__ import annotations

import base64
import os

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

PREFIX = "v1."


class AesGcmCipher:
    """`context` (la taula) s'autentica amb el text: un valor xifrat no es pot canviar de taula."""

    def __init__(self, key_b64: str):
        key = base64.b64decode(key_b64)
        if len(key) != 32:
            raise ValueError("La clau de xifratge ha de ser de 32 bytes (en base64).")
        self._aes = AESGCM(key)

    def encrypt(self, plaintext: str, context: str) -> str:
        nonce = os.urandom(12)
        data = self._aes.encrypt(nonce, plaintext.encode(), context.encode())
        return PREFIX + base64.urlsafe_b64encode(nonce + data).decode()

    def decrypt(self, token: str, context: str) -> str:
        if not token.startswith(PREFIX):
            raise ValueError("Format de xifratge desconegut.")
        raw = base64.urlsafe_b64decode(token[len(PREFIX) :])
        try:
            return self._aes.decrypt(raw[:12], raw[12:], context.encode()).decode()
        except InvalidTag as e:
            raise ValueError("No s'ha pogut desxifrar: clau incorrecta o dada alterada.") from e


class PlainCipher:
    """Sense xifrar: només per a desenvolupament local i proves sense clau."""

    def encrypt(self, plaintext: str, context: str) -> str:
        return plaintext

    def decrypt(self, token: str, context: str) -> str:
        return token


def new_key() -> str:
    return base64.b64encode(os.urandom(32)).decode()
