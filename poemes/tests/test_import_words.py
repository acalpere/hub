import gzip
from collections.abc import Iterable

from motfinal.adapters.linguistics.catalan import CatalanWordAnalyzer
from motfinal.application.import_words import ImportWords
from motfinal.cli import text_words
from motfinal.domain.models import Word


class CollectingRepository:
    def __init__(self) -> None:
        self.words: list[Word] = []

    def add_many(self, words: Iterable[Word]) -> int:
        values = list(words)
        self.words.extend(values)
        return len(values)


def test_import_ignores_numbers_duplicates_and_invalid_entries() -> None:
    repository = CollectingRepository()
    imported = ImportWords(repository, CatalanWordAnalyzer()).execute(
        ["cançó", "cançó", "10a", "", "mar"]
    )
    assert imported == 2
    assert [word.text for word in repository.words] == ["cançó", "mar"]


def test_reads_packaged_gzip_word_lists(tmp_path) -> None:
    source = tmp_path / "words.txt.gz"
    with gzip.open(source, mode="wt", encoding="utf-8") as compressed:
        compressed.write("esquela\nvela\n")

    assert list(text_words(source)) == ["esquela", "vela"]
