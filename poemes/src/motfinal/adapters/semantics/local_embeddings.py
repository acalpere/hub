from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from motfinal.adapters.semantics.errors import SemanticModelUnavailable
from motfinal.domain.models import Word


class LocalEmbeddingRanker:
    """Rànquing local amb embeddings multilingües; cap context surt del servei."""

    def __init__(self, model_name: str, enabled: bool = True) -> None:
        self.model_name = model_name
        self.enabled = enabled
        self._model: Any | None = None

    def rank(
        self,
        context: str,
        words: Sequence[Word],
        definitions: Mapping[str, Sequence[str]] | None = None,
    ) -> list[tuple[Word, float]]:
        if not words:
            return []
        model = self._get_model()
        documents, owners = self._documents(words, definitions)
        texts = [f"query: {context}"] + documents
        try:
            vectors = model.encode(
                texts,
                batch_size=64,
                normalize_embeddings=True,
                show_progress_bar=False,
            )
        except Exception as exc:
            raise SemanticModelUnavailable(
                "No s'ha pogut aplicar el filtre semàntic. "
                "Torna-ho a provar o cerca sense context."
            ) from exc
        query_vector = vectors[0]
        document_scores = vectors[1:] @ query_vector
        scores = [-1.0] * len(words)
        for owner, score in zip(owners, document_scores, strict=True):
            scores[owner] = max(scores[owner], float(score))
        ranked = sorted(
            zip(words, scores, strict=True),
            key=lambda item: (-item[1], item[0].normalized_text),
        )
        return ranked

    @staticmethod
    def _documents(
        words: Sequence[Word],
        definitions: Mapping[str, Sequence[str]] | None,
    ) -> tuple[list[str], list[int]]:
        documents: list[str] = []
        owners: list[int] = []
        for index, word in enumerate(words):
            senses = definitions.get(word.normalized_text, ()) if definitions else ()
            passages = [f"passage: {word.text}: {sense}" for sense in senses]
            for passage in passages or [f"passage: {word.text}"]:
                documents.append(passage)
                owners.append(index)
        return documents, owners

    def _get_model(self) -> Any:
        if not self.enabled:
            raise SemanticModelUnavailable(
                "El filtre semàntic està desactivat. Cerca sense context o activa'l."
            )
        if self._model is None:
            try:
                from sentence_transformers import SentenceTransformer
            except ImportError as exc:
                raise SemanticModelUnavailable(
                    "Falta el paquet semàntic. Instal·la el projecte amb "
                    "pip install -e '.[semantic]'"
                ) from exc
            # El rànquing és prou petit per executar-se en CPU i així evitem que
            # PyTorch seleccioni automàticament una GPU local incompatible.
            self._model = SentenceTransformer(self.model_name, device="cpu")
        return self._model
