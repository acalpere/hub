"""MotFinal com a aplicació independent: servidor propi, contrasenya pròpia i interfície a «/»."""

from __future__ import annotations

import time
from collections import defaultdict
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request, Response
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from motfinal.adapters.persistence.config import get_settings
from motfinal.adapters.persistence.database import get_session
from motfinal.adapters.web.api import build_router
from motfinal.adapters.web.schemas import LoginInput, SessionResponse
from motfinal.application.access import AccessControl
from motfinal.bootstrap import build_services

UI_DIR = Path(__file__).resolve().parent / "ui"
settings = get_settings()
services = build_services(settings)

app = FastAPI(
    title="MotFinal",
    version="0.1.0",
    description="Cerca de mots catalans per síl·laba final, tonicitat i context semàntic.",
)
api = APIRouter(prefix="/api/v1")



access = AccessControl(
    settings.access_password_hash,
    settings.session_secret,
    ttl_seconds=settings.session_hours * 3600,
)
SESSION_COOKIE = "motfinal_session"
_failed_logins: dict[str, list[float]] = defaultdict(list)


def _open_access() -> bool:
    """Sense contrasenya només es permet en desenvolupament local."""
    return settings.environment == "development" and not access.configured


def require_access(request: Request) -> None:
    unsafe = request.method not in {"GET", "HEAD"}
    if unsafe and request.headers.get("x-requested-with") != "motfinal":
        raise HTTPException(status_code=403, detail="Petició no permesa.")
    if _open_access():
        return
    if not access.configured:
        raise HTTPException(status_code=503, detail="L'accés als poemes no està configurat.")
    if not access.is_valid(request.cookies.get(SESSION_COOKIE)):
        raise HTTPException(status_code=401, detail="Cal iniciar sessió.")


@api.get("/session", response_model=SessionResponse)
def session_status(request: Request) -> SessionResponse:
    return SessionResponse(
        required=not _open_access(),
        authenticated=_open_access() or access.is_valid(request.cookies.get(SESSION_COOKIE)),
    )


@api.post("/session", response_model=SessionResponse)
def login(payload: LoginInput, request: Request, response: Response) -> SessionResponse:
    if request.headers.get("x-requested-with") != "motfinal":
        raise HTTPException(status_code=403, detail="Petició no permesa.")
    if not access.configured:
        raise HTTPException(status_code=503, detail="L'accés als poemes no està configurat.")
    client = request.client.host if request.client else "?"
    now = time.monotonic()
    recent = [t for t in _failed_logins[client] if now - t < 300]
    _failed_logins[client] = recent
    if len(recent) >= 5:
        raise HTTPException(status_code=429, detail="Massa intents. Torna-ho a provar més tard.")
    token = access.login(payload.password)
    if token is None:
        _failed_logins[client].append(now)
        raise HTTPException(status_code=401, detail="Contrasenya incorrecta.")
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=settings.session_hours * 3600,
        httponly=True,
        secure=settings.environment != "development",
        samesite="lax",
    )
    return SessionResponse(required=True, authenticated=True)


@api.delete("/session", status_code=204)
def logout(request: Request, response: Response) -> None:
    if request.headers.get("x-requested-with") != "motfinal":
        raise HTTPException(status_code=403, detail="Petició no permesa.")
    response.delete_cookie(SESSION_COOKIE)




api.include_router(build_router(services, get_session, poems_access=require_access))
app.include_router(api)


@app.get("/health", include_in_schema=False)
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/ready", include_in_schema=False)
def ready(session: Annotated[Session, Depends(get_session)]) -> dict[str, str]:
    try:
        session.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Base de dades no disponible") from exc
    return {"status": "ready"}


# La interfície, al final perquè no tapi res de l'API.
app.mount("/", StaticFiles(directory=UI_DIR, html=True), name="ui")
