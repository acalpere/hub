"""Casos d'ús del calendari de cura."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date

from ..domain.calendar import (
    Assignacio,
    Germa,
    HistoryEntry,
    LastModification,
    Modalitat,
    check_can_add,
)
from ..domain.errors import Conflict, InvalidInput, NotFound
from ..domain.ports import CalendarRepository

ACTIONS = ("toggle", "add", "remove")


@dataclass(frozen=True)
class Snapshot:
    assignacions: list[Assignacio]
    germans: list[Germa]
    modalitats: list[Modalitat]
    last_modification: LastModification | None


class CalendarService:
    def __init__(self, repo: CalendarRepository):
        self._repo = repo

    def snapshot(self) -> Snapshot:
        return Snapshot(
            self._repo.assignacions(),
            self._repo.germans(),
            self._repo.modalitats(),
            self._repo.last_modification(),
        )

    def apply(
        self,
        day: date,
        germa_id: int,
        modalitat_id: int,
        action: str = "toggle",
        remove_modalitat_id: int | None = None,
    ) -> str:
        """Afegeix o treu una assignació. Retorna 'added' o 'removed'."""
        if action not in ACTIONS:
            raise InvalidInput("Acció no vàlida")
        existing = self._repo.assignacions_on(day)
        if action == "toggle":
            mine = [a for a in existing if a.germa_id == germa_id]
            if mine:
                self._remove(mine, germa_id)
                return "removed"
            action = "add"
        if action == "add":
            self._add(day, germa_id, modalitat_id, existing)
            return "added"
        if not existing:
            raise NotFound("No hi ha assignació per eliminar")
        if remove_modalitat_id is not None:
            targets = [
                a
                for a in existing
                if a.germa_id == germa_id and a.modalitat_id == remove_modalitat_id
            ]
        elif len(existing) > 1:
            targets = [a for a in existing if a.germa_id == germa_id]
        else:
            targets = existing  # un sol germà aquell dia: qualsevol pot desfer-ho
        if not targets:
            raise NotFound("No hi ha assignació per eliminar")
        self._remove(targets, germa_id)
        return "removed"

    def _add(self, day: date, germa_id: int, modalitat_id: int, existing: list[Assignacio]) -> None:
        modalitats = {m.id: m for m in self._repo.modalitats()}
        if germa_id not in {g.id for g in self._repo.germans()}:
            raise NotFound("Germà no trobat")
        if modalitat_id not in modalitats:
            raise NotFound("Modalitat no trobada")
        check_can_add(existing, modalitats, germa_id, modalitat_id)
        entry = HistoryEntry("INSERT", day, germa_id, modalitat_id, usuari_id=germa_id)
        self._repo.add(Assignacio(None, day, germa_id, modalitat_id, creat_per=germa_id), entry)

    def _remove(self, targets: list[Assignacio], by: int | None) -> None:
        if not self._repo.remove(targets, by, "Eliminada"):
            raise Conflict("No s'ha pogut eliminar l'assignació")

    def clear_day(self, day: date, germa_id: int | None = None) -> None:
        """Buida un dia (o només les assignacions d'un germà)."""
        existing = self._repo.assignacions_on(day)
        targets = [a for a in existing if germa_id is None or a.germa_id == germa_id]
        if not targets:
            raise NotFound("No hi ha assignació per eliminar")
        self._remove(targets, germa_id)

    def stats(self) -> list[dict]:
        germans = {g.id: g for g in self._repo.germans()}
        modalitats = {m.id: m for m in self._repo.modalitats()}
        groups: dict[tuple[int, int], list[date]] = defaultdict(list)
        for a in self._repo.assignacions():
            groups[(a.germa_id, a.modalitat_id)].append(a.data)
        rows = []
        for (gid, mid), days in groups.items():
            if gid in germans and mid in modalitats:
                rows.append(
                    {
                        "germa_nom": germans[gid].nom,
                        "modalitat_nom": modalitats[mid].nom,
                        "total_assignacions": len(days),
                        "primera_assignacio": min(days).isoformat(),
                        "ultima_assignacio": max(days).isoformat(),
                    }
                )
        return sorted(rows, key=lambda r: (r["germa_nom"], r["modalitat_nom"]))

    def history(self, limit: int = 50) -> list[HistoryEntry]:
        return self._repo.history(max(1, min(limit, 500)))

    def import_assignments(self, items: list[tuple[date, int, int]]) -> tuple[int, int]:
        """Importa (dia, germà, modalitat). Les que no compleixen les regles s'ometen."""
        added = skipped = 0
        for day, germa_id, modalitat_id in items:
            try:
                self._add(day, germa_id, modalitat_id, self._repo.assignacions_on(day))
                added += 1
            except (Conflict, NotFound):
                skipped += 1
        return added, skipped
