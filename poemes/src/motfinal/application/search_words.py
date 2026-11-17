from __future__ import annotations

from motfinal.application.ports import (
    DefinitionProvider,
    SemanticRanker,
    WordAnalyzer,
    WordRepository,
)
from motfinal.domain.models import SearchHit, SearchQuery, SearchResult, Word
from motfinal.domain.text import is_valid_catalan_word


class InvalidSearch(ValueError):
    pass


class SearchWords:
    def __init__(
        self,
        repository: WordRepository,
        analyzer: WordAnalyzer,
        semantic_ranker: SemanticRanker,
        definition_provider: DefinitionProvider | None = None,
        semantic_threshold: float = 0.38,
        semantic_relative_margin: float = 0.02,
        semantic_candidate_limit: int = 1200,
    ) -> None:
        self.repository = repository
        self.analyzer = analyzer
        self.semantic_ranker = semantic_ranker
        self.definition_provider = definition_provider
        self.semantic_threshold = semantic_threshold
        self.semantic_relative_margin = semantic_relative_margin
        self.semantic_candidate_limit = semantic_candidate_limit

    def execute(self, query: SearchQuery) -> SearchResult:
        word = query.word.strip()
        if not word or len(word) > 160 or not is_valid_catalan_word(word):
            raise InvalidSearch("Escriu una paraula catalana vàlida.")
        if query.syllable_count not in (1, 2):
            raise InvalidSearch("Pots cercar per una o dues síl·labes finals.")
        reference = self.analyzer.analyze(word)
        ending = reference.ending_key(query.syllable_count)
        if not ending:
            raise InvalidSearch(
                f"«{reference.text}» no té {query.syllable_count} síl·labes per comparar."
            )
        displayed_ending = (
            tuple(ending.split("|"))
            if query.syllable_count == 2
            else reference.syllables[-query.syllable_count :]
        )
        if not 1 <= query.limit <= 200:
            raise InvalidSearch("El límit ha d'estar entre 1 i 200.")
        if query.offset < 0:
            raise InvalidSearch("El desplaçament no pot ser negatiu.")

        context = (query.context or "").strip()
        if not context:
            words, total = self.repository.search(
                ending,
                query.syllable_count,
                query.stress.final_stressed,
                query.limit,
                query.offset,
            )
            return SearchResult(
                hits=self._with_definitions(
                    [(word, None) for word in words],
                    include=query.include_definitions,
                ),
                total=total,
                contextual=False,
                ending_syllables=displayed_ending,
            )

        candidates, raw_total = self.repository.search(
            ending,
            query.syllable_count,
            query.stress.final_stressed,
            self.semantic_candidate_limit,
            0,
        )
        candidate_definitions = (
            self.definition_provider.get_many(
                [reference.text, *[word.text for word in candidates]]
            )
            if self.definition_provider
            else {}
        )
        # Quan la font lexicogràfica respon, els resultats contextuals només
        # mostren mots documentats. Si la font cau, conservem la cerca sencera.
        documented = [
            word for word in candidates if candidate_definitions.get(word.normalized_text)
        ]
        semantic_candidates = documented or candidates
        semantic_context = self._semantic_context(
            context,
            candidate_definitions.get(reference.normalized_text, ()),
        )
        semantic_ranking = self.semantic_ranker.rank(
            semantic_context,
            semantic_candidates,
            candidate_definitions,
        )
        relative_threshold = (
            semantic_ranking[0][1] - self.semantic_relative_margin
            if semantic_ranking
            else self.semantic_threshold
        )
        effective_threshold = max(self.semantic_threshold, relative_threshold)
        ranked = [
            (word, score)
            for word, score in semantic_ranking
            if score >= effective_threshold
        ]
        page = ranked[query.offset : query.offset + query.limit]
        return SearchResult(
            hits=self._with_definitions(
                page,
                candidate_definitions,
                include=query.include_definitions,
            ),
            total=len(ranked),
            contextual=True,
            ending_syllables=displayed_ending,
            truncated_candidates=raw_total > self.semantic_candidate_limit,
        )

    @staticmethod
    def _semantic_context(context: str, reference_senses: tuple[str, ...]) -> str:
        """Desambigua el context amb el significat del mot que origina la rima."""
        if not reference_senses:
            return context
        meanings = "; ".join(reference_senses)
        return f"Context: {context}. Significat de referència: {meanings}"

    def _with_definitions(
        self,
        items: list[tuple[Word, float | None]],
        known_definitions: dict[str, tuple[str, ...]] | None = None,
        include: bool = True,
    ) -> tuple[SearchHit, ...]:
        words = [item[0] for item in items]
        definitions = (known_definitions or (
            self.definition_provider.get_many([word.text for word in words])
            if self.definition_provider
            else {}
        )) if include else {}
        return tuple(
            SearchHit(
                word=word,
                semantic_score=score,
                definitions=definitions.get(word.text.casefold(), ()),
            )
            for word, score in items
        )
