"""Línia d'ordres: migrate, create-user, seed-menu, import-legacy, hash-password i serve."""

from __future__ import annotations

import argparse
import getpass
from pathlib import Path

from .config import get_settings

DEFAULT_MENU = [
    # (nom, url, rols, posició)
    ("Calendari de la mare", "/apps/calendari/", "admin,germa", 10),
    ("Herència", "/apps/herencia/", "admin,germa", 20),
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
    sub.add_parser("seed-menu", help="Crea les entrades per defecte del menú (si no n'hi ha)")
    imp = sub.add_parser("import-legacy", help="Importa les dades de la web antiga (data/legacy)")
    imp.add_argument("--dir", default="data/legacy")
    imp.add_argument("--replace", action="store_true", help="Substitueix les dades existents")
    sub.add_parser("hash-password", help="Genera un hash bcrypt")
    srv = sub.add_parser("serve", help="Arrenca el servidor local")
    srv.add_argument("--port", type=int, default=8000)
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
        from sqlalchemy import func, select

        from .adapters.persistence import models as m
        from .adapters.persistence.engine import make_session_factory
        from .bootstrap import database_url
        from .migrate import upgrade

        url = database_url(settings)
        upgrade(settings.database_url_unpooled or url)
        with make_session_factory(url).begin() as s:
            if s.scalar(select(func.count()).select_from(m.ContentRow)):
                print("El menú ja té entrades; no es toca.")
                return
            for name, link, roles, pos in DEFAULT_MENU:
                s.add(m.ContentRow(name=name, url=link, roles=roles, position=pos))
        print("Menú creat.")
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
    elif args.cmd == "serve":
        import uvicorn

        uvicorn.run(
            "acalpere.adapters.web.app:create_app", factory=True, port=args.port, reload=True
        )
