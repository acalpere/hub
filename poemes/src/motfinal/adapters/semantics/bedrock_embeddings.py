from __future__ import annotations

import json
import math
from collections.abc import Mapping, Sequence
from typing import Any

from motfinal.adapters.semantics.errors import SemanticModelUnavailable
from motfinal.domain.models import Word

_BEDROCK_BATCH_SIZE = 96


class BedrockEmbeddingRanker:
    """Rànquing amb Cohere Embed Multilingual a Amazon Bedrock."""

    def __init__(
        self,
        model_id: str,
        region: str,
        enabled: bool = True,
        client: Any | None = None,
    ) -> None:
        self.model_id = model_id
        self.region = region
        self.enabled = enabled
        self._client = client

    def rank(
        self,
        context: str,
        words: Sequence[Word],
        definitions: Mapping[str, Sequence[str]] | None = None,
    ) -> list[tuple[Word, float]]:
        if not words:
            return []
        if not self.enabled:
            raise SemanticModelUnavailable(
                "El filtre semàntic està desactivat. Cerca sense context o activa'l."
            )

        try:
            query_vector = self._embed([context], "search_query")[0]
            document_vectors: list[list[float]] = []
            documents, owners = self._documents(words, definitions)
            for start in range(0, len(documents), _BEDROCK_BATCH_SIZE):
                document_vectors.extend(
                    self._embed(
                        documents[start : start + _BEDROCK_BATCH_SIZE],
                        "search_document",
                    )
                )
        except SemanticModelUnavailable:
            raise
        except Exception as exc:
            raise SemanticModelUnavailable(
                "Amazon Bedrock no ha pogut aplicar el filtre semàntic. "
                "Torna-ho a provar o cerca sense context."
            ) from exc

        scores = [-1.0] * len(words)
        for owner, vector in zip(owners, document_vectors, strict=True):
            scores[owner] = max(scores[owner], self._cosine(query_vector, vector))
        ranked = sorted(
            zip(words, scores, strict=True),
            key=lambda item: (-item[1], item[0].normalized_text),
        )
        return ranked

    def _embed(self, texts: Sequence[str], input_type: str) -> list[list[float]]:
        response = self._get_client().invoke_model(
            modelId=self.model_id,
            accept="application/json",
            contentType="application/json",
            body=json.dumps(
                {
                    "texts": list(texts),
                    "input_type": input_type,
                    "truncate": "END",
                }
            ),
        )
        payload = json.loads(response["body"].read())
        embeddings = payload.get("embeddings")
        if not isinstance(embeddings, list) or len(embeddings) != len(texts):
            raise ValueError("Resposta d'embeddings incompleta")
        return embeddings

    def _get_client(self) -> Any:
        if self._client is None:
            try:
                import boto3
            except ImportError as exc:
                raise SemanticModelUnavailable(
                    "Falta el suport d'AWS. Instal·la el projecte amb "
                    "pip install -e '.[bedrock]'"
                ) from exc
            self._client = boto3.client("bedrock-runtime", region_name=self.region)
        return self._client

    @staticmethod
    def _documents(
        words: Sequence[Word],
        definitions: Mapping[str, Sequence[str]] | None,
    ) -> tuple[list[str], list[int]]:
        documents: list[str] = []
        owners: list[int] = []
        for index, word in enumerate(words):
            senses = definitions.get(word.normalized_text, ()) if definitions else ()
            passages = [f"{word.text}: {sense}" for sense in senses]
            for passage in passages or [word.text]:
                documents.append(passage)
                owners.append(index)
        return documents, owners

    @staticmethod
    def _cosine(left: Sequence[float], right: Sequence[float]) -> float:
        numerator = sum(a * b for a, b in zip(left, right, strict=True))
        left_norm = math.sqrt(sum(value * value for value in left))
        right_norm = math.sqrt(sum(value * value for value in right))
        if not left_norm or not right_norm:
            return 0.0
        return numerator / (left_norm * right_norm)
