from __future__ import annotations

import sys
from types import SimpleNamespace

import pytest

from motfinal.adapters.linguistics.catalan import CatalanWordAnalyzer
from motfinal.adapters.semantics.local_embeddings import (
    LocalEmbeddingRanker,
    SemanticModelUnavailable,
)


def test_model_is_loaded_on_cpu(monkeypatch: pytest.MonkeyPatch) -> None:
    created_with: dict[str, str] = {}

    class FakeSentenceTransformer:
        def __init__(self, model_name: str, device: str) -> None:
            created_with.update(model_name=model_name, device=device)

    monkeypatch.setitem(
        sys.modules,
        "sentence_transformers",
        SimpleNamespace(SentenceTransformer=FakeSentenceTransformer),
    )

    ranker = LocalEmbeddingRanker("model-de-prova")
    ranker._get_model()

    assert created_with == {"model_name": "model-de-prova", "device": "cpu"}


def test_runtime_error_becomes_a_readable_semantic_error() -> None:
    class FailingModel:
        def encode(self, *args: object, **kwargs: object) -> object:
            raise RuntimeError("GPU incompatible")

    ranker = LocalEmbeddingRanker("model-de-prova")
    ranker._model = FailingModel()
    word = CatalanWordAnalyzer().analyze("esquela")

    with pytest.raises(SemanticModelUnavailable, match="filtre semàntic"):
        ranker.rank("buidor d'un adéu", [word])
