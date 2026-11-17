from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence

from motfinal.adapters.linguistics.catalan import CatalanWordAnalyzer
from motfinal.application.search_words import InvalidSearch, SearchWords
from motfinal.domain.models import SearchQuery, StressFilter, Word


class MemoryRepository:
    def __init__(self, words: Iterable[Word]) -> None:
        self.words = list(words)

    def search(
        self,
        ending_key: str,
        syllable_count: int,
        final_stressed: bool | None,
        limit: int,
        offset: int = 0,
    ) -> tuple[list[Word], int]:
        matches = [
            word
            for word in self.words
            if word.ending_key(syllable_count) == ending_key
            and (final_stressed is None or word.is_final_stressed is final_stressed)
        ]
        return matches[offset : offset + limit], len(matches)

    def add_many(self, words: Iterable[Word]) -> int:
        values = list(words)
        self.words.extend(values)
        return len(values)


class FakeRanker:
    def __init__(self) -> None:
        self.received_context = ""

    def rank(
        self,
        context: str,
        words: Sequence[Word],
        definitions: Mapping[str, Sequence[str]] | None = None,
    ) -> list[tuple[Word, float]]:
        self.received_context = context
        scores = {"emoció": 0.91, "acció": 0.22}
        return sorted(((word, scores[word.text]) for word in words), key=lambda item: -item[1])


class FakeDefinitions:
    def get_many(self, words: Sequence[str]) -> dict[str, tuple[str, ...]]:
        return {"emoció": ("Sentiment intens.", "Commoció de l'ànim.")}


def use_case() -> SearchWords:
    analyzer = CatalanWordAnalyzer()
    words = [
        analyzer.analyze(word)
        for word in (
            "emoció",
            "acció",
            "cançó",
            "casa",
            "camina",
            "termina",
            "divina",
            "esquela",
            "vela",
        )
    ]
    return SearchWords(
        MemoryRepository(words),
        analyzer,
        FakeRanker(),
        definition_provider=FakeDefinitions(),
        semantic_threshold=0.4,
    )


def test_search_without_context_returns_all_suffix_matches() -> None:
    result = use_case().execute(SearchQuery(word="emoció", stress=StressFilter.TONIC))
    assert result.total == 2
    assert {hit.word.text for hit in result.hits} == {"emoció", "acció"}
    assert result.ending_syllables == ("ció",)
    assert result.contextual is False
    assert all(not hit.definitions for hit in result.hits)


def test_definitions_can_be_requested_explicitly() -> None:
    result = use_case().execute(
        SearchQuery(
            word="emoció",
            stress=StressFilter.TONIC,
            include_definitions=True,
        )
    )

    definitions = {hit.word.text: hit.definitions for hit in result.hits}
    assert definitions["emoció"] == ("Sentiment intens.", "Commoció de l'ànim.")


def test_context_filters_and_ranks_matches() -> None:
    result = use_case().execute(
        SearchQuery(
            word="emoció",
            stress=StressFilter.TONIC,
            context="amor intens",
            include_definitions=True,
        )
    )
    assert [hit.word.text for hit in result.hits] == ["emoció"]
    assert result.hits[0].semantic_score == 0.91
    assert result.hits[0].definitions == ("Sentiment intens.", "Commoció de l'ànim.")
    assert result.contextual is True


def test_context_is_disambiguated_with_the_reference_meaning() -> None:
    analyzer = CatalanWordAnalyzer()
    ranker = FakeRanker()
    search = SearchWords(
        MemoryRepository([analyzer.analyze("emoció"), analyzer.analyze("acció")]),
        analyzer,
        ranker,
        definition_provider=FakeDefinitions(),
        semantic_threshold=0.4,
    )

    search.execute(
        SearchQuery(word="emoció", stress=StressFilter.TONIC, context="un comiat")
    )

    assert "un comiat" in ranker.received_context
    assert "Sentiment intens." in ranker.received_context


def test_unstressed_filter_excludes_tonic_words() -> None:
    result = use_case().execute(SearchQuery(word="emoció", stress=StressFilter.UNSTRESSED))
    assert result.total == 0


def test_two_syllables_are_extracted_from_reference_word() -> None:
    result = use_case().execute(SearchQuery(word="camina", syllable_count=2))
    assert {hit.word.text for hit in result.hits} == {"camina", "termina", "divina"}
    assert result.ending_syllables == ("i", "na")


def test_rejects_two_syllables_for_monosyllable() -> None:
    try:
        use_case().execute(SearchQuery(word="mar", syllable_count=2))
    except InvalidSearch as exc:
        assert "no té 2 síl·labes" in str(exc)
    else:
        raise AssertionError("La cerca havia de rebutjar una paraula monosíl·laba")


def test_two_syllable_search_uses_the_rhyme_from_the_vowel() -> None:
    by_esquela = use_case().execute(SearchQuery(word="esquela", syllable_count=2))
    by_vela = use_case().execute(SearchQuery(word="vela", syllable_count=2))
    assert {hit.word.text for hit in by_esquela.hits} == {"esquela", "vela"}
    assert {hit.word.text for hit in by_vela.hits} == {"esquela", "vela"}
