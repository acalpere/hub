"""Incrusta el paquet `motfinal` (poemes/) al hub: la seva API penja de /api/v1/poemes.

El hub aporta les sessions de base de dades i l'autorització (rol/autorització de l'app
«/apps/poemes/»); `motfinal` no sap res de comptes ni de galetes del hub. La interfície
(HTML/JS/CSS) no passa per aquí: `scripts/sync-poemes-ui.mjs` la copia a
frontend/public/apps/poemes.
"""

from __future__ import annotations

from collections.abc import Iterator

from fastapi import FastAPI, Request
from sqlalchemy.orm import Session

from .deps import app_access

POEMES_URL = "/apps/poemes/"
API_PREFIX = "/api/v1/poemes"


def mount_poemes(app: FastAPI) -> None:
    from motfinal.adapters.persistence.config import Settings as MotSettings
    from motfinal.adapters.web.api import build_router
    from motfinal.bootstrap import build_services

    # La base de dades de motfinal no s'usa aquí: les sessions són les del hub.
    services = build_services(MotSettings(_env_file=None))

    def get_session(request: Request) -> Iterator[Session]:
        with request.app.state.container.session_factory() as session:
            yield session

    access = app_access(POEMES_URL)
    app.include_router(
        build_router(services, get_session, poems_access=access, words_access=access),
        prefix=API_PREFIX,
        tags=["poemes"],
    )
