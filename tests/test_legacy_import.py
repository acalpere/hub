import json

import bcrypt
import pytest
from sqlalchemy import func, select

from acalpere.adapters.persistence import models as m
from acalpere.adapters.persistence.engine import make_session_factory
from acalpere.legacy_import import import_legacy

HASH = bcrypt.hashpw(b"x", bcrypt.gensalt(4)).decode().replace("$2b$", "$2y$", 1)


@pytest.fixture
def dump(tmp_path):
    def write(name, data):
        (tmp_path / f"{name}.data.json").write_text(json.dumps(data), encoding="utf-8")

    write(
        "acalpere",
        {
            "usuaris": [
                {
                    "codi": 7,
                    "usuari": "Pere",
                    "clau": HASH,
                    "tipus": "admin",
                    "creat_el": "2025-01-01T10:00:00",
                }
            ]
        },
    )
    write(
        "acp_calendari",
        {
            "germans": [
                {
                    "id": 1,
                    "nom": "Pere",
                    "codi": "g1",
                    "color": "#fff",
                    "actiu": 1,
                    "data_creacio": "2025-01-01T10:00:00",
                }
            ],
            "modalitats": [
                {
                    "id": 1,
                    "nom": "Poble",
                    "codi": "poble",
                    "descripcio": None,
                    "actiu": 1,
                    "data_creacio": "2025-01-01T10:00:00",
                }
            ],
            "configuracio": [],
            "assignacions": [
                {
                    "id": 50,
                    "data_assignacio": "2025-07-13",
                    "germa_id": 1,
                    "modalitat_id": 1,
                    "data_creacio": "2025-07-13T10:00:00",
                    "data_modificacio": "2025-07-13T10:00:00",
                    "creat_per": 1,
                    "modificat_per": None,
                }
            ],
            "historial_canvis": [],
            "darrera_modificacio": [{"id": 1, "timestamp": "2025-07-13T10:00:00"}],
        },
    )
    write(
        "acp_herencia",
        {
            "Fills": [
                {"codi": 1, "nom": "Pere", "comentari": "Hola", "diaIHora": "2025-06-19T12:35:18"},
                {"codi": 3, "nom": "Rosa", "comentari": "", "diaIHora": None},
            ],
            "Finques": [{"codi": 1, "nom": "F", "taxacio": 1, "comunitat": 2, "comunitat2": 3}],
            "Pisos": [
                {
                    "codi": 9,
                    "Finques_codi": 1,
                    "Fills_codi": 1,
                    "pis": "1",
                    "porta": "2",
                    "nom": "P",
                    "taxacio": 10,
                    "taxacio2": 11,
                    "rendiment": 5,
                    "rendiment2": 6,
                    "prorrateig": 1,
                    "prorrateig2": 2,
                    "actual": 1,
                    "propostapere": 1,
                    "propostajordi": 3,
                    "propostarosamaria": 3,
                }
            ],
            "Parametres": [
                {"codiFill": 0, "vol": 1, "valorVol": 470748, "llivia": 1, "taxacio": "2"}
            ],
            "Missatges": [
                {"id": 1, "autor": "Pere", "text": "Hola", "diaIHora": "2025-06-19T12:35:18"}
            ],
        },
    )
    return tmp_path


def test_import_keeps_ids_hashes_and_nulls(tmp_path, dump):
    sf = make_session_factory(f"sqlite:///{tmp_path / 'new.db'}")
    from acalpere.migrate import upgrade

    upgrade(f"sqlite:///{tmp_path / 'new.db'}")
    counts = import_legacy(sf, dump)
    assert counts["users"] == 1 and counts["assignacions"] == 1 and counts["pisos"] == 1
    with sf() as s:
        user = s.get(m.UserRow, 7)
        assert user.password_hash == HASH and user.role == "admin"
        assert s.get(m.AssignacioRow, 50).germa_id == 1
        assert s.get(m.FillRow, 3).dia_i_hora is None  # data buida d'MySQL
        assert s.get(m.PisRow, 9).proposta_jordi == 3
        assert s.get(m.ParametresRow, 0).taxacio == 2  # enum '2' -> enter


def test_import_refuses_to_overwrite_unless_asked(tmp_path, dump):
    url = f"sqlite:///{tmp_path / 'new.db'}"
    from acalpere.migrate import upgrade

    upgrade(url)
    sf = make_session_factory(url)
    import_legacy(sf, dump)
    with pytest.raises(RuntimeError, match="ja tenen dades"):
        import_legacy(sf, dump)
    import_legacy(sf, dump, replace=True)  # idempotent amb --replace
    with sf() as s:
        assert s.scalar(select(func.count()).select_from(m.UserRow)) == 1
