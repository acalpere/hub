"""Línia d'ordres: migrate, create-user, seed-menu, import-legacy, hash-password i serve."""

from __future__ import annotations

import argparse
import getpass
from pathlib import Path

from .config import get_settings
from .domain.errors import DomainError

DEFAULT_MENU = [
    # (nom, url, rols, posició)
    ("Calendari de la mare", "/apps/calendari/", "admin,germa", 10),
    ("Herència", "/apps/herencia/", "admin,germa", 20),
    ("Poemes", "/apps/poemes/", "admin", 25),
    ("Cyrano", "/cyrano", "admin", 27),
    ("Webs i agents", "/hub", "admin", 30),
]


def main() -> None:
    parser = argparse.ArgumentParser(prog="acalpere")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("migrate", help="Aplica les migracions d'Alembic")
    usr = sub.add_parser("create-user", help="Crea un usuari")
    usr.add_argument("username")
    usr.add_argument("--role", choices=["admin", "germa"], default="admin")
    rol = sub.add_parser("set-role", help="Canvia el rol d'un usuari")
    rol.add_argument("username")
    rol.add_argument("role", choices=["admin", "germa"])
    pwd = sub.add_parser("set-password", help="Restableix la contrasenya d'un usuari")
    pwd.add_argument("username")
    mfa = sub.add_parser("reset-mfa", help="Esborra el segon factor (TOTP) d'un usuari")
    mfa.add_argument("username")
    sub.add_parser("seed-menu", help="Crea les entrades per defecte del menú (si no n'hi ha)")
    imp = sub.add_parser("import-legacy", help="Importa les dades de la web antiga (data/legacy)")
    imp.add_argument("--dir", default="data/legacy")
    imp.add_argument("--replace", action="store_true", help="Substitueix les dades existents")
    cyr = sub.add_parser("import-cyrano", help="Importa el text de Cyrano d'un .odt")
    cyr.add_argument("path", nargs="?", default="CyranoDeBergerac.odt")
    cyr.add_argument(
        "--force", action="store_true", help="Esborra també les edicions i l'historial"
    )
    exp = sub.add_parser("export-cyrano", help="Exporta el text vigent de Cyrano (.odt o .json)")
    exp.add_argument("path", nargs="?", help="Per defecte Cyrano-AAAA-MM-DD.odt")
    sub.add_parser("encrypt-herencia", help="Xifra les dades d'herència que encara són en clar")
    sub.add_parser("new-data-key", help="Genera una clau de xifratge (32 bytes, base64)")
    sub.add_parser("hash-password", help="Genera un hash bcrypt")
    srv = sub.add_parser("serve", help="Arrenca el servidor local")
    srv.add_argument("--port", type=int, default=8010)
    args = parser.parse_args()
    settings = get_settings()

    if args.cmd == "hash-password":
        from .security import hash_password

        print(hash_password(getpass.getpass("Contrasenya: ")))
    elif args.cmd == "migrate":
        from .migrate import upgrade

        upgrade(settings.database_url_unpooled or settings.database_url)
        print("Base de dades al dia.")
    elif args.cmd == "create-user":
        from .bootstrap import build_container

        user = build_container(settings).auth.create(
            args.username, getpass.getpass("Contrasenya: "), args.role
        )
        print(f"Usuari {user.username} creat amb rol {user.role}.")
    elif args.cmd == "reset-mfa":
        from .bootstrap import build_container

        build_container(settings).mfa.reset_totp(args.username)
        print(f"Segon factor de {args.username} esborrat.")
    elif args.cmd == "set-password":
        from .bootstrap import build_container

        new = getpass.getpass("Contrasenya nova: ")
        if new != getpass.getpass("Repeteix-la: "):
            raise SystemExit("No coincideixen.")
        user = build_container(settings).auth.reset_password(args.username, new)
        print(f"Contrasenya de {user.username} restablerta.")
    elif args.cmd == "set-role":
        from .bootstrap import build_container

        user = build_container(settings).auth.set_role(args.username, args.role)
        print(f"{user.username} ara és {user.role}.")
    elif args.cmd == "seed-menu":
        from sqlalchemy import select

        from .adapters.persistence import models as m
        from .adapters.persistence.engine import make_session_factory
        from .bootstrap import database_url
        from .migrate import upgrade

        url = database_url(settings)
        upgrade(settings.database_url_unpooled or url)
        with make_session_factory(url).begin() as s:
            created = 0
            for name, link, roles, pos in DEFAULT_MENU:
                if s.scalar(select(m.ContentRow.id).where(m.ContentRow.url == link)):
                    continue
                s.add(m.ContentRow(name=name, url=link, roles=roles, position=pos))
                created += 1
        print(f"Menú actualitzat: {created} entrades noves.")
    elif args.cmd == "import-legacy":
        from .adapters.persistence.engine import make_session_factory
        from .bootstrap import database_url
        from .legacy_import import import_legacy
        from .migrate import upgrade

        url = database_url(settings)
        upgrade(settings.database_url_unpooled or url)
        counts = import_legacy(make_session_factory(url), Path(args.dir), args.replace)
        for table, n in counts.items():
            print(f"{table:22} {n}")
        from .bootstrap import build_container

        print(f"Xifrades: {build_container(settings).inheritance.seal_all()} files")
    elif args.cmd == "import-cyrano":
        from .adapters.odt import read_paragraphs
        from .bootstrap import build_container

        try:
            n = build_container(settings).cyrano.import_transcript(
                read_paragraphs(Path(args.path)), args.force
            )
        except DomainError as exc:
            raise SystemExit(str(exc)) from exc
        print(f"Cyrano: {n} línies importades.")
    elif args.cmd == "export-cyrano":
        import json
        from dataclasses import asdict
        from datetime import date

        from .bootstrap import build_container

        cyrano = build_container(settings).cyrano
        path = Path(args.path or f"Cyrano-{date.today():%Y-%m-%d}.odt")
        if path.suffix == ".json":  # còpia sense pèrdues: totes les línies, amb els seus camps
            data = [asdict(line) for line in cyrano.export_lines()]
            path.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
        else:  # llegible, i es pot tornar a importar amb import-cyrano
            from .adapters.odt import write_paragraphs

            write_paragraphs(path, cyrano.export_transcript())
        print(f"Cyrano exportat a {path}")
    elif args.cmd == "encrypt-herencia":
        from .bootstrap import build_container

        print(f"Files xifrades: {build_container(settings).inheritance.seal_all()}")
    elif args.cmd == "new-data-key":
        from .adapters.crypto import new_key

        print(new_key())
    elif args.cmd == "serve":
        import uvicorn

        uvicorn.run(
            "acalpere.adapters.web.app:create_app", factory=True, port=args.port, reload=True
        )
