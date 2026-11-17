from __future__ import annotations

import argparse
import gzip
from collections.abc import Iterator
from pathlib import Path

from sqlalchemy import delete, func, select, text

from motfinal.adapters.linguistics.catalan import CatalanWordAnalyzer
from motfinal.adapters.persistence.database import SessionFactory
from motfinal.adapters.persistence.models import WordRecord
from motfinal.adapters.persistence.repository import SqlAlchemyWordRepository
from motfinal.application.import_words import ImportWords


def hunspell_words(path: Path) -> Iterator[str]:
    with path.open(encoding="utf-8-sig") as source:
        first_line = True
        for raw_line in source:
            line = raw_line.strip()
            if first_line and line.isdigit():
                first_line = False
                continue
            first_line = False
            if not line:
                continue
            entry = line.split(maxsplit=1)[0]
            yield entry.split("/", 1)[0]


def text_words(path: Path) -> Iterator[str]:
    source_file = (
        gzip.open(path, mode="rt", encoding="utf-8")
        if path.suffix.casefold() == ".gz"
        else path.open(encoding="utf-8")
    )
    with source_file as source:
        for line in source:
            yield line.strip()


def import_file(path: Path, hunspell: bool, batch_size: int, replace: bool = False) -> int:
    source = hunspell_words(path) if hunspell else text_words(path)
    with SessionFactory() as session:
        if replace:
            bind = session.get_bind()
            if bind.dialect.name == "postgresql":
                # TRUNCATE replaces the physical table and index files.  A DELETE
                # leaves the old PostgreSQL index pages allocated, which can keep
                # a small Neon project at its storage limit even with zero rows.
                session.execute(text("TRUNCATE TABLE words RESTART IDENTITY"))
            else:
                session.execute(delete(WordRecord))
            session.commit()
        use_case = ImportWords(
            repository=SqlAlchemyWordRepository(session),
            analyzer=CatalanWordAnalyzer(),
        )
        return use_case.execute(source, batch_size=batch_size)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="motfinal")
    subparsers = parser.add_subparsers(dest="command", required=True)
    importer = subparsers.add_parser("import", help="Importa un fitxer de mots")
    importer.add_argument("path", type=Path)
    importer.add_argument("--hunspell", action="store_true", help="Interpreta un fitxer .dic")
    importer.add_argument("--batch-size", type=int, default=1000)
    importer.add_argument(
        "--replace", action="store_true", help="Substitueix el lèxic generat existent"
    )
    count = subparsers.add_parser("count", help="Compta els mots carregats")
    count.add_argument("--plain", action="store_true")
    subparsers.add_parser(
        "hash-password", help="Genera el hash de la contrasenya d'accés als poemes"
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()
    if args.command == "import":
        imported = import_file(args.path, args.hunspell, args.batch_size, args.replace)
        print(f"S'han importat {imported} mots nous.")
    elif args.command == "hash-password":
        import getpass
        import secrets

        from motfinal.application.access import hash_password

        password = getpass.getpass("Contrasenya: ")
        if len(password) < 10 or password != getpass.getpass("Repeteix-la: "):
            raise SystemExit("Cal una contrasenya de 10+ caràcters, escrita igual dues vegades.")
        print(f"ACCESS_PASSWORD_HASH={hash_password(password)}")
        print(f"SESSION_SECRET={secrets.token_urlsafe(48)}")
    elif args.command == "count":
        with SessionFactory() as session:
            total = session.scalar(select(func.count()).select_from(WordRecord)) or 0
        print(total if args.plain else f"El lèxic conté {total} mots.")


if __name__ == "__main__":
    main()
