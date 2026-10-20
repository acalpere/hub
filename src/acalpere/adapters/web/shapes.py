"""Serialització JSON. Calendari i herència conserven les claus de l'API antiga perquè els
frontends antics funcionin sense canvis; quan es portin a React es podran netejar."""

from __future__ import annotations

from datetime import datetime

from ...application.calendar import Snapshot
from ...domain.calendar import Germa, HistoryEntry, LastModification, Modalitat
from ...domain.hub import Agent, Site
from ...domain.identity import Content, User
from ...domain.inheritance import Fill, Finca, Missatge, Parametres, Pis


def _dt(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _stamp(value: datetime | None) -> str | None:
    """Format 'YYYY-MM-DD HH:MM:SS' que feia servir l'herència."""
    return value.strftime("%Y-%m-%d %H:%M:%S") if value else None


# --- identitat i menú ----------------------------------------------------------------------


def user(u: User) -> dict:
    return {"id": u.id, "username": u.username, "role": u.role, "created_at": _dt(u.created_at)}


def content(c: Content) -> dict:
    return {"id": c.id, "name": c.name, "url": c.url}


# --- calendari -----------------------------------------------------------------------------


def germa(g: Germa) -> dict:
    return {"id": g.id, "nom": g.nom, "codi": g.codi, "color": g.color, "actiu": int(g.actiu)}


def modalitat(m: Modalitat) -> dict:
    return {
        "id": m.id, "nom": m.nom, "codi": m.codi, "descripcio": m.descripcio, "actiu": int(m.actiu),
    }  # fmt: skip


def last_modification(lm: LastModification | None) -> dict | None:
    if lm is None:
        return None
    return {
        "data_modificacio": _dt(lm.data_modificacio),
        "nom_germa": lm.nom_germa,
        "data_assignacio": None,
        "tipus_modificacio": "assignació",
    }


def calendar_snapshot(s: Snapshot) -> dict:
    germans = {g.id: g for g in s.germans}
    modalitats = {m.id: m for m in s.modalitats}
    rows = []
    for a in s.assignacions:
        g, m = germans.get(a.germa_id), modalitats.get(a.modalitat_id)
        if g is None or m is None:  # germà o modalitat desactivats
            continue
        rows.append(
            {
                "id": a.id,
                "data_assignacio": a.data.isoformat(),
                "germa_id": a.germa_id,
                "modalitat_id": a.modalitat_id,
                "creat_per": a.creat_per,
                "modificat_per": a.modificat_per,
                "data_creacio": _dt(a.data_creacio),
                "data_modificacio": _dt(a.data_modificacio),
                "nom_germa": g.nom,
                "nom_modalitat": m.nom,
                "modality_code": m.codi,
            }
        )
    return {
        "success": True,
        "assignments": rows,
        "brothers": [germa(g) for g in s.germans],
        "modalities": [modalitat(m) for m in s.modalitats],
        "last_modification": last_modification(s.last_modification),
    }


def history_entry(h: HistoryEntry) -> dict:
    return {
        "id": h.id,
        "assignacio_id": h.assignacio_id,
        "data_assignacio": h.data.isoformat(),
        "germa_id": h.germa_id,
        "modalitat_id": h.modalitat_id,
        "accio": h.accio,
        "data_canvi": _dt(h.data_canvi),
        "usuari_canvi": h.usuari_id,
        "detalls_canvi": h.detalls,
    }


# --- herència ------------------------------------------------------------------------------


def fill(f: Fill) -> dict:
    return {
        "codi": f.codi,
        "nom": f.nom,
        "comentari": f.comentari,
        "diaIHora": _stamp(f.dia_i_hora),
    }


def finca(f: Finca) -> dict:
    return {
        "codi": f.codi, "nom": f.nom, "taxacio": f.taxacio, "comunitat": f.comunitat,
        "comunitat2": f.comunitat2,
    }  # fmt: skip


def pis(p: Pis, fills: dict[int, Fill], finques: dict[int, Finca]) -> dict:
    return {
        "codi": p.codi,
        "Finques_codi": p.finca_codi,
        "Fills_codi": p.fill_codi,
        "pis": p.pis,
        "porta": p.porta,
        "nom": p.nom,
        "taxacio": p.taxacio,
        "taxacio2": p.taxacio2,
        "rendiment": p.rendiment,
        "rendiment2": p.rendiment2,
        "prorrateig": p.prorrateig,
        "prorrateig2": p.prorrateig2,
        "actual": p.actual,
        "propostapere": p.proposta_pere,
        "propostajordi": p.proposta_jordi,
        "propostarosamaria": p.proposta_rosamaria,
        "nom_fill": fills[p.fill_codi].nom if p.fill_codi in fills else None,
        "nom_finca": finques[p.finca_codi].nom if p.finca_codi in finques else None,
    }


def parametres(p: Parametres | None) -> dict:
    if p is None:
        return {}
    return {
        "codiFill": p.fill_codi,
        "vol": p.vol,
        "valorVol": p.valor_vol,
        "llivia": int(p.llivia),
        "taxacio": str(p.taxacio),
    }


def missatge(m: Missatge) -> dict:
    return {"id": m.id, "autor": m.autor, "text": m.text, "diaIHora": _stamp(m.dia_i_hora)}


# --- hub -----------------------------------------------------------------------------------


def site(s: Site) -> dict:
    return {
        "id": s.id, "name": s.name, "url": s.url, "status": s.status, "notes": s.notes,
        "created_at": _dt(s.created_at),
    }  # fmt: skip


def agent(a: Agent) -> dict:
    return {
        "id": a.id, "name": a.name, "kind": a.kind, "enabled": a.enabled, "site_id": a.site_id,
        "config": a.config, "created_at": _dt(a.created_at),
    }  # fmt: skip
