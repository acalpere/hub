"""Calendari de cura de la mare: qui és al poble o a casa de la mare cada dia."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime

from .errors import Conflict

POBLE = "poble"
CASA = "casa"


@dataclass(frozen=True)
class Germa:
    id: int
    nom: str
    codi: str
    color: str
    actiu: bool = True


@dataclass(frozen=True)
class Modalitat:
    id: int
    nom: str
    codi: str
    descripcio: str | None = None
    actiu: bool = True


@dataclass(frozen=True)
class Assignacio:
    id: int | None
    data: date
    germa_id: int
    modalitat_id: int
    creat_per: int | None = None
    modificat_per: int | None = None
    data_creacio: datetime | None = None
    data_modificacio: datetime | None = None


@dataclass(frozen=True)
class HistoryEntry:
    accio: str  # INSERT | UPDATE | DELETE
    data: date
    germa_id: int
    modalitat_id: int
    assignacio_id: int | None = None
    usuari_id: int | None = None
    detalls: str | None = None
    id: int | None = None
    data_canvi: datetime | None = None


@dataclass(frozen=True)
class LastModification:
    data_modificacio: datetime
    nom_germa: str


def check_can_add(
    existing: list[Assignacio],
    modalitats: dict[int, Modalitat],
    germa_id: int,
    modalitat_id: int,
) -> None:
    """Regles d'un dia: només una persona a casa, i a casa ningú més; al poble, tants com calgui.

    Llança Conflict amb el mateix missatge que mostrava l'aplicació antiga.
    """
    if any(a.germa_id == germa_id and a.modalitat_id == modalitat_id for a in existing):
        raise Conflict("Aquesta assignació ja existeix")
    if not existing:
        return
    new = modalitats.get(modalitat_id)
    if new is None:
        raise Conflict("Modalitat no trobada")
    codes = [m.codi for a in existing if (m := modalitats.get(a.modalitat_id))]
    if CASA in codes:
        raise Conflict("No es pot assignar res més quan hi ha algú a casa")
    if new.codi == POBLE:
        if any(a.germa_id == germa_id for a in existing):
            raise Conflict("Aquest germà ja està assignat aquest dia")
        return
    if new.codi == CASA:
        if POBLE in codes:
            raise Conflict("No es pot estar a casa si hi ha gent al poble")
        return
    raise Conflict("Modalitat no reconeguda")
