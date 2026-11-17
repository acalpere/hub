from __future__ import annotations

import pyphen

from motfinal.domain.models import Word
from motfinal.domain.text import normalize_text, syllable_ending_key, syllable_key

_STRESSED_VOWELS = frozenset("àáèéíòóú")
_VOWELS = frozenset("aàáeèéiíïoòóuúü")
_UNSTRESSED_MONOSYLLABLES = frozenset(
    {
        "a",
        "al",
        "amb",
        "de",
        "del",
        "el",
        "els",
        "em",
        "en",
        "ens",
        "es",
        "et",
        "hi",
        "ho",
        "i",
        "la",
        "les",
        "li",
        "m",
        "me",
        "n",
        "ne",
        "o",
        "pel",
        "pels",
        "per",
        "que",
        "s",
        "se",
        "t",
        "te",
        "un",
        "una",
        "uns",
        "unes",
    }
)


class CatalanWordAnalyzer:
    """Separació ortogràfica i càlcul auditable de la síl·laba tònica.

    Pyphen aplica els patrons de partició catalans. La tonicitat segueix els
    accents gràfics i, si no n'hi ha, les regles generals del català.
    """

    def __init__(self) -> None:
        self._hyphenator = pyphen.Pyphen(lang="ca")

    def analyze(self, text: str) -> Word:
        normalized = normalize_text(text)
        inserted = self._hyphenator.inserted(normalized)
        syllables = tuple(part for part in inserted.split("-") if part) or (normalized,)
        stressed_index = self._stressed_index(normalized, syllables)
        final_syllable = syllables[-1]
        return Word(
            text=normalized,
            normalized_text=normalized,
            syllables=syllables,
            final_syllable=final_syllable,
            final_syllable_key=syllable_key(final_syllable),
            last_two_syllables_key=(
                syllable_ending_key(syllables, 2) if len(syllables) >= 2 else None
            ),
            is_final_stressed=stressed_index == len(syllables) - 1,
        )

    @staticmethod
    def _stressed_index(word: str, syllables: tuple[str, ...]) -> int:
        for index, syllable in enumerate(syllables):
            if any(letter in _STRESSED_VOWELS for letter in syllable):
                return index

        if len(syllables) == 1:
            return -1 if word in _UNSTRESSED_MONOSYLLABLES else 0

        ends_in_vowel = word[-1] in _VOWELS
        ends_in_vowel_s = len(word) > 1 and word[-1] == "s" and word[-2] in _VOWELS
        ends_in_en_or_in = word.endswith(("en", "in"))
        if ends_in_vowel or ends_in_vowel_s or ends_in_en_or_in:
            return len(syllables) - 2
        return len(syllables) - 1
