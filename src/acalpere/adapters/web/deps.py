"""Dependències de FastAPI: contenidor, usuari de la sessió i comprovació de rol."""

from __future__ import annotations

from fastapi import Depends, HTTPException, Request

from ...bootstrap import Container
from ...domain.identity import User


def container(request: Request) -> Container:
    return request.app.state.container


def current_user(request: Request, c: Container = Depends(container)) -> User:
    uid = request.session.get("uid")
    user = c.auth.get(uid) if uid else None
    if user is None:
        request.session.pop("uid", None)  # compte eliminat des que es va iniciar la sessió
        raise HTTPException(status_code=401, detail="Cal iniciar sessió")
    return user


def admin_user(user: User = Depends(current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Cal ser administrador")
    return user
