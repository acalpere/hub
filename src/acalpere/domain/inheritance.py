"""Herència: pisos i finques repartits entre els fills, propostes i xat."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

# Camp d'entrada de l'API -> atribut de Pis. Només aquests es poden escriure.
PROPOSAL_FIELDS = {
    "propostapere": "proposta_pere",
    "propostajordi": "proposta_jordi",
    "propostarosamaria": "proposta_rosamaria",
}


@dataclass(frozen=True)
class Fill:
    codi: int
    nom: str | None
    comentari: str = ""
    dia_i_hora: datetime | None = None


@dataclass(frozen=True)
class Finca:
    codi: int
    nom: str | None
    taxacio: int | None = None
    comunitat: int | None = None
    comunitat2: int = 0


@dataclass(frozen=True)
class Pis:
    codi: int
    finca_codi: int
    fill_codi: int
    nom: str
    pis: str | None = None
    porta: str | None = None
    taxacio: int | None = None
    taxacio2: int = 0
    rendiment: int | None = None
    rendiment2: int = 0
    prorrateig: int = 0
    prorrateig2: int = 0
    actual: int = 0
    proposta_pere: int = 0
    proposta_jordi: int = 0
    proposta_rosamaria: int = 0


@dataclass(frozen=True)
class Parametres:
    fill_codi: int
    vol: int
    valor_vol: int
    llivia: bool
    taxacio: int = 1  # 1 o 2: quina taxació s'aplica


@dataclass(frozen=True)
class Missatge:
    id: int | None
    autor: str
    text: str
    dia_i_hora: datetime | None = None


def repartiment(fills: list[Fill], pisos: list[Pis]) -> dict[int, dict]:
    """Patrimoni (suma de taxacions) i rendiment (suma de rendiments) que té cada fill."""
    result = {f.codi: {"nom": f.nom, "patrimoni": 0, "rendiment": 0} for f in fills}
    for p in pisos:
        if p.fill_codi in result:
            result[p.fill_codi]["patrimoni"] += p.taxacio or 0
            result[p.fill_codi]["rendiment"] += p.rendiment or 0
    return result
