"""Casos d'ús de Cyrano: sumari, lectura per escenes, cerca i edició."""

from __future__ import annotations

from ..domain.cyrano import (
    EDITABLE_KINDS,
    Line,
    Revision,
    fold,
    normalize_stamp,
    parse_transcript,
    search_terms,
    speaker_base,
    to_transcript,
)
from ..domain.errors import InvalidInput, NotFound
from ..domain.ports import CyranoRepository, MediaStore, PlayRenderer

SEARCH_LIMIT = 300
VIDEO_NAME = "cyrano.mp4"


class CyranoService:
    def __init__(self, repo: CyranoRepository, renderer: PlayRenderer, media: MediaStore):
        self._repo = repo
        self._renderer = renderer
        self._media = media

    def outline(self) -> list[dict]:
        """Actes amb el seu títol i les escenes que tenen."""
        titles = {line.act: line.text for line in self._repo.titles()}
        acts: dict[int, list[int]] = {}
        for act, scene in self._repo.sections():
            if scene > 0 or act == 0:
                acts.setdefault(act, []).append(scene)
        return [
            {"act": a, "title": titles.get(a, ""), "scenes": s} for a, s in sorted(acts.items())
        ]

    def scene(self, act: int, scene: int) -> list[Line]:
        lines = self._repo.scene(act, scene)
        if not lines:
            raise NotFound("Escena no trobada")
        return lines

    def speakers(self) -> list[dict]:
        counts: dict[str, int] = {}
        for name, n in self._repo.speakers():
            base = speaker_base(name)
            counts[base] = counts.get(base, 0) + n
        return [{"name": k, "lines": v} for k, v in sorted(counts.items(), key=lambda kv: -kv[1])]

    def search(self, query: str, speaker: str = "") -> list[Line]:
        terms = search_terms(query)
        if not terms and not speaker.strip():
            return []
        return self._repo.search(terms, speaker_base(speaker) or None, SEARCH_LIMIT)

    @staticmethod
    def _checked(
        speaker: str | None, kind: str, text: str, stamp: str | None
    ) -> tuple[str | None, str, str | None]:
        """Valida i neteja el que es desa d'una línia: (personatge, text, marca de temps)."""
        text = text.strip()
        speaker = (speaker or "").strip() or None
        if kind not in EDITABLE_KINDS:
            raise InvalidInput("Tipus de línia no vàlid")
        if not text:
            raise InvalidInput("El text no pot quedar buit")
        if kind == "speech" and not speaker:
            raise InvalidInput("Una rèplica necessita personatge")
        try:
            stamp = normalize_stamp(stamp)
        except ValueError as exc:
            raise InvalidInput(str(exc)) from exc
        return (speaker if kind == "speech" else None), text, stamp

    def edit(
        self,
        line_id: int,
        speaker: str | None,
        kind: str,
        text: str,
        stamp: str | None,
        by: str,
    ) -> Line:
        speaker, text, stamp = self._checked(speaker, kind, text, stamp)
        return self._save(line_id, speaker, kind, text, stamp, by)

    def insert_after(
        self,
        line_id: int,
        speaker: str | None,
        kind: str,
        text: str,
        stamp: str | None,
        by: str,
    ) -> Line:
        """Afegeix una línia nova just a sota de `line_id`, a la mateixa escena."""
        speaker, text, stamp = self._checked(speaker, kind, text, stamp)
        line = self._repo.insert_after(line_id, speaker, kind, text, fold(text), stamp, by)
        if line is None:
            raise NotFound("Línia no trobada")
        return line

    def _save(
        self,
        line_id: int,
        speaker: str | None,
        kind: str,
        text: str,
        stamp: str | None,
        by: str,
    ) -> Line:
        line = self._repo.update(line_id, speaker, kind, text, fold(text), stamp, by)
        if line is None:
            raise NotFound("Línia no trobada")
        return line

    def history(self, line_id: int) -> list[Revision]:
        """Versions de la línia, de la més recent (la vigent) a l'original."""
        return self._repo.history(line_id)

    def restore(self, line_id: int, revision_id: int, by: str) -> Line:
        """Torna a una versió anterior: queda desada com una versió nova, sense esborrar res."""
        rev = self._repo.revision(revision_id)
        if rev is None or rev.line_id != line_id:
            raise NotFound("Versió no trobada")
        return self._save(line_id, rev.speaker, rev.kind, rev.text, rev.stamp, by)

    def export_lines(self) -> list[Line]:
        return self._repo.all_lines()

    def export_transcript(self) -> list[str]:
        """El text vigent en paràgrafs, en el format que llegeix `import_transcript`."""
        return to_transcript(self._repo.all_lines())

    def video_url(self) -> str | None:
        """Enllaç per reproduir el vídeo de l'obra; None si encara no s'ha pujat."""
        return self._media.video_url(VIDEO_NAME)

    def video_file(self):
        """El fitxer del vídeo, quan és al disc (només en local)."""
        return self._media.local_file(VIDEO_NAME)

    def pdf(self) -> bytes:
        """L'obra sencera amb el text vigent, en PDF."""
        return self._renderer.render(self._repo.all_lines(), "Cyrano de Bergerac")

    def import_transcript(self, paragraphs: list[str], force: bool = False) -> int:
        """Substitueix tot el text per l'importat (ordre CLI, no exposat a la web)."""
        edited = self._repo.edited_count()
        if edited and not force:
            raise InvalidInput(
                f"Hi ha {edited} línies editades; importar-ne esborraria les edicions i "
                "l'historial. Usa --force si és el que vols."
            )
        lines = parse_transcript(paragraphs)
        if not lines:
            raise InvalidInput("El document no conté cap línia")
        return self._repo.replace_all(lines, [fold(line.text) for line in lines])
