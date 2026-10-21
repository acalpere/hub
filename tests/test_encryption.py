import pytest
from sqlalchemy import select, text

from acalpere.adapters.crypto import AesGcmCipher, new_key
from acalpere.adapters.persistence import models as m
from acalpere.adapters.persistence.engine import make_session_factory
from acalpere.adapters.persistence.repos import SqlInheritanceRepository
from acalpere.bootstrap import build_container, make_cipher
from acalpere.config import Settings
from acalpere.domain.inheritance import Parametres


@pytest.fixture
def repo(settings, container):
    sf = make_session_factory(settings.database_url)
    return SqlInheritanceRepository(sf, AesGcmCipher(new_key())), sf


def raw(sf, sql):
    with sf() as s:
        return s.execute(text(sql)).all()


def test_cipher_roundtrip_and_tamper_detection():
    c = AesGcmCipher(new_key())
    token = c.encrypt("secret", "pisos")
    assert "secret" not in token and c.decrypt(token, "pisos") == "secret"
    assert c.encrypt("secret", "pisos") != token  # nonce nou a cada xifratge
    with pytest.raises(ValueError):
        c.decrypt(token, "fills")  # una altra taula
    with pytest.raises(ValueError):
        AesGcmCipher(new_key()).decrypt(token, "pisos")  # una altra clau
    with pytest.raises(ValueError):
        AesGcmCipher("AAAA")  # clau curta


def test_seal_all_encrypts_existing_rows_and_keeps_reading(repo):
    repo, sf = repo
    before = {p.codi: p for p in repo.pisos()}
    assert repo.seal_all() > 0 and repo.seal_all() == 0  # idempotent
    assert {p.codi: p for p in repo.pisos()} == before
    nom, taxacio, dades = raw(sf, "select nom, taxacio, dades from pisos where codi = 1")[0]
    assert nom == "" and taxacio is None and dades.startswith("v1.")
    assert "Pis 1" not in dades and "Finca A" not in str(raw(sf, "select * from finques"))
    assert repo.fill(1).nom == "Pere"


def test_writes_are_sealed(repo):
    repo, sf = repo
    repo.set_proposal(1, "proposta_jordi", 2)
    repo.save_parametres(Parametres(fill_codi=1, vol=5, valor_vol=7, llivia=True, taxacio=2))
    repo.set_comentari(1, "molt delicat")
    repo.add_missatge("Pere", "missatge privat")
    assert next(p for p in repo.pisos() if p.codi == 1).proposta_jordi == 2
    assert repo.parametres(1) == Parametres(1, 5, 7, True, 2)
    assert repo.fill(1).comentari == "molt delicat"
    assert [(x.autor, x.text) for x in repo.missatges()] == [("Pere", "missatge privat")]
    dump = str(raw(sf, "select * from fills")) + str(raw(sf, "select * from missatges"))
    dump += str(raw(sf, "select * from parametres"))
    for clear in ("molt delicat", "missatge privat", "Pere"):
        assert clear not in dump


def test_who_owns_each_flat_is_sealed(repo):
    repo, sf = repo
    repo.seal_all()
    assert repo.reassign_pis(1, 2)
    assert {p.codi: p.fill_codi for p in repo.pisos()} == {1: 2, 2: 1}
    assert raw(sf, "select fill_codi from pisos order by codi") == [(None,), (None,)]
    assert not repo.reassign_pis(99, 1)


def test_nothing_sensitive_is_left_in_clear(repo):
    repo, sf = repo
    repo.set_comentari(1, "x")
    repo.add_missatge("Pere", "hola")
    repo.seal_all()
    assert (
        raw(sf, "select fill_codi, finca_codi, nom, pis from pisos") == [(None, None, "", None)] * 2
    )
    assert raw(sf, "select nom, comentari, dia_i_hora from fills") == [(None, "", None)] * 2
    assert raw(sf, "select autor, text, dia_i_hora from missatges") == [("", "", None)]
    assert raw(sf, "select nom, taxacio, comunitat from finques") == [(None, None, None)]
    assert repo.fill(1).dia_i_hora is not None and repo.pisos()[0].finca_codi == 1
    assert repo.missatges()[0].dia_i_hora is not None


def test_wrong_key_fails_instead_of_returning_garbage(repo, settings):
    repo, sf = repo
    repo.seal_all()
    other = SqlInheritanceRepository(sf, AesGcmCipher(new_key()))
    with pytest.raises(ValueError):
        other.pisos()


def test_outside_local_a_key_is_required():
    with pytest.raises(RuntimeError):
        make_cipher(Settings(env="prod", _env_file=None))
    assert isinstance(
        make_cipher(Settings(env="prod", data_key=new_key(), _env_file=None)), AesGcmCipher
    )


def test_container_with_key_stores_ciphertext(tmp_path):
    settings = Settings(
        database_url=f"sqlite:///{tmp_path / 'k.db'}", secret_key="t", data_key=new_key(),
        _env_file=None,
    )  # fmt: skip
    c = build_container(settings)
    sf = make_session_factory(settings.database_url)
    with sf.begin() as s:
        s.add(m.FillRow(codi=1, nom="Pere"))
    assert c.inheritance.seal_all() == 1
    c.inheritance.set_comentari(1, "hola")
    assert c.inheritance.fill(1).comentari == "hola"
    with sf() as s:
        row = s.scalars(select(m.FillRow)).one()
        assert (row.nom, row.comentari) == (None, "")
        assert row.dades.startswith("v1.")
