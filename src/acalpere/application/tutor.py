"""Tutor d'AWS: aprofundeix un concepte dels apunts i respon preguntes sobre ell."""

from __future__ import annotations

import json

from ..domain.errors import InvalidInput, Unavailable
from ..domain.ports import Tutor

MAX_QUESTION = 600
MAX_TURNS = 12  # missatges d'història que s'envien (els més recents)
LEVELS = {
    "basic": "bàsic (primers passos; sense suposar coneixements previs; analogies senzilles)",
    "intermedi": "intermedi (coneixes el servei; el compares amb alternatives)",
    "avancat": "avançat (límits, rendiment, costos, seguretat i fallades; detalls d'operació)",
    "pro": "professional, nivell d'arquitecte de solucions sènior (decisions de disseny, "
    "contrapartides, alta disponibilitat, recuperació de desastres, cost, governança)",
}
MAX_CARDS = 10
DEFAULT_QUESTION = "Explica-ho amb més detall i en profunditat, amb un exemple concret."


class TutorService:
    def __init__(self, tutor: Tutor):
        self._tutor = tutor

    def ask(
        self,
        service: str,
        concept: str,
        question: str,
        history: list[tuple[str, str]],
        level: str = "",
    ) -> str:
        """Pregunta sobre un concepte, o lliure (sense `concept`) sobre qualsevol cosa d'AWS.

        `history`: parelles (rol, text), amb rol «user» o «assistant».
        """
        service, concept, question = service.strip() or "AWS", concept.strip(), question.strip()
        if not concept and not question:
            raise InvalidInput("Escriu o digues una pregunta")
        question = question or DEFAULT_QUESTION
        if len(question) > MAX_QUESTION:
            raise InvalidInput(f"La pregunta no pot passar dels {MAX_QUESTION} caràcters")
        if level and level not in LEVELS:
            raise InvalidInput("Nivell no vàlid")
        if level:
            question += f"\n\n(Respon a nivell {LEVELS[level]}.)"
        turns = [(r, t.strip()) for r, t in history if r in ("user", "assistant") and t.strip()]
        return self._tutor.answer(service, concept, question, turns[-MAX_TURNS:])

    def explain(self, topic: str, level: str) -> str:
        """Explicació d'un servei o una arquitectura sencera, al nivell de profunditat triat."""
        topic, level_text = self._topic(topic, level)
        question = (
            f"Explica «{topic}» a nivell {level_text}. Comença amb la definició en una o dues "
            "línies, sense títol (p. ex. «CloudWatch és el sistema de monitoratge, logging i "
            "observabilitat natiu d'AWS»). Després, aquestes vuit seccions, cadascuna amb el títol "
            "en una línia pròpia entre dos asteriscs i en aquest ordre: **Què és**, **Quan "
            "usar-lo**, **Com funciona**, **Exemple concret**, **Avantatges**, **Inconvenients**, "
            "**Decisions d'arquitecte**, **Governança i cost**. Exemple concret, Avantatges i "
            "Inconvenients han de ser senzills i breus (2 o 3 línies o punts cadascun). Sota cada "
            "títol, paràgrafs curts o punts amb guionet. Pots passar de les 350 paraules."
        )
        return self._tutor.answer(topic, "visió general", question, [], max_tokens=1800)

    def quiz(self, topic: str, level: str, count: int) -> list[tuple[str, str]]:
        """Preguntes i respostes (fitxes) d'arquitectura sobre el tema, de la dificultat triada."""
        topic, level_text = self._topic(topic, level)
        if not 1 <= count <= MAX_CARDS:
            raise InvalidInput(f"Es poden demanar entre 1 i {MAX_CARDS} preguntes")
        question = (
            f"Prepara {count} preguntes d'arquitectura sobre «{topic}», de nivell {level_text}, "
            "com les d'una entrevista o d'un examen de Solutions Architect. Cada pregunta ha de "
            "plantejar un escenari breu i concret i demanar una decisió o un raonament (no una "
            "definició). La resposta ha de ser correcta i completa, amb els motius i les "
            "contrapartides, en 3 a 6 frases. Respon NOMÉS amb un array JSON, sense res més: "
            '[{"pregunta": "...", "resposta": "..."}]'
        )
        raw = self._tutor.answer(
            topic, "preguntes", question, [], max_tokens=min(4000, 450 * count)
        )
        return self._cards(raw)[:count]

    @staticmethod
    def _topic(topic: str, level: str) -> tuple[str, str]:
        topic = topic.strip()
        if not topic:
            raise InvalidInput("Cal triar un servei")
        if level not in LEVELS:
            raise InvalidInput("Nivell no vàlid")
        return topic, LEVELS[level]

    @staticmethod
    def _cards(raw: str) -> list[tuple[str, str]]:
        start, end = raw.find("["), raw.rfind("]")
        try:
            items = json.loads(raw[start : end + 1])
            cards = [
                (str(i["pregunta"]).strip(), str(i["resposta"]).strip())
                for i in items
                if str(i["pregunta"]).strip() and str(i["resposta"]).strip()
            ]
        except (ValueError, KeyError, TypeError):
            cards = []
        if not cards:
            raise Unavailable("No he pogut preparar les preguntes. Torna-ho a provar.")
        return cards
