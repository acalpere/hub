from __future__ import annotations

from collections.abc import Iterable

from motfinal.application.ports import WordAnalyzer, WordRepository
from motfinal.domain.text import is_valid_catalan_word


class ImportWords:
    def __init__(self, repository: WordRepository, analyzer: WordAnalyzer) -> None:
        self.repository = repository
        self.analyzer = analyzer

    def execute(self, raw_words: Iterable[str], batch_size: int = 1000) -> int:
        imported = 0
        batch = []
        seen: set[str] = set()
        for raw in raw_words:
            text = raw.strip()
            if not is_valid_catalan_word(text):
                continue
            word = self.analyzer.analyze(text)
            if word.normalized_text in seen:
                continue
            seen.add(word.normalized_text)
            batch.append(word)
            if len(batch) >= batch_size:
                imported += self.repository.add_many(batch)
                batch.clear()
        if batch:
            imported += self.repository.add_many(batch)
        return imported
