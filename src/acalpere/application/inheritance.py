"""Casos d'ús de l'herència."""

from __future__ import annotations

from ..domain.errors import InvalidInput, NotFound
from ..domain.inheritance import (
    PROPOSAL_FIELDS,
    Fill,
    Finca,
    Missatge,
    Parametres,
    Pis,
    repartiment,
)
from ..domain.ports import InheritanceRepository


class InheritanceService:
    def __init__(self, repo: InheritanceRepository):
        self._repo = repo

    def fills(self) -> list[Fill]:
        return self._repo.fills()

    def fill(self, codi: int) -> Fill:
        fill = self._repo.fill(codi)
        if fill is None:
            raise NotFound("Not found")
        return fill

    def seal_all(self) -> int:
        return self._repo.seal_all()

    def finques(self) -> list[Finca]:
        return self._repo.finques()

    def pisos(self) -> list[Pis]:
        return self._repo.pisos()

    def distribution(self) -> dict[int, dict]:
        return repartiment(self._repo.fills(), self._repo.pisos())

    def reassign(self, pis_codi: int, fill_codi: int) -> None:
        if not self._repo.reassign_pis(pis_codi, fill_codi):
            raise NotFound("Pis no trobat")

    def propose(self, pis_codi: int, camp: str, fill_codi: int) -> None:
        attr = PROPOSAL_FIELDS.get(camp)
        if attr is None:
            raise InvalidInput("Camp no vàlid")
        if not self._repo.set_proposal(pis_codi, attr, fill_codi):
            raise NotFound("Pis no trobat")

    def parametres(self, fill_codi: int) -> Parametres | None:
        return self._repo.parametres(fill_codi)

    def save_parametres(self, p: Parametres) -> None:
        if p.taxacio not in (1, 2):
            raise InvalidInput("La taxació ha de ser 1 o 2")
        self._repo.save_parametres(p)

    def set_comentari(self, fill_codi: int, text: str) -> None:
        if not self._repo.set_comentari(fill_codi, text):
            raise NotFound("Not found")

    def chat(self) -> list[Missatge]:
        return self._repo.missatges()

    def post_message(self, autor: str, text: str) -> None:
        autor, text = autor.strip(), text.strip()
        if not autor or not text:
            raise InvalidInput("Falten camps")
        self._repo.add_missatge(autor[:50], text)
