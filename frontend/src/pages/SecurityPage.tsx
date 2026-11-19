import { useCallback, useEffect, useState, type FormEvent } from "react";
import QRCode from "qrcode";
import { ErrorMessage } from "../components/ErrorMessage";
import { api, type Passkey } from "../api";
import { createPasskey, passkeysSupported, rememberPasskey } from "../passkeys";

// Una sola clau del segon factor per a tots els dispositius: en lloc de crear-ne una de nova a cada aparell,
// es torna a mostrar l'actual (amb un codi vàlid) i s'escaneja també al mòbil o a l'ordinador.
function TotpKey() {
  const [key, setKey] = useState<{ secret: string; qr: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function show(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = String(new FormData(e.currentTarget).get("code") ?? "");
    setBusy(true);
    setError("");
    try {
      const k = await api.mfaKey(code);
      setKey({ secret: k.secret, qr: await QRCode.toDataURL(k.uri, { margin: 1, width: 192 }) });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2>Clau de l'aplicació d'autenticació</h2>
      <p className="muted">
        La clau és una de sola per al teu compte. Per tenir-la en un altre dispositiu, no n'activis una de nova:
        escriu aquí el codi actual i escaneja el mateix QR (o escriu la clau) a l'altre aparell.
      </p>
      <ErrorMessage message={error} />
      {key ? (
        <div className="totp-key">
          <img className="qr" src={key.qr} alt="Codi QR del segon factor" width={192} height={192} />
          <p className="muted small">O introdueix aquesta clau: <code>{key.secret}</code></p>
          <button type="button" className="ghost" onClick={() => setKey(null)}>Amaga</button>
        </div>
      ) : (
        <form className="verse-add" onSubmit={(e) => void show(e)}>
          <input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={8} placeholder="Codi de 6 xifres" aria-label="Codi actual" required />
          <button type="submit" disabled={busy}>Mostra la clau</button>
        </form>
      )}
    </>
  );
}

export function SecurityPage() {
  const [keys, setKeys] = useState<Passkey[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api.passkeys().then(setKeys).catch((e) => setError(e.message)), []);
  useEffect(() => void load(), [load]);

  async function add() {
    setBusy(true);
    setError("");
    try {
      const credential = await createPasskey(await api.passkeyRegisterOptions());
      await api.passkeyRegister(credential, navigator.platform || "Aquest dispositiu");
      rememberPasskey();
      await load();
    } catch (e) {
      setError(e instanceof DOMException ? `No s'ha pogut registrar la petjada (${e.name}: ${e.message})` : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2 className="opt-title">Seguretat</h2>
      <p className="lead">
        Amb una clau d'accés pots entrar des del mòbil només amb la petjada digital. Des d'altres dispositius, l'accés
        sempre demana usuari, clau i codi de l'aplicació d'autenticació.
      </p>
      <ErrorMessage message={error} />
      <h2>Claus d'accés</h2>
      <ul className="rows">
        {keys.map((k) => (
          <li key={k.id}>
            <span>{k.label} <span className="muted">{k.created_at?.slice(0, 10)}</span></span>
            <button
              className="link danger"
              onClick={() => confirm(`Eliminar «${k.label}»?`) && void api.passkeyDelete(k.id).then(load)}
            >
              Eliminar
            </button>
          </li>
        ))}
        {keys.length === 0 && <li className="muted">Cap clau d'accés encara.</li>}
      </ul>
      {passkeysSupported() ? (
        <button disabled={busy} onClick={() => void add()}>Afegir la petjada d'aquest dispositiu</button>
      ) : (
        <p className="muted">Aquest navegador no admet claus d'accés.</p>
      )}
      <TotpKey />
    </section>
  );
}
