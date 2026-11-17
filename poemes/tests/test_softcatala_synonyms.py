from pathlib import Path

from motfinal.adapters.synonyms.softcatala import SoftcatalaSynonymProvider, parse_line
from motfinal.application.synonyms import LookupSynonyms


def test_parse_line_drops_antonyms_notes_and_comments() -> None:
    assert parse_line("-adj (cel): ras, serè (col·loquial), ennuvolat (antònim) # nota") == [
        "ras",
        "serè",
    ]
    assert parse_line("comentari") is None


def test_provider_and_merge(tmp_path: Path) -> None:
    path = tmp_path / "s.txt"
    path.write_text(
        "-n: feina, faena, de la feina nova, tasca\n-n: feina, treball\n", encoding="utf-8"
    )
    provider = SoftcatalaSynonymProvider(path)
    assert provider.get_synonyms("Feina") == ("faena", "tasca", "treball", "de la feina nova")

    class Other:
        def get_synonyms(self, word: str) -> tuple[str, ...]:
            return ("tasca", "ocupació")

    assert LookupSynonyms([provider, Other()]).execute("feina") == (
        "faena", "tasca", "treball", "de la feina nova", "ocupació",
    )
