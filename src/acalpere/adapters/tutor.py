"""Tutor d'AWS: Bedrock (API Converse, amb el rol de la Lambda) o l'API d'Anthropic (en local)."""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request

from ..domain.errors import Unavailable

log = logging.getLogger(__name__)

SYSTEM = (
    "Ets un tutor d'Amazon Web Services que ajuda una persona a estudiar. Respon sempre en català, "
    "amb un to clar i proper, de manera rigorosa i concreta (noms reals de funcions, límits i "
    "preus aproximats quan convingui, i diu-ho si no n'estàs segur). Escriu text pla, sense "
    "Markdown ni llistes amb símbols: paràgrafs curts separats per una línia en blanc, perquè "
    "es llegeixin bé al mòbil. Màxim unes 250 paraules, tret que et demanin més."
)


def build_messages(
    service: str, concept: str, question: str, history: list[tuple[str, str]]
) -> list[tuple[str, str]]:
    """Missatges (rol, text) que comencen per «user» i alternen rols, com exigeixen les APIs."""
    if concept:
        context = f"Estic estudiant el servei «{service}». Concepte dels meus apunts: «{concept}»."
    else:
        context = f"Estic estudiant {service}. Et faré preguntes lliures."
    turns = [
        ("user", context),
        *history,
        ("user", question),
    ]
    merged: list[tuple[str, str]] = []
    for role, text in turns:
        if merged and merged[-1][0] == role:  # dos seguits del mateix rol: es ajunten
            merged[-1] = (role, f"{merged[-1][1]}\n\n{text}")
        else:
            merged.append((role, text))
    return merged


class AnthropicTutor:
    """Per a local: sense AWS, amb una clau de l'API d'Anthropic (ACALPERE_ANTHROPIC_API_KEY)."""

    URL = "https://api.anthropic.com/v1/messages"

    def __init__(self, api_key: str, model: str):
        self._key = api_key
        self._model = model

    def answer(
        self,
        service: str,
        concept: str,
        question: str,
        history: list[tuple[str, str]],
        max_tokens: int = 900,
    ) -> str:
        body = {
            "model": self._model,
            "max_tokens": max_tokens,
            "temperature": 0.3,
            "system": SYSTEM,
            "messages": [
                {"role": r, "content": t}
                for r, t in build_messages(service, concept, question, history)
            ],
        }
        req = urllib.request.Request(
            self.URL,
            data=json.dumps(body).encode(),
            headers={
                "x-api-key": self._key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as res:  # noqa: S310 (URL fixa, https)
                parts = json.load(res)["content"]
        except (urllib.error.URLError, OSError, ValueError, KeyError):
            log.exception("El tutor no ha pogut respondre")
            raise Unavailable("El tutor no està disponible ara mateix.") from None
        return "".join(p.get("text", "") for p in parts if p.get("type") == "text").strip()


class BedrockTutor:
    def __init__(self, model_id: str, region: str, client=None):
        self._model = model_id
        self._region = region
        self._client = client

    def _bedrock(self):
        if self._client is None:
            import boto3

            self._client = boto3.client("bedrock-runtime", region_name=self._region)
        return self._client

    def answer(
        self,
        service: str,
        concept: str,
        question: str,
        history: list[tuple[str, str]],
        max_tokens: int = 900,
    ) -> str:
        messages = [
            {"role": r, "content": [{"text": t}]}
            for r, t in build_messages(service, concept, question, history)
        ]
        try:
            out = self._bedrock().converse(
                modelId=self._model,
                system=[{"text": SYSTEM}],
                messages=messages,
                inferenceConfig={"maxTokens": max_tokens, "temperature": 0.3},
            )
            parts = out["output"]["message"]["content"]
        except Exception:  # sense credencials, model no habilitat, límit…
            log.exception("El tutor no ha pogut respondre")
            raise Unavailable("El tutor no està disponible ara mateix.") from None
        return "".join(p.get("text", "") for p in parts).strip()
