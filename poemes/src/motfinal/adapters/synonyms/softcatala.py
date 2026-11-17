from __future__ import annotations

import re
from pathlib import Path

DEFAULT_PATH = Path(__file__).resolve().parent / "softcatala-sinonims.txt"

_ANNOTATION = re.compile(r"\s*\(([^)]*)\)\s*$")
_SPLIT = re.compile(r"(?<!\\),\s*")


def _key(value: str) -> str:
    return " ".join(value.casefold().replace("’", "'").split())


def parse_line(line: str) -> list[str] | None:
    """Converteix «-n: a, b (nota), c (antònim) # comentari» en la llista de sinònims."""
    line = line.strip()
    if not line.startswith("-") or ":" not in line:
        return None
    body = line.split(":", 1)[1].split("#", 1)[0]
    entries: list[str] = []
    for raw in _SPLIT.split(body):
        raw = raw.replace("\\,", ",").strip()
        note = _ANNOTATION.search(raw)
        if note and "antònim" in note.group(1).casefold():
            continue
        entry = _ANNOTATION.sub("", raw).strip()
        if entry and entry not in entries:
            entries.append(entry)
    return entries or None


class SoftcatalaSynonymProvider:
    """Sinònims del diccionari de Softcatalà (CC BY 4.0), carregat en memòria."""

    def __init__(self, path: Path = DEFAULT_PATH, limit: int = 40) -> None:
        self._limit = limit
        self._groups: list[list[str]] = []
        self._index: dict[str, list[int]] = {}
        if not path.exists():
            return
        for line in path.read_text(encoding="utf-8").splitlines():
            group = parse_line(line)
            if group is None:
                continue
            number = len(self._groups)
            self._groups.append(group)
            for entry in group:
                self._index.setdefault(_key(entry), []).append(number)

    def get_synonyms(self, word: str) -> tuple[str, ...]:
        key = _key(word)
        found: list[str] = []
        for number in self._index.get(key, ()):
            for entry in self._groups[number]:
                if _key(entry) != key and entry not in found:
                    found.append(entry)
        # Primer les paraules soltes, que són les útils per a un vers.
        found.sort(key=lambda entry: " " in entry)
        return tuple(found[: self._limit])
