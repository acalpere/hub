import { useCallback, useEffect, useState } from "react";
import { api, type Passkey } from "../api";
import { createPasskey, passkeysSupported } from "../passkeys";

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
      await load();
    } catch (e) {
      setError(e instanceof DOMException ? "Operació cancel·lada" : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h1>Seguretat</h1>
      <p className="lead">
        Amb una clau d'accés pots entrar des del mòbil només amb la petjada digital. Des d'altres dispositius, l'accés
        sempre demana usuari, clau i codi de l'aplicació d'autenticació.
      </p>
      {error && <p role="alert" className="error">{error}</p>}
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
    </section>
  );
}
