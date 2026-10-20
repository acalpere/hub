"""Menú principal: què veu cada rol."""

from __future__ import annotations

from ..domain.identity import Content, User
from ..domain.ports import AccessRepository, ContentRepository


class MenuService:
    def __init__(self, contents: ContentRepository, access: AccessRepository):
        self._contents = contents
        self._access = access

    def all(self) -> list[Content]:
        return sorted(self._contents.list(), key=lambda c: (c.position, c.id))

    def for_user(self, user: User) -> list[Content]:
        """Admin: tot. La resta: el que li toca pel rol més el que se li ha autoritzat."""
        if user.is_admin:
            return self.all()
        granted = self._access.get(user.id).content_ids
        return [c for c in self.all() if c.visible_to(user.role) or c.id in granted]

    def can_open(self, user: User, url: str) -> bool:
        return any(c.url == url for c in self.for_user(user))
