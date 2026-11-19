"""API dels versos: tothom en pot veure un d'aleatori; només l'administrador els gestiona."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ....bootstrap import Container
from .. import shapes
from ..deps import admin_user, container, current_user

router = APIRouter(prefix="/verses", tags=["versos"])
admin = [Depends(admin_user)]


class VerseIn(BaseModel):
    text: str = Field(max_length=2000)


class SettingsIn(BaseModel):
    max_length: int
    font_large: float
    font_small: float


@router.get("/settings", dependencies=[Depends(current_user)])
def get_settings(c: Container = Depends(container)):
    return shapes.verse_settings(c.verses.settings())


@router.put("/settings", dependencies=admin)
def put_settings(body: SettingsIn, c: Container = Depends(container)):
    return shapes.verse_settings(
        c.verses.update_settings(body.max_length, body.font_large, body.font_small)
    )


@router.get("/random", dependencies=[Depends(current_user)])
def random_verse(exclude: int | None = None, c: Container = Depends(container)):
    verse = c.verses.random(exclude)
    return shapes.verse(verse) if verse else None


@router.get("", dependencies=admin)
def verses(c: Container = Depends(container)):
    return [shapes.verse(v) for v in c.verses.list()]


@router.post("", status_code=201, dependencies=admin)
def create_verse(body: VerseIn, c: Container = Depends(container)):
    return shapes.verse(c.verses.create(body.text))


@router.put("/{verse_id}", dependencies=admin)
def update_verse(verse_id: int, body: VerseIn, c: Container = Depends(container)):
    return shapes.verse(c.verses.update(verse_id, body.text))


@router.delete("/{verse_id}", status_code=204, dependencies=admin)
def delete_verse(verse_id: int, c: Container = Depends(container)):
    c.verses.delete(verse_id)
