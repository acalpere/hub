"""Serveis de MotFinal (ranker semàntic, diccionaris...), sense res de web ni de base de dades."""

from __future__ import annotations

from dataclasses import dataclass

from motfinal.adapters.definitions.wiktionary import WiktionaryDefinitionProvider
from motfinal.adapters.persistence.config import Settings
from motfinal.adapters.semantics.bedrock_embeddings import BedrockEmbeddingRanker
from motfinal.adapters.semantics.local_embeddings import LocalEmbeddingRanker
from motfinal.adapters.synonyms.softcatala import SoftcatalaSynonymProvider
from motfinal.application.ports import SemanticRanker
from motfinal.application.synonyms import DescribeWords, LookupSynonyms


@dataclass
class Services:
    settings: Settings
    semantic_ranker: SemanticRanker
    definition_provider: WiktionaryDefinitionProvider
    lookup_synonyms: LookupSynonyms
    describe_words: DescribeWords


def build_services(settings: Settings) -> Services:
    ranker: SemanticRanker = (
        BedrockEmbeddingRanker(
            model_id=settings.bedrock_model_id,
            region=settings.bedrock_region,
            enabled=settings.semantic_enabled,
        )
        if settings.semantic_provider == "bedrock"
        else LocalEmbeddingRanker(settings.semantic_model, settings.semantic_enabled)
    )
    definitions = WiktionaryDefinitionProvider(
        enabled=settings.definitions_enabled, timeout=settings.definitions_timeout
    )
    synonyms = SoftcatalaSynonymProvider()
    return Services(
        settings=settings,
        semantic_ranker=ranker,
        definition_provider=definitions,
        lookup_synonyms=LookupSynonyms([synonyms, definitions]),
        describe_words=DescribeWords(definitions, synonyms),
    )
