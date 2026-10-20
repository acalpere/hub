import { useEffect, useState, type FormEvent } from "react";
import QRCode from "qrcode";
import { Navigate, useSearchParams } from "react-router";
import { api, type LoginStep } from "../api";
import { ErrorMessage } from "../components/ErrorMessage";
import { validate } from "../forms";
import { useAuth } from "../auth";
import { getPasskey, hasRememberedPasskey, isTouchDevice, passkeysSupported, rememberPasskey } from "../passkeys";

// Només es redirigeix a camins interns (evita redireccions obertes a altres webs).
export function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : "Error inesperat.";
}

export function LoginPage() {
  const { user, login, completeLogin } = useAuth();
  const [params] = useSearchParams();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<LoginStep | null>(null);
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const next = safeNext(params.get("next"));
  const passkeys = passkeysSupported();
  const mobile = isTouchDevice();

  useEffect(() => {
    if (step !== "mfa_setup") return;
    api.mfaSetup()
      .then(async (s) => setSetup({ secret: s.secret, qr: await QRCode.toDataURL(s.uri, { margin: 1, width: 192 }) }))
      .catch((e) => setError(message(e)));
  }, [step]);

  // Al mòbil on ja hi ha una clau d'accés, es demana la petjada d'entrada, sense tocar res.
  useEffect(() => {
    if (!user && step === null && mobile && passkeys && hasRememberedPasskey()) passkeyLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (user) return <Navigate to={next} replace />;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  function submitPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const problem = validate(e.currentTarget);
    if (problem) return setError(problem);
    const form = new FormData(e.currentTarget);
    void run(async () => setStep(await login(String(form.get("usuari")), String(form.get("clau")))));
  }

  function submitCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const problem = validate(e.currentTarget);
    if (problem) return setError(problem);
    const code = String(new FormData(e.currentTarget).get("code"));
    void run(async () => completeLogin(await (step === "mfa_setup" ? api.mfaEnable(code) : api.mfa(code))));
  }

  function passkeyLogin() {
    void run(async () => {
      try {
        completeLogin(await api.passkeyLogin(await getPasskey(await api.passkeyLoginOptions())));
        rememberPasskey();
      } catch (err) {
        if (err instanceof DOMException) throw new Error("Operació cancel·lada");
        throw err;
      }
    });
  }

  const passkeyButton = passkeys && (
    <button type="button" className={mobile ? "" : "ghost"} disabled={busy} onClick={passkeyLogin}>
      {mobile ? "Entrar amb la petjada digital" : "Entrar amb clau d'accés"}
    </button>
  );

  const passwordForm = (
    <form className="stack" noValidate onSubmit={submitPassword}>
      <label>
        Usuari
        <input name="usuari" autoComplete="username webauthn" required />
      </label>
      <label>
        Clau
        <input name="clau" type="password" autoComplete="current-password" required />
      </label>
      <button type="submit" disabled={busy}>Continuar</button>
    </form>
  );

  return (
    <div className="login">
      <div className="card">
        <img src="/logo.svg" alt="acalpere" width={72} height={72} />
        <h1>Accés usuaris</h1>

        {step === null && (
          <>
            {passkeyButton}
            {mobile && passkeys ? (
              <details>
                <summary>Entrar amb usuari, clau i codi</summary>
                {passwordForm}
              </details>
            ) : (
              passwordForm
            )}
          </>
        )}

        {step === "mfa_setup" && (
          <form className="stack" noValidate onSubmit={submitCode}>
            <p className="muted">
              Cal un segon factor. Escaneja el QR amb una aplicació d'autenticació (Google Authenticator, Aegis, 2FAS…)
              i escriu el codi de 6 xifres.
            </p>
            {setup && (
              <>
                <img className="qr" src={setup.qr} alt="Codi QR del segon factor" width={192} height={192} />
                <p className="muted small">O introdueix aquesta clau: <code>{setup.secret}</code></p>
              </>
            )}
            <CodeField />
            <button type="submit" disabled={busy || !setup}>Activar i entrar</button>
          </form>
        )}

        {step === "mfa_required" && (
          <form className="stack" noValidate onSubmit={submitCode}>
            <p className="muted">Escriu el codi de l'aplicació d'autenticació.</p>
            <CodeField />
            <button type="submit" disabled={busy}>Entrar</button>
          </form>
        )}

        <ErrorMessage message={error} />
      </div>
    </div>
  );
}

function CodeField() {
  return (
    <label>
      Codi
      <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required autoFocus />
    </label>
  );
}
