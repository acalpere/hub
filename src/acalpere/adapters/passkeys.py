"""Adaptador WebAuthn (biblioteca `webauthn`): claus d'accés amb verificació d'usuari (petjada)."""

from __future__ import annotations

import json

from webauthn import (
    generate_authentication_options,
    generate_registration_options,
    options_to_json,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers import base64url_to_bytes, bytes_to_base64url
from webauthn.helpers.exceptions import InvalidAuthenticationResponse, InvalidRegistrationResponse
from webauthn.helpers.structs import (
    AuthenticatorAttachment,
    AuthenticatorSelectionCriteria,
    PublicKeyCredentialDescriptor,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

from ..domain.errors import AuthError
from ..domain.identity import Passkey, PasskeyCredential


class WebAuthnVerifier:
    def registration_options(
        self, rp_id: str, user_id: int, username: str, existing: list[str]
    ) -> tuple[dict, bytes]:
        options = generate_registration_options(
            rp_id=rp_id,
            rp_name="acalpere",
            user_id=str(user_id).encode(),
            user_name=username,
            # Clau del dispositiu (petjada/cara/PIN), descobrible: entrar sense escriure l'usuari.
            authenticator_selection=AuthenticatorSelectionCriteria(
                authenticator_attachment=AuthenticatorAttachment.PLATFORM,
                resident_key=ResidentKeyRequirement.REQUIRED,
                user_verification=UserVerificationRequirement.REQUIRED,
            ),
            exclude_credentials=[
                PublicKeyCredentialDescriptor(id=base64url_to_bytes(c)) for c in existing
            ],
        )
        return json.loads(options_to_json(options)), options.challenge

    def verify_registration(
        self, response: dict, challenge: bytes, rp_id: str, origin: str
    ) -> PasskeyCredential:
        try:
            v = verify_registration_response(
                credential=response,
                expected_challenge=challenge,
                expected_rp_id=rp_id,
                expected_origin=origin,
                require_user_verification=True,
            )
        except (InvalidRegistrationResponse, ValueError, KeyError) as e:
            raise AuthError("No s'ha pogut registrar la clau d'accés.") from e
        return PasskeyCredential(
            bytes_to_base64url(v.credential_id),
            bytes_to_base64url(v.credential_public_key),
            v.sign_count,
        )

    def authentication_options(self, rp_id: str) -> tuple[dict, bytes]:
        options = generate_authentication_options(
            rp_id=rp_id, user_verification=UserVerificationRequirement.REQUIRED
        )
        return json.loads(options_to_json(options)), options.challenge

    def credential_id(self, response: dict) -> str:
        try:
            return str(response["id"])
        except (KeyError, TypeError) as e:
            raise AuthError("Resposta no vàlida.") from e

    def verify_authentication(
        self, response: dict, challenge: bytes, rp_id: str, origin: str, passkey: Passkey
    ) -> int:
        try:
            v = verify_authentication_response(
                credential=response,
                expected_challenge=challenge,
                expected_rp_id=rp_id,
                expected_origin=origin,
                credential_public_key=base64url_to_bytes(passkey.public_key),
                credential_current_sign_count=passkey.sign_count,
                require_user_verification=True,
            )
        except (InvalidAuthenticationResponse, ValueError, KeyError) as e:
            raise AuthError("No s'ha pogut verificar la clau d'accés.") from e
        return v.new_sign_count
