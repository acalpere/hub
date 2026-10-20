from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from ....bootstrap import Container
from ....domain.identity import ROLES, User
from .. import shapes
from ..deps import admin_user, container, current_user

router = APIRouter(tags=["auth"])


class LoginIn(BaseModel):
    usuari: str = Field(max_length=50)
    clau: str = Field(max_length=200)


class PasswordIn(BaseModel):
    actual: str = Field(max_length=200)
    nova: str = Field(max_length=200)


class UserIn(BaseModel):
    username: str = Field(max_length=50)
    password: str = Field(max_length=200)
    role: str = Field(pattern="^(" + "|".join(ROLES) + ")$")


@router.post("/auth/login")
def login(body: LoginIn, request: Request, c: Container = Depends(container)):
    user = c.auth.login(body.usuari, body.clau)
    request.session.clear()  # evita la fixació de sessió
    request.session["uid"] = user.id
    return shapes.user(user)


@router.post("/auth/logout")
def logout(request: Request):
    request.session.clear()
    return {"status": "ok"}


@router.get("/auth/me")
def me(user: User = Depends(current_user)):
    return shapes.user(user)


@router.post("/auth/password")
def change_password(
    body: PasswordIn, user: User = Depends(current_user), c: Container = Depends(container)
):
    c.auth.change_password(user.id, body.actual, body.nova)
    return {"status": "ok"}


@router.get("/menu")
def menu(user: User = Depends(current_user), c: Container = Depends(container)):
    return [shapes.content(x) for x in c.menu.for_role(user.role)]


@router.get("/users", dependencies=[Depends(admin_user)])
def users(c: Container = Depends(container)):
    return [shapes.user(u) for u in c.auth.list_users()]


@router.post("/users", status_code=201, dependencies=[Depends(admin_user)])
def create_user(body: UserIn, c: Container = Depends(container)):
    return shapes.user(c.auth.create(body.username, body.password, body.role))
