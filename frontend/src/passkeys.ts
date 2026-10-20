// WebAuthn al navegador: claus d'accés protegides per la petjada digital (o cara/PIN) del dispositiu.
// Es fan servir les utilitats natives (JSON ↔ credencial), disponibles als navegadors actuals.
// La versió de lib.dom de TypeScript encara no inclou les utilitats JSON de WebAuthn.
interface JsonCapable {
  parseCreationOptionsFromJSON(o: unknown): CredentialCreationOptions["publicKey"];
  parseRequestOptionsFromJSON(o: unknown): CredentialRequestOptions["publicKey"];
}
const jsonApi = () => PublicKeyCredential as unknown as JsonCapable;
const toJSON = (c: PublicKeyCredential) => (c as unknown as { toJSON(): unknown }).toJSON();

export function passkeysSupported(): boolean {
  return typeof window !== "undefined" && "PublicKeyCredential" in window && "parseCreationOptionsFromJSON" in PublicKeyCredential;
}

export function isTouchDevice(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

export async function createPasskey(options: unknown): Promise<unknown> {
  const publicKey = jsonApi().parseCreationOptionsFromJSON(options);
  const credential = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential | null;
  if (!credential) throw new Error("Operació cancel·lada");
  return toJSON(credential);
}

export async function getPasskey(options: unknown): Promise<unknown> {
  const publicKey = jsonApi().parseRequestOptionsFromJSON(options);
  const credential = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential | null;
  if (!credential) throw new Error("Operació cancel·lada");
  return toJSON(credential);
}

// Marca d'aquest dispositiu: ja té una clau d'accés, així que a l'entrada es demana la petjada directament.
const KEY = "acalpere.passkey";
export function rememberPasskey(): void {
  try { localStorage.setItem(KEY, "1"); } catch { /* sense emmagatzematge: no passa res */ }
}
export function hasRememberedPasskey(): boolean {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}
