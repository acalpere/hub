import bcrypt
from conftest import login

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
    assert [x["name"] for x in client.get("/api/v1/menu").json()] == ["Calendari", "Hub"]
    client.post("/api/v1/auth/logout")
    login(client, "Jordi", "altra-clau-prova")
    assert [x["name"] for x in client.get("/api/v1/menu").json()] == ["Calendari"]


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


def test_herencia(germa, client):
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


def test_hub_is_admin_only(germa, client):
    assert client.get("/api/v1/hub/sites").status_code == 403


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


def test_set_role_removes_hub_access(container, client):
    login(client, "Jordi", "altra-clau-prova")
    assert client.get("/api/v1/hub/sites").status_code == 403
    container.auth.set_role("jordi", "admin")
    assert client.get("/api/v1/hub/sites").status_code == 200
    container.auth.set_role("Jordi", "germa")
    assert client.get("/api/v1/hub/sites").status_code == 403


def test_admin_password_reset(container, client):
    container.auth.reset_password("jordi", "una-clau-nova-2")
    assert (
        client.post(
            "/api/v1/auth/login", json={"usuari": "Jordi", "clau": "altra-clau-prova"}
        ).status_code
        == 401
    )
    login(client, "Jordi", "una-clau-nova-2")
