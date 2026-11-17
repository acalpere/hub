from __future__ import annotations

import json
import re
from collections.abc import Sequence
from threading import Lock
from urllib.parse import urlencode
from urllib.request import Request, urlopen

API_URL = "https://ca.wiktionary.org/w/api.php"
USER_AGENT = "MotFinal/0.1 (catalan poetry search; definitions from Viccionari)"

_CATALAN_HEADING = re.compile(r"^==\s*\{\{-ca-\}\}\s*==\s*$", re.MULTILINE)
_NEXT_LANGUAGE = re.compile(r"^==[^=].*?==\s*$", re.MULTILINE)
_SENSE = re.compile(r"^#{1,2}\s+(?![:*])(.*\S)\s*$", re.MULTILINE)
_SYNONYM_HEADING = re.compile(r"^\{\{-sin-\}\}\s*$", re.MULTILINE)
_LINK = re.compile(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]")
_TEMPLATE = re.compile(r"\{\{([^{}]+)\}\}")
_HTML = re.compile(r"<[^>]+>")


def _template_text(match: re.Match[str]) -> str:
    parts = [part.strip() for part in match.group(1).split("|")]
    if parts[0].casefold() == "ca-forma-conj" and len(parts) > 1:
        return f"Forma conjugada del verb «{parts[1]}»."
    if parts[0].casefold() == "marca" and len(parts) > 2:
        labels = [part for part in parts[2:] if part and part != "_"]
        return f"({', '.join(labels)})" if labels else ""
    values = [
        part
        for part in parts[1:]
        if part and part != "_" and part.casefold() != "ca" and "=" not in part
    ]
    return values[-1] if values else ""


def _plain_text(value: str) -> str:
    previous = ""
    while value != previous:
        previous = value
        value = _TEMPLATE.sub(_template_text, value)
    value = _LINK.sub(lambda match: match.group(2) or match.group(1), value)
    value = _HTML.sub("", value)
    value = value.replace("'''", "").replace("''", "")
    return " ".join(value.split()).strip(" ,;:")


def parse_catalan_senses(wikitext: str, limit: int = 3) -> tuple[str, ...]:
    """Extreu accepcions breus de la secció catalana d'una entrada del Viccionari."""
    heading = _CATALAN_HEADING.search(wikitext)
    if heading is None:
        return ()
    section = wikitext[heading.end() :]
    next_language = _NEXT_LANGUAGE.search(section)
    if next_language:
        section = section[: next_language.start()]

    senses: list[str] = []
    for match in _SENSE.finditer(section):
        sense = _plain_text(match.group(1))
        if not sense:
            continue
        if len(sense) > 180:
            sense = sense[:177].rsplit(" ", 1)[0] + "…"
        if sense not in senses:
            senses.append(sense)
        if len(senses) == limit:
            break
    return tuple(senses)


def parse_catalan_synonyms(wikitext: str, limit: int = 30) -> tuple[str, ...]:
    """Extreu només els mots de la secció de sinònims catalana."""
    heading = _CATALAN_HEADING.search(wikitext)
    if heading is None:
        return ()
    section = wikitext[heading.end() :]
    next_language = _NEXT_LANGUAGE.search(section)
    if next_language:
        section = section[: next_language.start()]

    synonym_heading = _SYNONYM_HEADING.search(section)
    if synonym_heading is None:
        return ()

    synonyms: list[str] = []
    for line in section[synonym_heading.end() :].splitlines():
        stripped = line.strip()
        if stripped.startswith("===") or (
            stripped.startswith("{{-") and stripped.endswith("-}}")
        ):
            break
        if not stripped.startswith("*"):
            continue
        # Les notes entre parèntesis poden contenir enllaços dialectals o
        # gramaticals, però no formen part de la llista de sinònims.
        synonym_line = re.sub(r"\([^)]*\)", "", stripped)
        for match in _LINK.finditer(synonym_line):
            value = (match.group(2) or match.group(1)).split("#", 1)[0].strip()
            if value and ":" not in value and value not in synonyms:
                synonyms.append(value)
            if len(synonyms) == limit:
                return tuple(synonyms)
    return tuple(synonyms)


class WiktionaryDefinitionProvider:
    """Consulta i memoritza definicions del Viccionari amb una sola petició per lot."""

    def __init__(self, enabled: bool = True, timeout: float = 2.5) -> None:
        self.enabled = enabled
        self.timeout = timeout
        self._cache: dict[str, tuple[str, ...]] = {}
        self._synonym_cache: dict[str, tuple[str, ...]] = {}
        self._lock = Lock()

    def get_many(self, words: Sequence[str]) -> dict[str, tuple[str, ...]]:
        keys = list(dict.fromkeys(word.casefold() for word in words))
        if not self.enabled or not keys:
            return {key: () for key in keys}

        with self._lock:
            missing = [key for key in keys if key not in self._cache]
            for start in range(0, len(missing), 50):
                try:
                    self._cache.update(self._fetch(missing[start : start + 50]))
                except (OSError, TimeoutError, ValueError, json.JSONDecodeError):
                    continue
            return {key: self._cache.get(key, ()) for key in keys}

    def get_synonyms(self, word: str) -> tuple[str, ...]:
        key = word.casefold().strip()
        if not self.enabled or not key:
            return ()
        with self._lock:
            if key not in self._synonym_cache:
                try:
                    self._synonym_cache.update(self._fetch_synonyms([key]))
                except (OSError, TimeoutError, ValueError, json.JSONDecodeError):
                    return ()
            return self._synonym_cache.get(key, ())

    def known_synonyms(self, word: str) -> tuple[str, ...]:
        """Sinònims ja descarregats; no fa cap petició a la xarxa."""
        return self._synonym_cache.get(word.casefold().strip(), ())

    def _fetch(self, words: Sequence[str]) -> dict[str, tuple[str, ...]]:
        contents = self._fetch_contents(words)
        # La mateixa descàrrega serveix per als sinònims: així no cal una altra petició.
        for word in words:
            self._synonym_cache.setdefault(
                word.casefold(), parse_catalan_synonyms(contents.get(word.casefold(), ""))
            )
        return {
            word.casefold(): parse_catalan_senses(contents.get(word.casefold(), ""))
            for word in words
        }

    def _fetch_synonyms(self, words: Sequence[str]) -> dict[str, tuple[str, ...]]:
        contents = self._fetch_contents(words)
        return {
            word.casefold(): parse_catalan_synonyms(contents.get(word.casefold(), ""))
            for word in words
        }

    def _fetch_contents(self, words: Sequence[str]) -> dict[str, str]:
        params = {
            "action": "query",
            "prop": "revisions",
            "rvprop": "content",
            "rvslots": "main",
            "redirects": "1",
            "titles": "|".join(words),
            "format": "json",
            "formatversion": "2",
        }
        request = Request(
            API_URL,
            data=urlencode(params).encode(),
            headers={"User-Agent": USER_AGENT},
            method="POST",
        )
        with urlopen(request, timeout=self.timeout) as response:
            payload = json.load(response)
        if "error" in payload:
            raise ValueError(payload["error"].get("info", "Error del Viccionari"))

        found: dict[str, str] = {word.casefold(): "" for word in words}
        redirects = {
            item["to"].casefold(): item["from"].casefold()
            for item in payload.get("query", {}).get("redirects", [])
        }
        for page in payload.get("query", {}).get("pages", []):
            title = page.get("title", "").casefold()
            key = redirects.get(title, title)
            revisions = page.get("revisions", [])
            if not revisions:
                continue
            content = revisions[0].get("slots", {}).get("main", {}).get("content", "")
            found[key] = content
        return found
