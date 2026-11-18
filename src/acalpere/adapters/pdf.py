"""Maquetació de l'obra en PDF, sense dependències: tipus estàndard Times, A5, text justificat."""

from __future__ import annotations

import re
import unicodedata
import zlib
from dataclasses import dataclass

from ..domain.cyrano import Line
from . import pdf_metrics

PAGE_W, PAGE_H = 419.53, 595.28  # A5
MARGIN_X, MARGIN_TOP, MARGIN_BOTTOM = 52.0, 58.0, 64.0
TEXT_W = PAGE_W - 2 * MARGIN_X
SIZE, LEADING = 10.5, 14.5
FONT_NAMES = {"R": "F1", "I": "F2", "B": "F3"}
FONT_BASE = {"F1": "Times-Roman", "F2": "Times-Italic", "F3": "Times-Bold"}
WIDTHS = {"R": pdf_metrics.ROMAN, "I": pdf_metrics.ITALIC, "B": pdf_metrics.BOLD}
INK, MUTED = "0.13 0.12 0.11", "0.43 0.41 0.38"

Run = tuple[str, str]  # (tipus R/I/B, text)


def _encode(text: str) -> bytes:
    """Text a WinAnsi (cp1252); el que no hi cap es redueix a la lletra base, o a «?»."""
    out = bytearray()
    for ch in text.replace(" ", " "):
        try:
            out += ch.encode("cp1252")
        except UnicodeEncodeError:
            out += unicodedata.normalize("NFKD", ch).encode("cp1252", "ignore") or b"?"
    return bytes(out)


def _width(data: bytes, font: str, size: float, tracking: float = 0.0) -> float:
    table = WIDTHS[font]
    return sum(table[b] for b in data) * size / 1000 + tracking * len(data)


@dataclass
class Word:
    data: bytes
    font: str
    size: float

    @property
    def width(self) -> float:
        return _width(self.data, self.font, self.size)

    @property
    def space(self) -> float:
        return _width(b" ", self.font, self.size)


def _words(runs: list[Run], size: float) -> list[Word]:
    return [Word(_encode(w), f, size) for f, text in runs for w in re.findall(r"\S+", text)]


def _break(words: list[Word], width: float, first_offset: float = 0.0) -> list[list[Word]]:
    """Talla en línies (voraç) segons l'amplada disponible."""
    lines: list[list[Word]] = []
    current: list[Word] = []
    used = first_offset
    for word in words:
        needed = word.width + (word.space if current else 0)
        if current and used + needed > width:
            lines.append(current)
            current, used = [word], word.width
        else:
            current.append(word)
            used += needed
    if current:
        lines.append(current)
    return lines


class _Layout:
    def __init__(self) -> None:
        self.pages: list[list[str]] = [[]]
        self.y = PAGE_H - MARGIN_TOP
        self.marks: list[tuple[str, int, float]] = []  # (títol, pàgina, y): índex del PDF

    # -- pàgines i espais --
    def new_page(self) -> None:
        self.pages.append([])
        self.y = PAGE_H - MARGIN_TOP

    def fresh_page(self) -> None:
        if self.y < PAGE_H - MARGIN_TOP - 1 or self.pages[-1]:
            self.new_page()

    def need(self, height: float) -> None:
        if self.y - height < MARGIN_BOTTOM:
            self.new_page()

    def gap(self, points: float) -> None:
        if self.pages[-1]:  # a dalt de pàgina no es deixa espai
            self.y -= points

    # -- text --
    def _emit(self, words: list[Word], x: float, gap: float, color: str) -> None:
        ops = [f"BT {color} rg {x:.2f} {self.y:.2f} Td"]
        font = None
        for i, word in enumerate(words):
            tag = (FONT_NAMES[word.font], word.size)
            if tag != font:
                ops.append(f"/{tag[0]} {tag[1]:g} Tf")
                font = tag
            ops.append(f"<{word.data.hex()}> Tj")
            if i + 1 < len(words):
                ops.append(f"{word.width + gap:.2f} 0 Td")
        ops.append("ET")
        self.pages[-1].append(" ".join(ops))

    def paragraph(
        self,
        runs: list[Run],
        size: float = SIZE,
        indent: float = 0.0,
        justify: bool = True,
        center: bool = False,
        color: str = INK,
        leading: float | None = None,
        after: float = 0.0,
    ) -> None:
        leading = leading or size * 1.38
        width = TEXT_W - indent
        lines = _break(_words(runs, size), width)
        for n, line in enumerate(lines):
            self.need(leading * (2 if n == 0 and len(lines) > 1 else 1))
            self.y -= leading
            natural = sum(w.width for w in line)
            spaces = max(len(line) - 1, 1)
            space = line[0].space
            x = MARGIN_X + indent
            if center:
                x += (width - natural - space * (len(line) - 1)) / 2
            elif justify and n < len(lines) - 1 and len(line) > 1:
                space = min((width - natural) / spaces, space * 2.4)
            self._emit(line, x, space, color)
        self.y -= after

    def spaced(
        self, text: str, font: str, size: float, tracking: float, color: str = MUTED
    ) -> None:
        """Una línia centrada amb les lletres separades (ACTE I, ESCENA III…)."""
        self.need(size * 2)
        self.y -= size * 1.4
        data = _encode(text)
        width = _width(data, font, size, tracking)
        x = MARGIN_X + (TEXT_W - width + tracking) / 2
        self.pages[-1].append(
            f"BT {color} rg {tracking:g} Tc /{FONT_NAMES[font]} {size:g} Tf "
            f"{x:.2f} {self.y:.2f} Td <{data.hex()}> Tj 0 Tc ET"
        )

    def rule(self, width: float = 28.0) -> None:
        x = MARGIN_X + (TEXT_W - width) / 2
        self.pages[-1].append(
            f"{MUTED} RG 0.5 w {x:.2f} {self.y:.2f} m {x + width:.2f} {self.y:.2f} l S"
        )

    def mark(self, title: str) -> None:
        self.marks.append((title, len(self.pages) - 1, self.y + 20))

    def footers(self) -> None:
        for number, ops in enumerate(self.pages):
            if number == 0:
                continue
            data = _encode(str(number))
            x = MARGIN_X + (TEXT_W - _width(data, "R", 9)) / 2
            ops.append(
                f"BT {MUTED} rg /F1 9 Tf {x:.2f} {MARGIN_BOTTOM - 26:.2f} Td <{data.hex()}> Tj ET"
            )


def _front(layout: _Layout, lines: list[Line]) -> None:
    """Portada (títol i crèdits) i, a la pàgina següent, la nota editorial."""
    title = next((x for x in lines if x.kind == "title"), None)
    notes = [x for x in lines if x.kind != "title"]
    cut = next((i for i, x in enumerate(notes) if x.text == "Nota editorial"), len(notes))
    layout.y = PAGE_H * 0.64
    main, _, subtitle = (title.text if title else "Cyrano de Bergerac").partition(" — ")
    layout.paragraph([("R", main)], size=26, center=True, leading=32)
    if subtitle:
        layout.paragraph([("I", subtitle)], size=12, center=True, color=MUTED, leading=18)
    layout.gap(10)
    layout.rule()
    layout.gap(14)
    for credit in notes[:cut]:
        layout.paragraph([("I", credit.text)], size=10.5, center=True, color=MUTED, leading=16)
    if notes[cut:]:
        layout.new_page()
        layout.mark("Nota editorial")
        for note in notes[cut:]:
            _note(layout, note.text)


def _note(layout: _Layout, text: str) -> None:
    if text in ("Nota editorial", "Criteri editorial"):
        layout.gap(8)
        layout.paragraph([("B", text)], size=11, justify=False, after=4)
    else:
        layout.paragraph([("R", text)], size=9.5, color=MUTED, leading=13.2, after=5)


def _scene(layout: _Layout, lines: list[Line], act: int, scene: int) -> None:
    if act == 0:
        layout.fresh_page()
        layout.mark("Criteri editorial")
        for line in lines:
            _note(layout, line.text)
        return
    if scene == 0:  # títol de l'acte
        layout.fresh_page()
        layout.y -= 110
        layout.mark(f"Acte {_roman(act)}")
        layout.spaced(f"ACTE {_roman(act)}", "B", 9, 3)
        layout.gap(10)
        for line in lines:
            layout.paragraph([("I", line.text)], size=16, center=True, leading=21, color=INK)
        layout.gap(12)
        layout.rule()
        layout.gap(8)
        return
    layout.need(90)
    layout.gap(18)
    layout.spaced(f"ESCENA {_roman(scene)}", "B", 8.5, 2.5)
    layout.gap(10)
    for line in lines:
        if line.kind == "speech":
            layout.paragraph([("B", f"{line.speaker}."), ("R", line.text)], justify=True, after=3.5)
        elif line.kind == "stage":
            layout.paragraph(
                [("I", line.text)], size=9.5, indent=22, justify=False, color=MUTED, after=3.5
            )
        else:
            layout.paragraph([("R", line.text)], after=3.5)


def _roman(n: int) -> str:
    out = ""
    for value, symbol in ((10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I")):
        while n >= value:
            out, n = out + symbol, n - value
    return out


# -- escriptura del PDF -----------------------------------------------------------------------


def _utf16(text: str) -> str:
    return "<FEFF" + text.encode("utf-16-be").hex() + ">"


def _serialize(layout: _Layout, title: str) -> bytes:
    n_pages = len(layout.pages)

    def page_id(i: int) -> int:
        return first_page + 2 * i

    # Objectes: 1 catàleg, 2 pàgines, 3-5 tipus, 6 info, 7 índex, 8.. marcadors i, després, pàgines
    first_mark = 8
    first_page = first_mark + len(layout.marks)
    objs: dict[int, bytes] = {}
    objs[1] = b"<< /Type /Catalog /Pages 2 0 R /Outlines 7 0 R /PageMode /UseOutlines >>"
    kids = " ".join(f"{page_id(i)} 0 R" for i in range(n_pages))
    objs[2] = f"<< /Type /Pages /Kids [{kids}] /Count {n_pages} >>".encode()
    for i, tag in enumerate(("F1", "F2", "F3")):
        objs[3 + i] = (
            f"<< /Type /Font /Subtype /Type1 /BaseFont /{FONT_BASE[tag]} "
            "/Encoding /WinAnsiEncoding >>"
        ).encode()
    objs[6] = f"<< /Title {_utf16(title)} /Producer (acalpere) >>".encode()
    count = len(layout.marks)
    last = first_mark + count - 1
    objs[7] = (
        f"<< /Type /Outlines /Count {count} /First {first_mark} 0 R /Last {last} 0 R >>"
        if count
        else "<< /Type /Outlines /Count 0 >>"
    ).encode()
    for i, (name, page, y) in enumerate(layout.marks):
        links = ""
        if i > 0:
            links += f" /Prev {first_mark + i - 1} 0 R"
        if i < count - 1:
            links += f" /Next {first_mark + i + 1} 0 R"
        objs[first_mark + i] = (
            f"<< /Title {_utf16(name)} /Parent 7 0 R{links} "
            f"/Dest [{page_id(page)} 0 R /XYZ 0 {y:.0f} 0] >>"
        ).encode()
    for i, ops in enumerate(layout.pages):
        stream = zlib.compress("\n".join(ops).encode("ascii"), 9)
        objs[page_id(i)] = (
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {PAGE_W:.2f} {PAGE_H:.2f}] "
            f"/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> "
            f"/Contents {page_id(i) + 1} 0 R >>"
        ).encode()
        objs[page_id(i) + 1] = (
            f"<< /Length {len(stream)} /Filter /FlateDecode >>\nstream\n".encode()
            + stream
            + b"\nendstream"
        )
    out = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets: dict[int, int] = {}
    for number in sorted(objs):
        offsets[number] = len(out)
        out += f"{number} 0 obj\n".encode() + objs[number] + b"\nendobj\n"
    xref = len(out)
    size = max(objs) + 1
    out += f"xref\n0 {size}\n0000000000 65535 f \n".encode()
    for number in range(1, size):
        out += f"{offsets[number]:010d} 00000 n \n".encode()
    out += (
        f"trailer\n<< /Size {size} /Root 1 0 R /Info 6 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    )
    return bytes(out)


class PdfPlayRenderer:
    """Port `PlayRenderer`: l'obra sencera, tal com és ara a la base de dades, en un PDF."""

    def render(self, lines: list[Line], title: str) -> bytes:
        ordered = sorted(lines, key=lambda x: x.position)
        layout = _Layout()
        sections: list[tuple[int, int, list[Line]]] = []
        for line in ordered:
            if sections and sections[-1][:2] == (line.act, line.scene):
                sections[-1][2].append(line)
            else:
                sections.append((line.act, line.scene, [line]))
        for act, scene, group in sections:
            if (act, scene) == (0, 0):
                _front(layout, group)
            else:
                _scene(layout, group, act, scene)
        layout.footers()
        return _serialize(layout, title)
