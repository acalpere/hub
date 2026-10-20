"""Errors del domini: els adaptadors d'entrada els tradueixen a codis de resposta."""

from __future__ import annotations


class DomainError(Exception):
    """Base de tots els errors de negoci."""


class NotFound(DomainError):
    pass


class Conflict(DomainError):
    pass


class InvalidInput(DomainError):
    pass


class AuthError(DomainError):
    pass


class Forbidden(DomainError):
    pass
