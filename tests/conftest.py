import pytest
from fastapi.testclient import TestClient

from acalpere.adapters.persistence import models as m
from acalpere.adapters.persistence.engine import make_session_factory
from acalpere.adapters.web.app import create_app
from acalpere.bootstrap import build_container
from acalpere.config import Settings
from acalpere.security import Totp

CSRF = {"X-Requested-With": "acalpere"}
TOTP_SECRET = "JBSWY3DPEHPK3PXP"


@pytest.fixture
def settings(tmp_path):
    return Settings(
        database_url=f"sqlite:///{tmp_path / 'test.db'}", secret_key="test", _env_file=None
    )


@pytest.fixture
def container(settings):
    c = build_container(settings)
    sf = make_session_factory(settings.database_url)
    with sf.begin() as s:
        s.add_all(
            [
                m.GermaRow(id=1, nom="Rosa Maria", codi="germà1", color="#ff6b6b"),
                m.GermaRow(id=2, nom="Pere", codi="germà2", color="#FFF9C4"),
                m.GermaRow(id=3, nom="Jordi", codi="germà3", color="#45b7d1"),
                m.ModalitatRow(id=1, nom="Seré al poble", codi="poble"),
                m.ModalitatRow(id=2, nom="A casa de la mare", codi="casa"),
                m.FillRow(codi=1, nom="Pere"),
                m.FillRow(codi=2, nom="Jordi"),
                m.FincaRow(codi=1, nom="Finca A"),
                m.PisRow(codi=1, finca_codi=1, fill_codi=1, nom="Pis 1", taxacio=100, rendiment=10),
                m.PisRow(
                    codi=2, finca_codi=1, fill_codi=1, nom="Pis 2", taxacio=50, rendiment=None
                ),
                m.ContentRow(
                    name="Calendari", url="/apps/calendari/", roles="admin,germa", position=1
                ),
                m.ContentRow(
                    name="Herència", url="/apps/herencia/", roles="admin,germa", position=2
                ),
                m.ContentRow(name="Hub", url="/hub", roles="admin", position=3),
            ]
        )
    for name, password, role in (
        ("Pere", "clau-de-prova", "admin"),
        ("Jordi", "altra-clau-prova", "germa"),
    ):
        user = c.auth.create(name, password, role)
        if role != "admin":  # el menú és per autoritzacions expresses
            ids = [x.id for x in c.menu.all() if role in x.roles]
            c.hub.set_access(user.id, [], [], [], ids)
        c.mfa._users.set_totp_secret(user.id, TOTP_SECRET)  # segon factor ja enrolat
    return c


@pytest.fixture
def client(settings, container):
    return TestClient(create_app(settings, container), headers=CSRF)


def login(client, user="Pere", password="clau-de-prova"):
    r = client.post("/api/v1/auth/login", json={"usuari": user, "clau": password})
    assert r.status_code == 200, r.text
    r = client.post("/api/v1/auth/mfa", json={"code": Totp().code(TOTP_SECRET)})
    assert r.status_code == 200, r.text
    return client


@pytest.fixture
def admin(client):
    return login(client)


@pytest.fixture
def germa(client):
    return login(client, "Jordi", "altra-clau-prova")
