from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ....bootstrap import Container
from ....domain.inheritance import Parametres
from .. import shapes
from ..deps import app_access, container, recent_verification

router = APIRouter(
    prefix="/herencia",
    tags=["herència"],
    dependencies=[Depends(app_access("/apps/herencia/")), Depends(recent_verification)],
)


class ReassignIn(BaseModel):
    pis_id: int
    nou_fill_id: int


class ProposalIn(BaseModel):
    pis_id: int
    camp: str
    fill_id: int
    codi_fill: int | None = None
    llivia: int | None = None
    vol: int | None = None
    taxacio: int | None = None
    valorVol: int | None = None


class CommentIn(BaseModel):
    comentari: str = ""


class MessageIn(BaseModel):
    autor: str = Field(default="", max_length=50)
    text: str = Field(default="", max_length=4000)


@router.get("/fills")
def fills(c: Container = Depends(container)):
    return [shapes.fill(f) for f in c.inheritance.fills()]


@router.get("/fills/{fill_id}")
def fill(fill_id: int, c: Container = Depends(container)):
    f = c.inheritance.fill(fill_id)
    return {
        "codi": f.codi,
        "nom": f.nom,
        "comentari": f.comentari,
        "diaIHora": shapes.fill(f)["diaIHora"] or "",
    }


@router.post("/fills/{fill_id}/comentari")
def comment(fill_id: int, body: CommentIn, c: Container = Depends(container)):
    c.inheritance.set_comentari(fill_id, body.comentari)
    return {"status": "ok"}


@router.get("/finques")
def finques(c: Container = Depends(container)):
    return [shapes.finca(f) for f in c.inheritance.finques()]


@router.get("/pisos")
def pisos(c: Container = Depends(container)):
    fills = {f.codi: f for f in c.inheritance.fills()}
    finques = {f.codi: f for f in c.inheritance.finques()}
    return [shapes.pis(p, fills, finques) for p in c.inheritance.pisos()]


@router.get("/repartiment")
def repartiment(c: Container = Depends(container)):
    return c.inheritance.distribution()


@router.post("/reassignar_pis")
def reassign(body: ReassignIn, c: Container = Depends(container)):
    c.inheritance.reassign(body.pis_id, body.nou_fill_id)
    return {"status": "ok"}


@router.post("/guardar_proposta")
def save_proposal(body: ProposalIn, c: Container = Depends(container)):
    c.inheritance.propose(body.pis_id, body.camp, body.fill_id)
    if None not in (body.codi_fill, body.llivia, body.vol, body.taxacio):
        c.inheritance.save_parametres(
            Parametres(
                fill_codi=body.codi_fill,
                vol=body.vol,
                valor_vol=body.valorVol or 0,
                llivia=bool(body.llivia),
                taxacio=body.taxacio,
            )
        )
    return {"status": "ok"}


@router.get("/parametres/{fill_codi}")
def parametres(fill_codi: int, c: Container = Depends(container)):
    return shapes.parametres(c.inheritance.parametres(fill_codi))


@router.get("/xat")
def chat(c: Container = Depends(container)):
    return [shapes.missatge(m) for m in c.inheritance.chat()]


@router.post("/xat")
def post_message(body: MessageIn, c: Container = Depends(container)):
    c.inheritance.post_message(body.autor, body.text)
    return {"status": "ok"}
