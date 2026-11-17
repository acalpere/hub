from __future__ import annotations

from collections.abc import Sequence

from motfinal.application.ports import DefinitionProvider, SynonymProvider


class LookupSynonyms:
    """Uneix els sinònims de diverses fonts, per ordre de prioritat i sense repetits."""

    def __init__(self, providers: Sequence[SynonymProvider], limit: int = 40) -> None:
        self._providers = providers
        self._limit = limit

    def execute(self, word: str) -> tuple[str, ...]:
        seen = {word.casefold()}
        merged: list[str] = []
        for provider in self._providers:
            for synonym in provider.get_synonyms(word):
                if synonym.casefold() not in seen:
                    seen.add(synonym.casefold())
                    merged.append(synonym)
        return tuple(merged[: self._limit])


class DescribeWords:
    """Indica, per a cada paraula, si té sinònims i si té definició."""

    def __init__(
        self,
        definition_provider: DefinitionProvider,
        local_synonyms: SynonymProvider,
    ) -> None:
        self._definitions = definition_provider
        self._local_synonyms = local_synonyms

    def execute(self, words: Sequence[str]) -> dict[str, dict[str, bool]]:
        definitions = self._definitions.get_many(words)  # una sola petició per lot
        return {
            word: {
                "synonyms": bool(
                    self._local_synonyms.get_synonyms(word)
                    or self._definitions.known_synonyms(word)
                ),
                "definition": bool(definitions.get(word.casefold())),
            }
            for word in words
        }
