"""Adaptador d'entrada web: API REST amb FastAPI (sessió en galeta signada)."""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException
from starlette.middleware.sessions import SessionMiddleware

from ...bootstrap import Container, build_container
from ...config import Settings, get_settings
from ...domain.errors import AuthError, Conflict, DomainError, Forbidden, InvalidInput, NotFound
from .routes import auth, calendar, herencia, hub

CSRF_HEADER = "x-requested-with"
CSRF_VALUE = "acalpere"
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}

_STATUS = {AuthError: 401, Forbidden: 403, NotFound: 404, Conflict: 409, InvalidInput: 400}


def _error(status: int, message: str) -> JSONResponse:
    # `error` és la clau que llegeixen els frontends antics; `detail` és l'estàndard de FastAPI.
    return JSONResponse({"success": False, "error": message, "detail": message}, status_code=status)


def create_app(settings: Settings | None = None, container: Container | None = None) -> FastAPI:
    settings = settings or get_settings()
    c = container or build_container(settings)
    settings = c.settings  # amb el secret de sessió ja resolt (SSM a AWS)

    app = FastAPI(
        title="acalpere",
        docs_url="/api/docs" if settings.env == "local" else None,
        redoc_url=None,
        openapi_url="/api/openapi.json" if settings.env == "local" else None,
    )
    app.state.container = c

    @app.middleware("http")
    async def csrf(request: Request, call_next):
        # Una pàgina d'un altre origen no pot posar aquesta capçalera sense permís de CORS.
        if (
            request.url.path.startswith("/api/")
            and request.method not in SAFE_METHODS
            and request.headers.get(CSRF_HEADER) != CSRF_VALUE
        ):
            return _error(403, "Falta la capçalera X-Requested-With")
        return await call_next(request)

    app.add_middleware(
        SessionMiddleware,
        secret_key=settings.secret_key,
        session_cookie="acalpere_session",
        same_site="lax",
        https_only=settings.secure_cookies,
        max_age=None,  # galeta de sessió: en tancar el navegador cal tornar a entrar
    )
    if settings.cors_origin_list:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origin_list,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["Content-Type", "X-Requested-With"],
        )

    @app.exception_handler(DomainError)
    async def domain_error(_: Request, exc: DomainError):
        status = next((s for t, s in _STATUS.items() if isinstance(exc, t)), 400)
        return _error(status, str(exc))

    @app.exception_handler(HTTPException)
    async def http_error(_: Request, exc: HTTPException):
        return _error(exc.status_code, str(exc.detail))

    @app.get("/api/health")
    def health():
        return {"status": "ok", "env": settings.env}

    for router in (auth.router, calendar.router, herencia.router, hub.router):
        app.include_router(router, prefix="/api/v1")
    return app
