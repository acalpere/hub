"""Lectura de paràgrafs d'un document OpenDocument (.odt), sense dependències externes."""

from __future__ import annotations

import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET
from xml.sax.saxutils import escape

_TEXT = "{urn:oasis:names:tc:opendocument:xmlns:text:1.0}"


def _text(element: ET.Element) -> str:
    out = element.text or ""
    for child in element:
        if child.tag == _TEXT + "s":
            out += " " * int(child.get(_TEXT + "c", "1"))
        elif child.tag == _TEXT + "tab":
            out += "\t"
        elif child.tag == _TEXT + "line-break":
            out += "\n"
        else:
            out += _text(child)
        out += child.tail or ""
    return out


def read_paragraphs(path: Path) -> list[str]:
    with zipfile.ZipFile(path) as z:
        root = ET.fromstring(z.read("content.xml"))
    return [_text(e) for e in root.iter() if e.tag in (_TEXT + "p", _TEXT + "h")]


_MIME = "application/vnd.oasis.opendocument.text"
_MANIFEST = (
    '<?xml version="1.0" encoding="UTF-8"?>'
    '<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" '
    'manifest:version="1.2">'
    f'<manifest:file-entry manifest:full-path="/" manifest:media-type="{_MIME}"/>'
    '<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>'
    "</manifest:manifest>"
)


def write_paragraphs(path: Path, paragraphs: list[str]) -> None:
    """Escriu un .odt mínim, un paràgraf per element (llegible amb LibreOffice)."""
    body = "".join(
        "<text:p>" + escape(p).replace("\n", "<text:line-break/>") + "</text:p>" for p in paragraphs
    )
    content = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" '
        'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" office:version="1.2">'
        f"<office:body><office:text>{body}</office:text></office:body></office:document-content>"
    )
    with zipfile.ZipFile(path, "w") as z:
        z.writestr("mimetype", _MIME, compress_type=zipfile.ZIP_STORED)
        z.writestr("META-INF/manifest.xml", _MANIFEST, compress_type=zipfile.ZIP_DEFLATED)
        z.writestr("content.xml", content, compress_type=zipfile.ZIP_DEFLATED)
