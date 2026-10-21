// WebAuthn al navegador: claus d'accés protegides per la petjada digital (o cara/PIN) del dispositiu.
// La conversió JSON ↔ credencial es fa a mà: les utilitats natives encara falten a molts mòbils.
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const toBuffer = (b64url: string): ArrayBuffer => {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(b64url.length / 4) * 4, "=");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
};
const fromBuffer = (buf: ArrayBuffer | null | undefined): string | undefined =>
  buf == null
    ? undefined
    : btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const descriptors = (list: Json[] | undefined) => list?.map((d) => ({ ...d, id: toBuffer(d.id) }));

export function passkeysSupported(): boolean {
  return typeof window !== "undefined" && "PublicKeyCredential" in window && !!navigator.credentials;
}

export function isTouchDevice(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

function serialize(c: PublicKeyCredential): Json {
  const r = c.response as AuthenticatorAttestationResponse & AuthenticatorAssertionResponse;
  const response: Json = { clientDataJSON: fromBuffer(r.clientDataJSON) };
  if (r.attestationObject) {
    response.attestationObject = fromBuffer(r.attestationObject);
    response.transports = r.getTransports?.() ?? [];
  } else {
    response.authenticatorData = fromBuffer(r.authenticatorData);
    response.signature = fromBuffer(r.signature);
    response.userHandle = fromBuffer(r.userHandle);
  }
  return {
    id: c.id,
    rawId: fromBuffer(c.rawId),
    type: c.type,
    authenticatorAttachment: c.authenticatorAttachment,
    clientExtensionResults: c.getClientExtensionResults(),
    response,
  };
}

export async function createPasskey(options: Json): Promise<unknown> {
  const publicKey = {
    ...options,
    challenge: toBuffer(options.challenge),
    user: { ...options.user, id: toBuffer(options.user.id) },
    excludeCredentials: descriptors(options.excludeCredentials),
  } as PublicKeyCredentialCreationOptions;
  const credential = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential | null;
  if (!credential) throw new Error("Operació cancel·lada");
  return serialize(credential);
}

export async function getPasskey(options: Json): Promise<unknown> {
  const publicKey = {
    ...options,
    challenge: toBuffer(options.challenge),
    allowCredentials: descriptors(options.allowCredentials),
  } as PublicKeyCredentialRequestOptions;
  const credential = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential | null;
  if (!credential) throw new Error("Operació cancel·lada");
  return serialize(credential);
}

// Marca d'aquest dispositiu: ja té una clau d'accés, així que a l'entrada es demana la petjada directament.
const KEY = "acalpere.passkey";
export function rememberPasskey(): void {
  try { localStorage.setItem(KEY, "1"); } catch { /* sense emmagatzematge: no passa res */ }
}
export function hasRememberedPasskey(): boolean {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}
