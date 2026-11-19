"""Apunts d'AWS: necessitats creades amb el tutor i nivell de coneixement de cada fitxa."""

from __future__ import annotations

import json

from ..domain.aws import LEVELS, CustomNeed, SavedAnswer
from ..domain.errors import Conflict, InvalidInput, NotFound, Unavailable
from ..domain.ports import MarkRepository, NeedRepository, SavedRepository, Tutor

MAX_NAME = 80
KEY_PREFIXES = ("need:", "service:", "arch:")


class AwsNotesService:
    def __init__(
        self,
        needs: NeedRepository,
        marks: MarkRepository,
        tutor: Tutor,
        saved: SavedRepository,
    ):
        self._saved = saved
        self._needs = needs
        self._marks = marks
        self._tutor = tutor

    # necessitats
    def needs(self) -> list[CustomNeed]:
        return self._needs.list()

    def create_need(self, name: str) -> CustomNeed:
        """Una necessitat nova: el tutor n'omple la fitxa (frase, explicació i serveis)."""
        name = " ".join(name.split())
        if len(name) < 3:
            raise InvalidInput("Escriu el nom de la necessitat")
        if len(name) > MAX_NAME:
            raise InvalidInput(f"El nom no pot passar dels {MAX_NAME} caràcters")
        if any(n.name.casefold() == name.casefold() for n in self._needs.list()):
            raise Conflict("Ja tens una necessitat amb aquest nom")
        prompt = (
            f"Una empresa té aquesta necessitat d'arquitectura: «{name}». Prepara'n una fitxa "
            "d'estudi: una frase curta que la resumeixi, una explicació de 2 a 3 frases i entre 4 "
            "i 7 serveis d'AWS que hi ajudin, cadascun amb el motiu concret en una frase. Usa els "
            "noms oficials dels serveis. Respon NOMÉS amb un objecte JSON, sense res més: "
            '{"frase": "...", "explicacio": "...", "serveis": [{"nom": "...", "per_que": "..."}]}'
        )
        raw = self._tutor.answer("AWS", "necessitat nova", prompt, [], max_tokens=1800)
        tagline, what, services = self._parse(raw)
        return self._needs.add(CustomNeed(None, name, tagline, what, services))

    def delete_need(self, need_id: int) -> None:
        if not self._needs.delete(need_id):
            raise NotFound("Necessitat no trobada")

    @staticmethod
    def _parse(raw: str) -> tuple[str, str, list[dict]]:
        start, end = raw.find("{"), raw.rfind("}")
        try:
            data = json.loads(raw[start : end + 1])
            tagline, what = str(data["frase"]).strip(), str(data["explicacio"]).strip()
            services = [
                {"name": str(s["nom"]).strip()[:100], "why": str(s["per_que"]).strip()[:400]}
                for s in data["serveis"]
                if str(s["nom"]).strip() and str(s["per_que"]).strip()
            ]
        except (ValueError, KeyError, TypeError):
            tagline, what, services = "", "", []
        if not tagline or not what or not services:
            raise Unavailable("No he pogut preparar la fitxa. Torna-ho a provar.")
        return tagline[:200], what[:1500], services[:8]

    # nivell de coneixement (0 = sense marca)
    def marks(self, user_id: int) -> dict[str, int]:
        return self._marks.for_user(user_id)

    def set_mark(self, user_id: int, key: str, level: int) -> None:
        if not key.startswith(KEY_PREFIXES) or len(key) > 80:
            raise InvalidInput("Fitxa no vàlida")
        if level != 0 and level not in LEVELS:
            raise InvalidInput("Nivell no vàlid")
        self._marks.set(user_id, key, level)

    # calaix de sastre
    def saved(self, user_id: int) -> list[SavedAnswer]:
        return self._saved.for_user(user_id)

    def save_answer(self, user_id: int, question: str, answer: str) -> SavedAnswer:
        question, answer = " ".join(question.split()), answer.strip()
        if not question or not answer:
            raise InvalidInput("Falta la pregunta o la resposta")
        return self._saved.add(user_id, SavedAnswer(None, question[:300], answer[:12000]))

    def delete_saved(self, user_id: int, saved_id: int) -> None:
        if not self._saved.delete(user_id, saved_id):
            raise NotFound("Fitxa no trobada")
