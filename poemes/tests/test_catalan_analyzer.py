import pytest

from motfinal.adapters.linguistics.catalan import CatalanWordAnalyzer


@pytest.fixture
def analyzer() -> CatalanWordAnalyzer:
    return CatalanWordAnalyzer()


@pytest.mark.parametrize(
    ("word", "final_stressed"),
    [
        ("cançó", True),
        ("paper", True),
        ("casa", False),
        ("fàbrica", False),
        ("caminen", False),
        ("mar", True),
        ("de", False),
    ],
)
def test_final_stress(analyzer: CatalanWordAnalyzer, word: str, final_stressed: bool) -> None:
    assert analyzer.analyze(word).is_final_stressed is final_stressed


def test_accent_insensitive_final_key(analyzer: CatalanWordAnalyzer) -> None:
    assert analyzer.analyze("cançó").final_syllable_key == "ço"


def test_returns_auditable_syllables(analyzer: CatalanWordAnalyzer) -> None:
    result = analyzer.analyze("inspiració")
    assert result.syllables[-1] == "ció"
    assert "".join(result.syllables) == "inspiració"


def test_builds_key_for_last_two_syllables(analyzer: CatalanWordAnalyzer) -> None:
    result = analyzer.analyze("esquela")
    assert result.syllables == ("es", "que", "la")
    assert result.last_two_syllables_key == "e|la"


def test_two_syllable_rhyme_matches_esquela_and_vela(analyzer: CatalanWordAnalyzer) -> None:
    assert (
        analyzer.analyze("esquela").last_two_syllables_key
        == analyzer.analyze("vela").last_two_syllables_key
    )
    assert (
        analyzer.analyze("esquela").last_two_syllables_key
        == analyzer.analyze("seqüela").last_two_syllables_key
    )


def test_monosyllable_has_no_two_syllable_key(analyzer: CatalanWordAnalyzer) -> None:
    assert analyzer.analyze("mar").last_two_syllables_key is None
