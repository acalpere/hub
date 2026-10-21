from __future__ import annotations

import time
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from webauthn.helpers import base64url_to_bytes, bytes_to_base64url

from ....bootstrap import Container
from ....domain.errors import AuthError
from ....domain.identity import ROLES, User
from .. import shapes
from ..deps import SESSION_VERSION, admin_user, container, current_user

router = APIRouter(tags=["auth"])

MAX_MFA_TRIES = 5


class LoginIn(BaseModel):
    usuari: str = Field(max_length=50)
    clau: str = Field(max_length=200)


class PasswordIn(BaseModel):
    actual: str = Field(max_length=200)
    nova: str = Field(max_length=200)


_ROLE = "^(" + "|".join(ROLES) + ")$"


class UserIn(BaseModel):
    username: str = Field(max_length=50)
    password: str = Field(max_length=200)
    role: str = Field(pattern=_ROLE)
    first_name: str = Field(default="", max_length=100)
    last_name: str = Field(default="", max_length=150)
    email: str = Field(default="", max_length=200)
    phone: str = Field(default="", max_length=30)


class UserPatch(BaseModel):
    username: str = Field(max_length=50)
    role: str = Field(pattern=_ROLE)
    first_name: str = Field(default="", max_length=100)
    last_name: str = Field(default="", max_length=150)
    email: str = Field(default="", max_length=200)
    phone: str = Field(default="", max_length=30)


def _finish_login(request: Request, user: User) -> dict:
    request.session.clear()  # evita la fixació de sessió
    request.session["uid"] = user.id
    request.session["at"] = int(time.time())
    request.session["v"] = SESSION_VERSION
    return shapes.user(user)


def _pending_user(request: Request, c: Container) -> User:
    """Usuari que ha posat la clau però encara no ha superat el segon factor."""
    uid = request.session.get("pending_uid")
    user = c.auth.get(uid) if uid else None
    if user is None:
        raise AuthError("Cal tornar a posar l'usuari i la clau.")
    return user


def _count_try(request: Request) -> None:
    """Limita els intents de codi: passat el límit cal tornar a posar la clau."""
    tries = request.session.get("mfa_tries", 0) + 1
    if tries > MAX_MFA_TRIES:
        request.session.clear()
        raise AuthError("Massa intents. Torna a començar.")
    request.session["mfa_tries"] = tries


def _origin(request: Request, c: Container) -> tuple[str, str]:
    """(rp_id, origen) de WebAuthn; amb rp_id configurat, l'origen del navegador ha de coincidir."""
    origin = request.headers.get("origin", "")
    host = urlparse(origin).hostname
    if not host or (c.settings.rp_id and host != c.settings.rp_id):
        raise AuthError("Origen no permès.")
    return host, origin


@router.post("/auth/login")
def login(body: LoginIn, request: Request, c: Container = Depends(container)):
    """Primer pas (usuari i clau). El segon factor és obligatori: codi TOTP o enrolament."""
    user = c.auth.login(body.usuari, body.clau)
    request.session.clear()
    request.session["pending_uid"] = user.id
    return {"status": "mfa_required" if user.totp_secret else "mfa_setup"}


class CodeIn(BaseModel):
    code: str = Field(max_length=20)


@router.post("/auth/mfa")
def mfa(body: CodeIn, request: Request, c: Container = Depends(container)):
    user = _pending_user(request, c)
    _count_try(request)
    c.mfa.check_totp(user, body.code)
    return _finish_login(request, user)


@router.post("/auth/mfa/setup")
def mfa_setup(request: Request, c: Container = Depends(container)):
    user = _pending_user(request, c)
    if user.totp_secret:
        raise AuthError("El segon factor ja està configurat.")
    secret, uri = c.mfa.new_totp_secret(user)
    request.session["pending_totp"] = secret
    return {"secret": secret, "uri": uri}


@router.post("/auth/mfa/enable")
def mfa_enable(body: CodeIn, request: Request, c: Container = Depends(container)):
    user = _pending_user(request, c)
    secret = request.session.get("pending_totp")
    if user.totp_secret or not secret:
        raise AuthError("Torna a començar la configuració.")
    _count_try(request)
    c.mfa.enable_totp(user, secret, body.code)
    return _finish_login(request, user)


@router.post("/auth/passkey/options")
def passkey_login_options(request: Request, c: Container = Depends(container)):
    rp_id, _ = _origin(request, c)
    options, challenge = c.mfa.authentication_options(rp_id)
    request.session["webauthn"] = bytes_to_base64url(challenge)
    return options


@router.post("/auth/passkey/login")
def passkey_login(body: CredentialIn, request: Request, c: Container = Depends(container)):
    """Entrada amb la petjada digital: la clau d'accés ja verifica l'usuari, no cal TOTP."""
    rp_id, origin = _origin(request, c)
    challenge = request.session.pop("webauthn", None)
    if not challenge:
        raise AuthError("Torna-ho a provar.")
    user = c.mfa.login_with_passkey(body.credential, base64url_to_bytes(challenge), rp_id, origin)
    if not user.is_admin:
        raise AuthError("L'entrada amb petjada digital és només per a administradors.")
    return _finish_login(request, user)


class CredentialIn(BaseModel):
    credential: dict
    label: str = Field(default="", max_length=80)


@router.get("/auth/passkeys")
def passkeys(user: User = Depends(admin_user), c: Container = Depends(container)):
    return [
        {"id": p.id, "label": p.label, "created_at": shapes._dt(p.created_at)}
        for p in c.mfa.passkeys(user)
    ]


@router.post("/auth/passkeys/options")
def passkey_register_options(
    request: Request, user: User = Depends(admin_user), c: Container = Depends(container)
):
    rp_id, _ = _origin(request, c)
    options, challenge = c.mfa.registration_options(user, rp_id)
    request.session["webauthn"] = bytes_to_base64url(challenge)
    return options


@router.post("/auth/passkeys", status_code=201)
def passkey_register(
    body: CredentialIn,
    request: Request,
    user: User = Depends(admin_user),
    c: Container = Depends(container),
):
    rp_id, origin = _origin(request, c)
    challenge = request.session.pop("webauthn", None)
    if not challenge:
        raise AuthError("Torna-ho a provar.")
    p = c.mfa.register_passkey(
        user, body.credential, base64url_to_bytes(challenge), rp_id, origin, body.label
    )
    return {"id": p.id, "label": p.label, "created_at": shapes._dt(p.created_at)}


@router.delete("/auth/passkeys/{passkey_id}", status_code=204)
def passkey_delete(
    passkey_id: int, user: User = Depends(admin_user), c: Container = Depends(container)
):
    c.mfa.delete_passkey(user, passkey_id)


def _verified(request: Request) -> dict:
    request.session.pop("mfa_tries", None)
    request.session["verified_at"] = int(time.time())
    return {"status": "ok"}


@router.post("/auth/reverify/code")
def reverify_code(
    body: CodeIn,
    request: Request,
    user: User = Depends(current_user),
    c: Container = Depends(container),
):
    """Verificació addicional per a contingut delicat (Herència): codi de l'autenticador."""
    _count_try(request)
    c.mfa.check_totp(user, body.code)
    return _verified(request)


@router.post("/auth/reverify/passkey/options")
def reverify_passkey_options(
    request: Request, user: User = Depends(current_user), c: Container = Depends(container)
):
    return passkey_login_options(request, c)


@router.post("/auth/reverify/passkey")
def reverify_passkey(
    body: CredentialIn,
    request: Request,
    user: User = Depends(current_user),
    c: Container = Depends(container),
):
    """Verificació addicional amb la petjada: la clau ha de ser de qui té la sessió oberta."""
    rp_id, origin = _origin(request, c)
    challenge = request.session.pop("webauthn", None)
    if not challenge:
        raise AuthError("Torna-ho a provar.")
    owner = c.mfa.login_with_passkey(body.credential, base64url_to_bytes(challenge), rp_id, origin)
    if owner.id != user.id:
        raise AuthError("Aquesta clau d'accés no és teva.")
    return _verified(request)


@router.post("/auth/reverify/end")
def reverify_end(request: Request):
    """En sortir d'Herència la verificació caduca: la propera vegada cal tornar-la a fer."""
    request.session.pop("verified_at", None)
    return {"status": "ok"}


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
    return [shapes.content(x) for x in c.menu.for_user(user)]


@router.get("/users", dependencies=[Depends(admin_user)])
def users(c: Container = Depends(container)):
    return [shapes.user(u) for u in c.auth.list_users()]


@router.post("/users", status_code=201, dependencies=[Depends(admin_user)])
def create_user(body: UserIn, c: Container = Depends(container)):
    return shapes.user(
        c.auth.create(
            body.username,
            body.password,
            body.role,
            body.first_name,
            body.last_name,
            body.email,
            body.phone,
        )
    )


@router.put("/users/{user_id}", dependencies=[Depends(admin_user)])
def update_user(user_id: int, body: UserPatch, c: Container = Depends(container)):
    return shapes.user(
        c.auth.update_user(
            user_id,
            body.username,
            body.role,
            body.first_name,
            body.last_name,
            body.email,
            body.phone,
        )
    )


class AccessIn(BaseModel):
    site_ids: list[int] = Field(default_factory=list, max_length=500)
    agent_ids: list[int] = Field(default_factory=list, max_length=500)
    work_agent_ids: list[int] = Field(default_factory=list, max_length=500)
    content_ids: list[int] = Field(default_factory=list, max_length=500)


def _access(a) -> dict:
    return {
        "site_ids": sorted(a.site_ids),
        "agent_ids": sorted(a.agent_ids),
        "work_agent_ids": sorted(a.work_agent_ids),
        "content_ids": sorted(a.content_ids),
    }


@router.get("/contents", dependencies=[Depends(admin_user)])
def contents(c: Container = Depends(container)):
    """Totes les apps del menú, per assignar-les (inclou els rols que les veuen)."""
    return [{**shapes.content(x), "roles": list(x.roles)} for x in c.menu.all()]


@router.get("/users/{user_id}/access", dependencies=[Depends(admin_user)])
def user_access(user_id: int, c: Container = Depends(container)):
    return _access(c.hub.access_of(user_id))


@router.put("/users/{user_id}/access", dependencies=[Depends(admin_user)])
def set_user_access(user_id: int, body: AccessIn, c: Container = Depends(container)):
    return _access(
        c.hub.set_access(
            user_id, body.site_ids, body.agent_ids, body.work_agent_ids, body.content_ids
        )
    )
