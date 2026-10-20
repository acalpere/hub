"""Menú principal: què veu cada rol."""

from __future__ import annotations

from ..domain.identity import Content
from ..domain.ports import ContentRepository


class MenuService:
    def __init__(self, contents: ContentRepository):
        self._contents = contents

    def for_role(self, role: str) -> list[Content]:
        return sorted(
            (c for c in self._contents.list() if c.visible_to(role)),
            key=lambda c: (c.position, c.id),
        )
