from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from ....bootstrap import Container
from ....domain.cyrano import Line
from ....domain.identity import User
from ..deps import admin_user, app_access, container

router = APIRouter(prefix="/cyrano", tags=["cyrano"], dependencies=[Depends(app_access("/cyrano"))])


class RestoreIn(BaseModel):
    revision_id: int


class LineIn(BaseModel):
    speaker: str | None = Field(default=None, max_length=80)
    kind: str = Field(max_length=10)
    stamp: str | None = Field(default=None, max_length=10)
    text: str = Field(max_length=4000)


def _line(line: Line) -> dict:
    return {
        "id": line.id,
        "act": line.act,
        "scene": line.scene,
        "kind": line.kind,
        "speaker": line.speaker,
        "stamp": line.stamp,
        "text": line.text,
    }


@router.get("/outline")
def outline(c: Container = Depends(container)):
    return {"acts": c.cyrano.outline(), "speakers": c.cyrano.speakers()}


@router.get("/text")
def text(c: Container = Depends(container)):
    """Tota l'obra, per llegir-la sense pàgines."""
    return [_line(line) for line in c.cyrano.export_lines()]


@router.get("/video")
def video(c: Container = Depends(container)):
    """Adreça per reproduir el vídeo (a AWS, un enllaç signat temporal), si ja s'ha pujat."""
    url = c.cyrano.video_url()
    return {"available": url is not None, "url": url}


@router.get("/video/file")
def video_file(c: Container = Depends(container)):
    """Només en local: serveix el fitxer de la carpeta de multimèdia (admet salts amb Range)."""
    path = c.cyrano.video_file()
    if path is None:
        raise HTTPException(status_code=404, detail="Vídeo no trobat")
    # Mateixa adreça sempre: sense això el navegador pot ensenyar una còpia vella.
    return FileResponse(path, media_type="video/mp4", headers={"Cache-Control": "no-cache"})


@router.get("/pdf")
def pdf(c: Container = Depends(container)):
    """Baixada de l'obra en PDF (enllaç directe: la sessió va a la galeta)."""
    return Response(
        c.cyrano.pdf(),
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="Cyrano-de-Bergerac.pdf"'},
    )


@router.get("/scenes/{act}/{scene}")
def scene(act: int, scene: int, c: Container = Depends(container)):
    return [_line(line) for line in c.cyrano.scene(act, scene)]


@router.get("/search")
def search(
    q: str = Query(default="", max_length=200),
    speaker: str = Query(default="", max_length=80),
    c: Container = Depends(container),
):
    lines = c.cyrano.search(q, speaker)
    return {"results": [_line(line) for line in lines], "truncated": len(lines) >= 300}


@router.put("/lines/{line_id}")
def edit(
    line_id: int,
    body: LineIn,
    user: User = Depends(admin_user),
    c: Container = Depends(container),
):
    return _line(
        c.cyrano.edit(line_id, body.speaker, body.kind, body.text, body.stamp, user.username)
    )


@router.post("/lines/{line_id}/insert")
def insert(
    line_id: int,
    body: LineIn,
    user: User = Depends(admin_user),
    c: Container = Depends(container),
):
    """Línia nova just a sota de la indicada (acotació, text o rèplica entre dues rèpliques)."""
    return _line(
        c.cyrano.insert_after(
            line_id, body.speaker, body.kind, body.text, body.stamp, user.username
        )
    )


@router.delete("/lines/{line_id}")
def remove(line_id: int, _: User = Depends(admin_user), c: Container = Depends(container)):
    c.cyrano.delete(line_id)
    return {"ok": True}


@router.get("/lines/{line_id}/history")
def history(line_id: int, _: User = Depends(admin_user), c: Container = Depends(container)):
    return [
        {
            "id": r.id,
            "speaker": r.speaker,
            "kind": r.kind,
            "text": r.text,
            "stamp": r.stamp,
            "edited_by": r.edited_by,
            "edited_at": r.edited_at.isoformat() if r.edited_at else None,
        }
        for r in c.cyrano.history(line_id)
    ]


@router.post("/lines/{line_id}/restore")
def restore(
    line_id: int,
    body: RestoreIn,
    user: User = Depends(admin_user),
    c: Container = Depends(container),
):
    return _line(c.cyrano.restore(line_id, body.revision_id, user.username))
