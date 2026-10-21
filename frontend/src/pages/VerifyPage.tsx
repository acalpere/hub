import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import { api } from "../api";
import { ErrorMessage } from "../components/ErrorMessage";
import { validate } from "../forms";
import { getPasskey, isTouchDevice, passkeysSupported } from "../passkeys";
import { safeNext } from "./LoginPage";

// Contingut delicat (Herència): encara que la sessió sigui oberta, cal confirmar amb la petjada o el codi.
export function VerifyPage() {
  const [params] = useSearchParams();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const next = safeNext(params.get("next"));
  const passkeys = passkeysSupported();
  const mobile = isTouchDevice();

  // Les apps antigues són pàgines estàtiques: es hi torna amb una navegació completa.
  const done = () => window.location.assign(next);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
      done();
    } catch (err) {
      setError(
        err instanceof DOMException
          ? "Cancel·lat, o aquest dispositiu no té cap clau d'accés teva. Usa el codi de l'autenticador."
          : (err as Error).message,
      );
      setBusy(false);
    }
  }

  const fingerprint = () => void run(async () => api.reverifyPasskey(await getPasskey(await api.reverifyPasskeyOptions())));

  useEffect(() => {
    if (mobile && passkeys) fingerprint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submitCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const problem = validate(e.currentTarget);
    if (problem) return setError(problem);
    const code = String(new FormData(e.currentTarget).get("code"));
    void run(() => api.reverifyCode(code));
  }

  return (
    <section className="card">
      <h1>Verificació addicional</h1>
      <p className="lead">Aquest contingut és delicat: confirma que ets tu.</p>
      {passkeys && (
        <button type="button" disabled={busy} onClick={fingerprint}>
          {mobile ? "Confirmar amb la petjada digital" : "Confirmar amb clau d'accés"}
        </button>
      )}
      <form className="stack" noValidate onSubmit={submitCode}>
        <label>
          Codi de l'autenticador
          <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required />
        </label>
        <button type="submit" className={passkeys ? "ghost" : ""} disabled={busy}>Confirmar amb el codi</button>
      </form>
      <ErrorMessage message={error} />
    </section>
  );
}
