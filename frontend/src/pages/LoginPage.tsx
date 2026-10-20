import { useState, type FormEvent } from "react";
import { Navigate, useSearchParams } from "react-router";
import { ApiError } from "../api";
import { useAuth } from "../auth";

// Només es redirigeix a camins interns (evita redireccions obertes a altres webs).
export function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export function LoginPage() {
  const { user, login } = useAuth();
  const [params] = useSearchParams();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const next = safeNext(params.get("next"));

  if (user) return <Navigate to={next} replace />;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await login(String(form.get("usuari")), String(form.get("clau")));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No s'ha pogut connectar amb el servidor.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <form className="card" onSubmit={submit}>
        <img src="/logo.png" alt="acalpere" width={88} height={88} />
        <h1>Accés usuaris</h1>
        <label>
          Usuari
          <input name="usuari" autoComplete="username" required autoFocus />
        </label>
        <label>
          Clau
          <input name="clau" type="password" autoComplete="current-password" required />
        </label>
        <button type="submit" disabled={busy}>
          Entrar
        </button>
        {error && <p role="alert" className="error">{error}</p>}
      </form>
    </div>
  );
}
