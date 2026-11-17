"""Poemes (paquet motfinal) incrustat al hub: usa la sessió, els rols i la base de dades del hub."""

API = "/api/v1/poemes"


def test_poemes_requires_login(client):
    assert client.get(f"{API}/poems").status_code == 401
    assert client.get(f"{API}/words/synonyms?word=feina").status_code == 401


def test_poemes_is_not_open_to_users_without_the_app(germa, client):
    assert client.get(f"{API}/poems").status_code == 403


def test_admin_writes_and_reads_poems(admin, client):
    created = client.post(
        f"{API}/poems", json={"title": "", "body": "\nCom un mar de sal,\nvers dos"}
    )
    assert created.status_code == 201
    poem = created.json()
    assert poem["title"] == "Com un mar de sal"  # títol provisional del primer vers
    saved = client.put(
        f"{API}/poems/{poem['id']}",
        json={"title": "Mar", "body": poem["body"], "status": "finished"},
    )
    assert saved.json()["finished_at"] is not None
    assert [p["title"] for p in client.get(f"{API}/poems").json()] == ["Mar"]
    assert client.delete(f"{API}/poems/{poem['id']}").status_code == 204


def test_poems_writes_need_the_hub_csrf_header(admin, client):
    r = client.post(f"{API}/poems", json={}, headers={"X-Requested-With": ""})
    assert r.status_code == 403


def test_synonyms_come_from_the_packaged_dictionary(admin, client):
    data = client.get(f"{API}/words/synonyms?word=feina").json()
    assert "tasca" in data["synonyms"]
