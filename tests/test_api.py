import time

import bcrypt
from conftest import TOTP_SECRET, login

from acalpere.security import Totp

PHP_HASH = (
    bcrypt.hashpw(b"altra", bcrypt.gensalt(4)).decode().replace("$2b$", "$2y$", 1)
)  # com els de PHP


def test_health_is_public(client):
    assert client.get("/api/health").json()["status"] == "ok"


def test_api_requires_login(client):
    assert client.get("/api/v1/calendar").status_code == 401
    assert client.get("/api/v1/herencia/pisos").status_code == 401
    assert client.get("/api/v1/hub/sites").status_code == 401


def test_login_wrong_password_and_unknown_user_look_the_same(client):
    a = client.post("/api/v1/auth/login", json={"usuari": "Pere", "clau": "x"})
    b = client.post("/api/v1/auth/login", json={"usuari": "ningu", "clau": "x"})
    assert a.status_code == b.status_code == 401
    assert a.json()["error"] == b.json()["error"] == "Usuari o clau incorrectes."


def test_login_is_case_insensitive_like_the_old_site(client):
    assert login(client, "pere").get("/api/v1/auth/me").json()["role"] == "admin"


def test_old_php_bcrypt_hash_still_works(container, client):
    from acalpere.adapters.persistence import models as m
    from acalpere.adapters.persistence.engine import make_session_factory

    with make_session_factory(container.settings.database_url).begin() as s:
        s.add(m.UserRow(username="Antic", password_hash=PHP_HASH, role="admin"))
    r = client.post("/api/v1/auth/login", json={"usuari": "Antic", "clau": "no-es-aquesta"})
    assert r.status_code == 401  # el hash es llegeix bé i la clau errònia es rebutja


def test_mutations_need_the_csrf_header(client):
    r = client.post("/api/v1/auth/logout", headers={"X-Requested-With": ""})
    assert r.status_code == 403


def test_menu_depends_on_role(admin, client):
    assert [x["name"] for x in client.get("/api/v1/menu").json()] == [
        "Calendari",
        "Herència",
        "Hub",
    ]
    client.post("/api/v1/auth/logout")
    login(client, "Jordi", "altra-clau-prova")
    assert [x["name"] for x in client.get("/api/v1/menu").json()] == ["Calendari", "Herència"]


def test_calendar_flow(germa, client):
    day = "2026-02-01"
    r = client.post(
        "/api/v1/calendar/assignment", json={"date": day, "brother_id": 1, "modality_id": 1}
    )
    assert r.json() == {"success": True, "action": "added"}
    # un segon germà al poble: permès
    client.post(
        "/api/v1/calendar/assignment", json={"date": day, "brother_id": 2, "modality_id": 1}
    )
    # a casa amb gent al poble: no
    r = client.post(
        "/api/v1/calendar/assignment", json={"date": day, "brother_id": 3, "modality_id": 2}
    )
    assert r.status_code == 409 and "gent al poble" in r.json()["error"]

    data = client.get("/api/v1/calendar").json()
    assert data["success"] and len(data["assignments"]) == 2
    first = data["assignments"][0]
    assert first["modality_code"] == "poble" and first["nom_germa"] == "Rosa Maria"
    assert first["data_assignacio"] == day
    assert data["last_modification"]["nom_germa"] == "Pere"  # la darrera assignació creada

    # toggle: el mateix germà ho desfà
    r = client.post(
        "/api/v1/calendar/assignment", json={"date": day, "brother_id": 1, "modality_id": 1}
    )
    assert r.json()["action"] == "removed"
    assert len(client.get("/api/v1/calendar").json()["assignments"]) == 1

    actions = [h["accio"] for h in client.get("/api/v1/calendar/history").json()["history"]]
    assert sorted(actions) == ["DELETE", "INSERT", "INSERT"]
    assert client.get("/api/v1/calendar/stats").json()["stats"][0]["total_assignacions"] == 1


def test_calendar_legacy_delete_clears_the_day(germa, client):
    for b in (1, 2):
        client.post(
            "/api/v1/assignment", json={"date": "2026-03-01", "brother_id": b, "modality_id": 1}
        )
    r = client.request("DELETE", "/api/v1/assignment", json={"date": "2026-03-01"})
    assert r.status_code == 200
    assert client.get("/api/v1/calendar").json()["assignments"] == []
    r = client.request("DELETE", "/api/v1/assignment", json={"date": "2026-03-01"})
    assert r.status_code == 404


def test_calendar_export_import_roundtrip(germa, client):
    client.post(
        "/api/v1/assignment", json={"date": "2026-04-01", "brother_id": 1, "modality_id": 1}
    )
    exported = client.get("/api/v1/calendar/export")
    assert "attachment" in exported.headers["content-disposition"]
    client.request("DELETE", "/api/v1/assignment", json={"date": "2026-04-01"})
    r = client.post(
        "/api/v1/calendar/import", files={"file": ("c.json", exported.content, "application/json")}
    )
    assert r.json()["added"] == 1
    assert len(client.get("/api/v1/calendar").json()["assignments"]) == 1


def test_herencia_requires_recent_verification(germa, client, monkeypatch):
    blocked = client.get("/api/v1/herencia/pisos")
    assert blocked.status_code == 403 and blocked.json()["detail"] == "reverify"
    assert client.post("/api/v1/herencia/xat", json={"text": "hola"}).status_code == 403
    bad = client.post("/api/v1/auth/reverify/code", json={"code": "000000"})
    assert bad.status_code == 401
    assert client.get("/api/v1/herencia/pisos").status_code == 403
    ok = client.post("/api/v1/auth/reverify/code", json={"code": Totp().code(TOTP_SECRET)})
    assert ok.status_code == 200
    assert client.get("/api/v1/herencia/pisos").status_code == 200
    # la sessió oberta no n'hi ha prou: passat el temps cal tornar a verificar
    from acalpere.adapters.web import deps

    later = time.time() + 600
    monkeypatch.setattr(deps.time, "time", lambda: later)
    assert client.get("/api/v1/herencia/pisos").status_code == 403


def test_reverify_requires_a_session(client):
    assert client.post("/api/v1/auth/reverify/code", json={"code": "123456"}).status_code == 401


def test_herencia(germa, client):
    client.post("/api/v1/auth/reverify/code", json={"code": Totp().code(TOTP_SECRET)})
    pisos = client.get("/api/v1/herencia/pisos").json()
    assert (
        pisos[0]["Fills_codi"] == 1
        and pisos[0]["nom_fill"] == "Pere"
        and pisos[0]["nom_finca"] == "Finca A"
    )
    assert client.get("/api/v1/herencia/repartiment").json()["1"] == {
        "nom": "Pere",
        "patrimoni": 150,
        "rendiment": 10,
    }
    client.post("/api/v1/herencia/reassignar_pis", json={"pis_id": 1, "nou_fill_id": 2})
    assert client.get("/api/v1/herencia/repartiment").json()["2"]["patrimoni"] == 100

    ok = client.post(
        "/api/v1/herencia/guardar_proposta",
        json={"pis_id": 1, "camp": "propostajordi", "fill_id": 2},
    )
    assert ok.status_code == 200
    assert client.get("/api/v1/herencia/pisos").json()[0]["propostajordi"] == 2
    bad = client.post(
        "/api/v1/herencia/guardar_proposta", json={"pis_id": 1, "camp": "taxacio", "fill_id": 2}
    )
    assert bad.status_code == 400  # només es poden escriure els camps de proposta

    client.post(
        "/api/v1/herencia/guardar_proposta",
        json={
            "pis_id": 1,
            "camp": "propostapere",
            "fill_id": 1,
            "codi_fill": 1,
            "llivia": 1,
            "vol": 1,
            "taxacio": 2,
            "valorVol": 200000,
        },
    )
    assert client.get("/api/v1/herencia/parametres/1").json() == {
        "codiFill": 1,
        "vol": 1,
        "valorVol": 200000,
        "llivia": 1,
        "taxacio": "2",
    }
    assert client.get("/api/v1/herencia/parametres/99").json() == {}


def test_herencia_comments_and_chat(germa, client):
    client.post("/api/v1/auth/reverify/code", json={"code": Totp().code(TOTP_SECRET)})
    client.post("/api/v1/herencia/fills/1/comentari", json={"comentari": "Hola"})
    f = client.get("/api/v1/herencia/fills/1").json()
    assert f["comentari"] == "Hola" and f["diaIHora"]
    assert (
        client.post("/api/v1/herencia/fills/99/comentari", json={"comentari": "x"}).status_code
        == 404
    )
    client.post("/api/v1/herencia/xat", json={"autor": "Jordi", "text": "Bon dia"})
    assert client.get("/api/v1/herencia/xat").json()[0]["text"] == "Bon dia"
    assert client.post("/api/v1/herencia/xat", json={"autor": "", "text": "x"}).status_code == 400


def test_hub_management_is_admin_only(germa, client):
    assert client.get("/api/v1/hub/sites").json() == []  # sense autoritzacions no veu res
    body = {"name": "x", "url": "https://x.cat"}
    assert client.post("/api/v1/hub/sites", json=body).status_code == 403
    assert client.get("/api/v1/users").status_code == 403
    assert client.get("/api/v1/users/1/access").status_code == 403
    assert client.put("/api/v1/users/1/access", json={}).status_code == 403


def test_users_only_see_the_sites_and_agents_they_are_granted(client, container):
    login(client)
    s1 = client.post("/api/v1/hub/sites", json={"name": "A", "url": "https://a.cat"}).json()["id"]
    s2 = client.post("/api/v1/hub/sites", json={"name": "B", "url": "https://b.cat"}).json()["id"]
    a1 = client.post("/api/v1/hub/agents", json={"name": "Ag1", "kind": "k"}).json()["id"]
    client.post("/api/v1/hub/agents", json={"name": "Ag2", "kind": "k"})
    assert len(client.get("/api/v1/hub/sites").json()) == 2 + 6  # ho veu tot (6 de projectes)
    jordi = next(u["id"] for u in client.get("/api/v1/users").json() if u["username"] == "Jordi")
    r = client.put(f"/api/v1/users/{jordi}/access", json={"site_ids": [s1], "agent_ids": [a1]})
    assert r.json() == {
        "site_ids": [s1],
        "agent_ids": [a1],
        "work_agent_ids": [],
        "content_ids": [],
    }
    assert client.put(f"/api/v1/users/{jordi}/access", json={"site_ids": [999]}).status_code == 400
    assert client.put("/api/v1/users/999/access", json={}).status_code == 404
    client.post("/api/v1/auth/logout")

    login(client, "Jordi", "altra-clau-prova")
    assert [s["id"] for s in client.get("/api/v1/hub/sites").json()] == [s1]
    assert [a["id"] for a in client.get("/api/v1/hub/agents").json()] == [a1]
    assert s2 not in [s["id"] for s in client.get("/api/v1/hub/sites").json()]


def test_hub_sites_and_agents(admin, client):
    r = client.post(
        "/api/v1/hub/sites", json={"name": "acalpere.cat", "url": "https://acalpere.cat"}
    )
    assert r.status_code == 201
    site_id = r.json()["id"]
    assert client.post("/api/v1/hub/sites", json={"name": "x", "url": "ftp://x"}).status_code == 400
    r = client.post(
        "/api/v1/hub/agents",
        json={
            "name": "Màrqueting",
            "kind": "marketing",
            "site_id": site_id,
            "config": {"canal": "instagram"},
        },
    )
    assert r.status_code == 201 and r.json()["config"] == {"canal": "instagram"}
    agent_id = r.json()["id"]
    r = client.patch(f"/api/v1/hub/agents/{agent_id}", json={"enabled": False})
    assert r.json()["enabled"] is False and r.json()["name"] == "Màrqueting"
    assert (
        client.post(
            "/api/v1/hub/agents", json={"name": "a", "kind": "k", "site_id": 99}
        ).status_code
        == 400
    )
    assert client.delete(f"/api/v1/hub/sites/{site_id}").status_code == 204
    assert client.get(f"/api/v1/hub/agents/{agent_id}").json()["site_id"] is None  # SET NULL
    assert client.delete("/api/v1/hub/agents/999").status_code == 404


def test_user_management(admin, client):
    r = client.post(
        "/api/v1/users", json={"username": "Nou", "password": "una-clau-llarga", "role": "germa"}
    )
    assert r.status_code == 201
    assert (
        client.post(
            "/api/v1/users",
            json={"username": "nou", "password": "una-clau-llarga", "role": "germa"},
        ).status_code
        == 409
    )
    assert (
        client.post(
            "/api/v1/users", json={"username": "X", "password": "curta", "role": "germa"}
        ).status_code
        == 400
    )
    assert (
        client.post(
            "/api/v1/users", json={"username": "Y", "password": "una-clau-llarga", "role": "root"}
        ).status_code
        == 422
    )


def test_change_password(admin, client):
    assert (
        client.post(
            "/api/v1/auth/password", json={"actual": "malament", "nova": "una-clau-nova-1"}
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/v1/auth/password", json={"actual": "clau-de-prova", "nova": "una-clau-nova-1"}
        ).status_code
        == 200
    )
    client.post("/api/v1/auth/logout")
    login(client, "Pere", "una-clau-nova-1")


def test_set_role_removes_admin_access(container, client):
    login(client, "Jordi", "altra-clau-prova")
    assert client.get("/api/v1/users").status_code == 403
    container.auth.set_role("jordi", "admin")
    assert client.get("/api/v1/users").status_code == 200
    container.auth.set_role("Jordi", "germa")
    assert client.get("/api/v1/users").status_code == 403


def test_admin_password_reset(container, client):
    container.auth.reset_password("jordi", "una-clau-nova-2")
    assert (
        client.post(
            "/api/v1/auth/login", json={"usuari": "Jordi", "clau": "altra-clau-prova"}
        ).status_code
        == 401
    )
    login(client, "Jordi", "una-clau-nova-2")


def test_password_alone_does_not_open_a_session(client):
    r = client.post("/api/v1/auth/login", json={"usuari": "Pere", "clau": "clau-de-prova"})
    assert r.json() == {"status": "mfa_required"}
    assert client.get("/api/v1/auth/me").status_code == 401
    assert client.post("/api/v1/auth/mfa", json={"code": "000000"}).status_code == 401
    assert client.get("/api/v1/auth/me").status_code == 401


def test_mfa_without_password_is_rejected(client):
    assert client.post("/api/v1/auth/mfa", json={"code": "123456"}).status_code == 401


def test_mfa_attempts_are_limited(client):
    client.post("/api/v1/auth/login", json={"usuari": "Pere", "clau": "clau-de-prova"})
    for _ in range(5):
        client.post("/api/v1/auth/mfa", json={"code": "000000"})
    good = Totp().code(TOTP_SECRET)
    assert client.post("/api/v1/auth/mfa", json={"code": good}).status_code == 401


def test_user_without_totp_must_enroll_before_getting_in(container, client):
    user = container.auth.create("Nova", "clau-nova-1234", "germa")
    r = client.post("/api/v1/auth/login", json={"usuari": "Nova", "clau": "clau-nova-1234"})
    assert r.json() == {"status": "mfa_setup"}
    assert client.get("/api/v1/auth/me").status_code == 401
    secret = client.post("/api/v1/auth/mfa/setup").json()["secret"]
    assert client.post("/api/v1/auth/mfa/enable", json={"code": "000000"}).status_code == 401
    r = client.post("/api/v1/auth/mfa/enable", json={"code": Totp().code(secret)})
    assert r.status_code == 200 and r.json()["id"] == user.id
    assert client.get("/api/v1/auth/me").status_code == 200


def test_totp_matches_rfc6238_vector():
    # RFC 6238, SHA-1, T=59 s: 94287082 (8 xifres) -> els 6 últims: 287082
    assert Totp().code("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", at=59) == "287082"


def test_passkey_login_needs_a_known_origin_and_challenge(client):
    assert client.post("/api/v1/auth/passkey/options").status_code == 401  # sense Origin
    r = client.post("/api/v1/auth/passkey/options", headers={"Origin": "https://acalpere.cat"})
    assert r.status_code == 200 and r.json()["rpId"] == "acalpere.cat"
    bad = client.post(
        "/api/v1/auth/passkey/login",
        json={"credential": {"id": "desconeguda"}},
        headers={"Origin": "https://acalpere.cat"},
    )
    assert bad.status_code == 401
    assert client.get("/api/v1/auth/me").status_code == 401


def test_passkey_management_requires_login(client):
    assert client.get("/api/v1/auth/passkeys").status_code == 401
    assert client.post("/api/v1/auth/passkeys/options").status_code == 401


def test_new_user_role_sees_only_what_is_granted(client, container):
    container.auth.create("Visita", "clau-visita-1234", "usuari")
    from conftest import TOTP_SECRET

    container.mfa._users.set_totp_secret(container.auth.list_users()[-1].id, TOTP_SECRET)
    login(client)
    uid = next(u["id"] for u in client.get("/api/v1/users").json() if u["username"] == "Visita")
    cal = next(c["id"] for c in client.get("/api/v1/contents").json() if c["name"] == "Calendari")
    ag = client.post("/api/v1/hub/agents", json={"name": "Ag", "kind": "k"}).json()["id"]
    client.post("/api/v1/auth/logout")

    login(client, "Visita", "clau-visita-1234")
    assert client.get("/api/v1/menu").json() == []
    assert client.get("/api/v1/calendar").status_code == 403
    client.post("/api/v1/auth/logout")

    login(client)
    body = {"content_ids": [cal], "work_agent_ids": [ag]}
    assert client.put(f"/api/v1/users/{uid}/access", json=body).json()["agent_ids"] == [ag]
    client.post("/api/v1/auth/logout")

    login(client, "Visita", "clau-visita-1234")
    assert [c["name"] for c in client.get("/api/v1/menu").json()] == ["Calendari"]
    assert client.get("/api/v1/calendar").status_code == 200
    r = client.put(f"/api/v1/hub/agents/{ag}/enabled", json={"enabled": False})
    assert r.status_code == 200 and r.json()["enabled"] is False
    assert client.patch(f"/api/v1/hub/agents/{ag}", json={"name": "x"}).status_code == 403


def test_viewing_an_agent_does_not_allow_working_with_it(client, container):
    login(client)
    ag = client.post("/api/v1/hub/agents", json={"name": "Ag", "kind": "k"}).json()["id"]
    jordi = next(u["id"] for u in client.get("/api/v1/users").json() if u["username"] == "Jordi")
    client.put(f"/api/v1/users/{jordi}/access", json={"agent_ids": [ag]})
    client.post("/api/v1/auth/logout")
    login(client, "Jordi", "altra-clau-prova")
    assert len(client.get("/api/v1/hub/agents").json()) == 1
    assert (
        client.put(f"/api/v1/hub/agents/{ag}/enabled", json={"enabled": False}).status_code == 403
    )


def test_edit_user_profile_and_keep_one_admin(client):
    login(client)
    users = {u["username"]: u["id"] for u in client.get("/api/v1/users").json()}
    body = {
        "username": "Jordi V",
        "role": "germa",
        "first_name": "Jordi",
        "last_name": "Vilarasau",
        "email": "jordi@example.com",
        "phone": "+34 600 111 222",
    }
    r = client.put(f"/api/v1/users/{users['Jordi']}", json=body)
    assert r.status_code == 200 and r.json()["last_name"] == "Vilarasau"
    assert client.get("/api/v1/users").json()[1]["email"] == "jordi@example.com"
    assert (
        client.put(f"/api/v1/users/{users['Jordi']}", json={**body, "email": "no"}).status_code
        == 400
    )
    assert (
        client.put(f"/api/v1/users/{users['Jordi']}", json={**body, "phone": "abc"}).status_code
        == 400
    )
    assert (
        client.put(f"/api/v1/users/{users['Jordi']}", json={**body, "username": "pere"}).status_code
        == 409
    )
    assert client.put("/api/v1/users/999", json=body).status_code == 404
    # l'únic administrador no es pot degradar
    assert (
        client.put(f"/api/v1/users/{users['Pere']}", json={**body, "username": "Pere"}).status_code
        == 400
    )
    # només administradors
    client.post("/api/v1/auth/logout")
    login(client, "Jordi V", "altra-clau-prova")
    assert client.put(f"/api/v1/users/{users['Jordi']}", json=body).status_code == 403


def test_create_user_with_profile(admin, client):
    r = client.post(
        "/api/v1/users",
        json={
            "username": "Laia",
            "password": "una-clau-llarga",
            "role": "usuari",
            "first_name": "Laia",
            "last_name": "Puig",
            "email": "laia@example.com",
            "phone": "600123123",
        },
    )
    assert r.status_code == 201 and r.json()["first_name"] == "Laia"


def test_old_sessions_without_mfa_are_not_valid(client):
    import base64
    import json

    from itsdangerous import TimestampSigner

    login(client)
    assert client.get("/api/v1/auth/me").status_code == 200
    # una galeta antiga: només `uid`, sense la versió de sessió
    signer = TimestampSigner("test")
    data = base64.b64encode(json.dumps({"uid": 1}).encode())
    client.cookies.set("acalpere_session", signer.sign(data).decode())
    assert client.get("/api/v1/auth/me").status_code == 401


def test_passkeys_are_admin_only(germa, client):
    assert client.get("/api/v1/auth/passkeys").status_code == 403
    assert client.post("/api/v1/auth/passkeys/options").status_code == 403
