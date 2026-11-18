"""Cyrano de Bergerac: el text de l'obra (transcripció) en línies consultables i editables."""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, replace
from datetime import datetime

KINDS = ("speech", "stage", "text", "title", "note")
EDITABLE_KINDS = ("speech", "stage", "text")  # el que l'editor pot assignar a una línia

_ROMAN = {"I": 1, "V": 5, "X": 10}
_ACT = re.compile(r"^ACTE\s+([IVX]+)$")
_SCENE = re.compile(r"^ESCENA\s+([IVX]+)$")
_STAMP = re.compile(r"\s*\[(\d{1,2}:\d{2}:\d{2})\]\s*")
_SPEECH = re.compile(r"^\s*([^—\n]{1,60}?)\s*—\s*(.*)$", re.S)
_QUOTED = re.compile(r"^[«<].*[»>]\s*$", re.S)
_TERM = re.compile(r'"([^"]+)"|(\S+)')


@dataclass(frozen=True)
class Line:
    id: int | None
    act: int  # 0: presentació i criteri editorial; 1..5: actes
    scene: int  # 0: títol de l'acte (o nota editorial); 1..: escenes
    position: int  # ordre global dins l'obra
    kind: str
    speaker: str | None
    stamp: str | None  # marca temporal de l'enregistrament, "00:03:01"
    text: str


@dataclass(frozen=True)
class Revision:
    """Versió desada d'una línia: la més recent és la vigent; sense `edited_by`, l'original."""

    id: int
    line_id: int
    speaker: str | None
    kind: str
    text: str
    edited_by: str | None
    edited_at: datetime | None


def fold(text: str) -> str:
    """Minúscules sense accents ni apòstrofs tipogràfics: base de les cerques."""
    text = unicodedata.normalize("NFD", text.lower().replace("’", "'"))
    return "".join(c for c in text if not unicodedata.combining(c))


def roman(numeral: str) -> int:
    total = 0
    for i, c in enumerate(numeral):
        value = _ROMAN[c]
        total += -value if i + 1 < len(numeral) and _ROMAN[numeral[i + 1]] > value else value
    return total


def search_terms(query: str) -> list[str]:
    """Paraules soltes, o frases entre cometes, ja sense accents ni majúscules."""
    terms = [fold(a or b).strip() for a, b in _TERM.findall(query)]
    return [t for t in terms if t]


def speaker_base(speaker: str) -> str:
    """«CYRANO (burleta)» i «CYRANO?» són el mateix personatge."""
    return re.sub(r"\(.*?\)|\?", "", speaker).strip()


def _speech(paragraph: str) -> tuple[str, str] | None:
    match = _SPEECH.match(paragraph)
    if not match:
        return None
    name = match.group(1).strip()
    base = speaker_base(name)
    return (name, match.group(2)) if base and base.isupper() else None


def _clean(text: str) -> tuple[str, str | None]:
    stamps = _STAMP.findall(text)
    text = _STAMP.sub(" ", text)
    return re.sub(r"[ \t]{2,}", " ", text).strip(), (stamps[0] if stamps else None)


def parse_transcript(paragraphs: list[str]) -> list[Line]:
    """Converteix els paràgrafs de la transcripció en línies ordenades."""
    lines: list[Line] = []
    act = scene = 0
    expecting_title = False
    first = True

    def add(kind: str, text: str, speaker: str | None = None, stamp: str | None = None) -> None:
        lines.append(Line(None, act, scene, len(lines), kind, speaker, stamp, text))

    for raw in paragraphs:
        paragraph = raw.strip()
        if not paragraph:
            continue
        if m := _ACT.match(paragraph):
            act, scene, expecting_title = roman(m.group(1)), 0, True
            continue
        if m := _SCENE.match(paragraph):
            scene, expecting_title = roman(m.group(1)), False
            continue
        if expecting_title:
            expecting_title = False
            if not _speech(paragraph):
                add("title", paragraph)
                continue
        if paragraph == "Criteri editorial":
            act, scene = 0, 1
            add("title", paragraph)
            continue
        if act == 0:
            for part in paragraph.split("\n"):
                if part.strip():
                    add("title" if first else "note", part.strip())
                    first = False
            continue
        if speech := _speech(paragraph):
            text, stamp = _clean(speech[1])
            add("speech", text, speech[0], stamp)
            continue
        text, stamp = _clean(paragraph)
        add("stage" if _QUOTED.match(text) or len(text) <= 60 else "text", text, None, stamp)
    return lines


def _roman(n: int) -> str:
    out = ""
    for value, symbol in ((10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I")):
        while n >= value:
            out, n = out + symbol, n - value
    return out


def to_transcript(lines: list[Line]) -> list[str]:
    """Paràgrafs en el mateix format que llegeix `parse_transcript` (permet reimportar-los)."""
    paragraphs: list[str] = []
    place: tuple[int, int] | None = None
    for line in sorted(lines, key=lambda x: x.position):
        here = (line.act, line.scene)
        if here != place:
            if line.act > 0 and (place is None or place[0] != line.act):
                paragraphs.append(f"ACTE {_roman(line.act)}")
            if line.act > 0 and line.scene > 0:
                paragraphs.append(f"ESCENA {_roman(line.scene)}")
            place = here
        if line.kind == "speech":
            stamp = f"[{line.stamp}] " if line.stamp else ""
            paragraphs.append(f"{line.speaker} — {stamp}{line.text}")
        elif line.stamp:
            paragraphs.append(f"[{line.stamp}] {line.text}")
        else:
            paragraphs.append(line.text)
    return paragraphs


def edited(line: Line, speaker: str | None, kind: str, text: str) -> Line:
    return replace(line, speaker=speaker, kind=kind, text=text)
