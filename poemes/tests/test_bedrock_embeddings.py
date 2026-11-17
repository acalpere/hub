from __future__ import annotations

import io
import json

from motfinal.adapters.linguistics.catalan import CatalanWordAnalyzer
from motfinal.adapters.semantics.bedrock_embeddings import BedrockEmbeddingRanker


class FakeBedrockClient:
    def __init__(self) -> None:
        self.requests: list[dict[str, object]] = []

    def invoke_model(self, **kwargs: object) -> dict[str, io.BytesIO]:
        body = json.loads(str(kwargs["body"]))
        self.requests.append(body)
        texts = body["texts"]
        if body["input_type"] == "search_query":
            embeddings = [[1.0, 0.0]]
        else:
            embeddings = [
                [1.0, 0.0] if "esquela: Comiat" in text else [0.0, 1.0]
                for text in texts
            ]
        return {"body": io.BytesIO(json.dumps({"embeddings": embeddings}).encode())}


def test_bedrock_ranks_with_definitions_and_correct_input_types() -> None:
    analyzer = CatalanWordAnalyzer()
    esquela = analyzer.analyze("esquela")
    vela = analyzer.analyze("vela")
    client = FakeBedrockClient()
    ranker = BedrockEmbeddingRanker(
        "cohere.embed-multilingual-v3",
        "eu-west-1",
        client=client,
    )

    ranked = ranker.rank(
        "la buidor d'un adeu",
        [vela, esquela],
        {"esquela": ("Comiat d'una persona difunta.",)},
    )

    assert [word.text for word, _ in ranked] == ["esquela", "vela"]
    assert [request["input_type"] for request in client.requests] == [
        "search_query",
        "search_document",
    ]


def test_bedrock_batches_at_the_service_limit() -> None:
    analyzer = CatalanWordAnalyzer()
    words = [analyzer.analyze(f"casa{index}") for index in range(97)]
    client = FakeBedrockClient()
    ranker = BedrockEmbeddingRanker("model", "eu-west-1", client=client)

    ranker.rank("casa", words)

    document_requests = [
        request for request in client.requests if request["input_type"] == "search_document"
    ]
    assert [len(request["texts"]) for request in document_requests] == [96, 1]
