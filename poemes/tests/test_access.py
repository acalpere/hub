import time

from motfinal.application.access import AccessControl, hash_password, verify_password


def test_password_hash_roundtrip() -> None:
    stored = hash_password("una contrasenya llarga")
    assert verify_password("una contrasenya llarga", stored)
    assert not verify_password("una altra", stored)
    assert not verify_password("x", "res-valid")


def test_session_token_validity_and_expiry() -> None:
    now = [time.time()]
    access = AccessControl(hash_password("secret-password"), "s" * 32, 60, clock=lambda: now[0])
    assert access.login("incorrecta") is None
    token = access.login("secret-password")
    assert token and access.is_valid(token)
    assert not access.is_valid(token + "x")
    assert not access.is_valid(None)
    now[0] += 61
    assert not access.is_valid(token)


def test_unconfigured_access_never_validates() -> None:
    access = AccessControl(None, None)
    assert not access.configured
    assert access.login("x") is None
    assert not access.is_valid("1.abc")
