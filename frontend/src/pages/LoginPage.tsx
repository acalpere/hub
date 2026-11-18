import { useEffect, useState, type FormEvent } from "react";
import QRCode from "qrcode";
import { Navigate, useSearchParams } from "react-router";
import { api, type LoginStep } from "../api";
import { PasswordInput } from "../components/PasswordInput";
import { ErrorMessage } from "../components/ErrorMessage";
import { validate } from "../forms";
import { useAuth } from "../auth";
import { getPasskey, isTouchDevice, passkeysSupported, rememberPasskey } from "../passkeys";

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
  const [forgot, setForgot] = useState(false);
  const [manual, setManual] = useState(false);
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

  // Al mòbil es demana la petjada d'entrada, sense tocar res.
  useEffect(() => {
    if (!user && step === null && mobile && passkeys) passkeyLogin(true);
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

  // «auto»: es demana sol en entrar; si es cancel·la o falla, queda el formulari d'usuari i clau.
  function passkeyLogin(auto = false) {
    void run(async () => {
      try {
        completeLogin(await api.passkeyLogin(await getPasskey(await api.passkeyLoginOptions())));
        rememberPasskey();
      } catch (err) {
        if (auto) {
          setManual(true);
          if (err instanceof DOMException && err.name === "NotAllowedError") return;
        }
        if (err instanceof DOMException) {
          throw new Error(
            err.name === "NotAllowedError"
              ? "Cancel·lat, o aquest dispositiu encara no té cap clau d'accés registrada. " +
                "Entra amb usuari, clau i codi, i registra-la a Seguretat."
              : `No s'ha pogut usar la clau d'accés (${err.name}: ${err.message})`,
          );
        }
        throw err;
      }
    });
  }

  const passkeyButton = (
    <button type="button" className="touch" disabled={busy} onClick={() => passkeyLogin()}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 11v3a6 6 0 0 1-1 3.300M8.500 14.500c0-2 .5-3.500 1.500-5M5.500 16c-.7-1.500-1-3-1-4.500a7.500 7.500 0 0 1 15 0c0 1-.1 2-.3 3M16 15c0 2-.5 3.500-1.300 5" />
        <path d="M12 7a4.500 4.500 0 0 0-4.500 4.500c0 .8-.1 1.500-.3 2.200M12 11v.01" />
      </svg>
      Entrar amb la petjada
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
        <PasswordInput name="clau" autoComplete="current-password" required />
      </label>
      <button type="submit" disabled={busy}>Entrar</button>
      <button type="button" className="link forgot" aria-expanded={forgot} onClick={() => setForgot((f) => !f)}>
        Has oblidat la clau?
      </button>
      {forgot && (
        <p className="muted small hint" role="note">
          Per seguretat la clau no es pot recuperar des d'aquí. Demana a l'administrador que te la restableixi
          i, un cop dins, canvia-la a <strong>El meu perfil</strong>.
        </p>
      )}
    </form>
  );

  return (
    <div className="login">
      <div className={`card${step === "mfa_required" || step === "mfa_setup" ? " mfa" : ""}`}>
        <img src="/logo.svg" alt="acalpere" width={56} height={56} />
        <h1>Som-hi</h1>

        {step === null && (
          mobile && passkeys && !manual ? (
            <>
              {passkeyButton}
              <button type="button" className="alt" onClick={() => setManual(true)}>Usar usuari i clau</button>
            </>
          ) : (
            <>
              {passwordForm}
              {mobile && passkeys && passkeyButton}
            </>
          )
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
            <CodeField />
            <button type="submit" disabled={busy}>Entrar</button>
          </form>
        )}

        <div className="err-slot">
          <ErrorMessage message={error} />
        </div>
      </div>
    </div>
  );
}

// Sis xifres, amb un espai al mig (123 456): el camp és només tan ample com cal.
function CodeField() {
  const [code, setCode] = useState("");
  return (
    <label className="code-field">
      MFA
      <input
        name="code"
        value={code}
        onChange={(e) => {
          const d = e.target.value.replace(/\D/g, "").slice(0, 6);
          setCode(d.length > 3 ? `${d.slice(0, 3)} ${d.slice(3)}` : d);
        }}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{3} ?[0-9]{3}"
        maxLength={7}
        placeholder="000 000"
        required
        autoFocus
      />
    </label>
  );
}
