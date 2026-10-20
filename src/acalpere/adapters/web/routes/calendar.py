from __future__ import annotations

import json
from datetime import date, datetime

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from ....bootstrap import Container
from ....domain.errors import InvalidInput
from .. import shapes
from ..deps import container, current_user

router = APIRouter(tags=["calendari"], dependencies=[Depends(current_user)])


class AssignmentIn(BaseModel):
    date: date
    brother_id: int
    modality_id: int
    action: str = "toggle"  # add | remove | toggle
    remove_modality_id: int | None = None


class RemoveIn(BaseModel):
    date: date
    brother_id: int | None = None


@router.get("/calendar")
def get_calendar(c: Container = Depends(container)):
    return shapes.calendar_snapshot(c.calendar.snapshot())


@router.post("/calendar/assignment")
def manage_assignment(body: AssignmentIn, c: Container = Depends(container)):
    action = c.calendar.apply(
        body.date, body.brother_id, body.modality_id, body.action, body.remove_modality_id
    )
    return {"success": True, "action": action}


# Rutes de compatibilitat de l'aplicació antiga
@router.post("/assignment")
def add_assignment(body: AssignmentIn, c: Container = Depends(container)):
    c.calendar.apply(body.date, body.brother_id, body.modality_id, "add")
    return {"success": True, "action": "added"}


@router.delete("/assignment")
def remove_assignment(body: RemoveIn, c: Container = Depends(container)):
    c.calendar.clear_day(body.date, body.brother_id)
    return {"success": True, "action": "removed"}


@router.get("/calendar/stats")
def stats(c: Container = Depends(container)):
    return {"success": True, "stats": c.calendar.stats()}


@router.get("/calendar/history")
def history(limit: int = 50, c: Container = Depends(container)):
    return {
        "success": True,
        "history": [shapes.history_entry(h) for h in c.calendar.history(limit)],
    }


@router.get("/calendar/export")
def export(c: Container = Depends(container)):
    data = shapes.calendar_snapshot(c.calendar.snapshot())
    data.pop("success")
    data["export_date"] = datetime.now().isoformat()
    name = f"calendari_cura_{datetime.now():%Y%m%d_%H%M%S}.json"
    return JSONResponse(data, headers={"Content-Disposition": f'attachment; filename="{name}"'})


@router.post("/calendar/import")
async def import_calendar(file: UploadFile = File(...), c: Container = Depends(container)):
    if not (file.filename or "").lower().endswith(".json"):
        raise InvalidInput("El fitxer ha de ser en format JSON")
    try:
        data = json.loads(await file.read())
    except ValueError as e:
        raise InvalidInput("Format JSON no vàlid") from e
    for key in ("assignments", "brothers", "modalities"):
        if key not in data:
            raise InvalidInput(f"Clau requerida no trobada: {key}")
    try:
        items = [
            (
                date.fromisoformat(str(a["data_assignacio"])[:10]),
                int(a["germa_id"]),
                int(a["modalitat_id"]),
            )
            for a in data["assignments"]
        ]
    except (KeyError, TypeError, ValueError) as e:
        raise InvalidInput("Assignacions mal formades") from e
    added, skipped = c.calendar.import_assignments(items)
    return {
        "success": True,
        "message": f"Calendari importat: {added} assignacions noves, {skipped} omeses",
        "added": added,
        "skipped": skipped,
    }
