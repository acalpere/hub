import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { api, type Profile } from "../api";
import { useAuth } from "../auth";
import { ErrorMessage } from "../components/ErrorMessage";
import { validate } from "../forms";

interface PasswordForm {
  current: string;
  next: string;
  repeat: string;
}

const EMPTY_PASSWORD: PasswordForm = { current: "", next: "", repeat: "" };

export function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState<Profile>({
    first_name: user?.first_name ?? "",
    last_name: user?.last_name ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
  });
  const [password, setPassword] = useState(EMPTY_PASSWORD);
  const [profileError, setProfileError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [profileState, setProfileState] = useState("");
  const [passwordState, setPasswordState] = useState("");

  const updateField = (key: keyof Profile, value: string) =>
    setProfile((current) => ({ ...current, [key]: value }));

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = validate(event.currentTarget);
    if (problem) return setProfileError(problem);
    setProfileError("");
    setProfileState("Desant…");
    try {
      await api.updateProfile(profile);
      await refreshUser();
      setProfileState("Dades desades.");
    } catch (error) {
      setProfileState("");
      setProfileError((error as Error).message);
    }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = validate(event.currentTarget);
    if (problem) return setPasswordError(problem);
    if (password.next !== password.repeat) {
      return setPasswordError("Les dues claus noves no coincideixen.");
    }
    setPasswordError("");
    setPasswordState("Canviant…");
    try {
      await api.changePassword(password.current, password.next);
      setPassword(EMPTY_PASSWORD);
      setPasswordState("Contrasenya canviada.");
    } catch (error) {
      setPasswordState("");
      setPasswordError((error as Error).message);
    }
  }

  return (
    <section>
      <h1>El meu perfil</h1>
      <p className="lead">Actualitza les teves dades personals i la contrasenya d'accés.</p>
      <div className="profile-grid">
        <form className="card profile-card" noValidate onSubmit={saveProfile}>
          <h2>Dades personals</h2>
          <p className="muted hint">Usuari per entrar: <strong>{user?.username}</strong></p>
          <label>
            Nom
            <input value={profile.first_name} onChange={(e) => updateField("first_name", e.target.value)} autoComplete="given-name" />
          </label>
          <label>
            Cognoms
            <input value={profile.last_name} onChange={(e) => updateField("last_name", e.target.value)} autoComplete="family-name" />
          </label>
          <label>
            Correu electrònic
            <input type="email" value={profile.email} onChange={(e) => updateField("email", e.target.value)} autoComplete="email" />
          </label>
          <label>
            Telèfon
            <input type="tel" value={profile.phone} onChange={(e) => updateField("phone", e.target.value)} autoComplete="tel" />
          </label>
          <ErrorMessage message={profileError} />
          {profileState && <p className={profileState === "Dades desades." ? "success" : "muted"}>{profileState}</p>}
          <button type="submit">Desar les dades</button>
        </form>

        <form className="card profile-card" noValidate onSubmit={savePassword}>
          <h2>Canviar la contrasenya</h2>
          <label>
            Contrasenya actual
            <input type="password" required value={password.current} onChange={(e) => setPassword({ ...password, current: e.target.value })} autoComplete="current-password" />
          </label>
          <label>
            Contrasenya nova
            <input type="password" required minLength={8} value={password.next} onChange={(e) => setPassword({ ...password, next: e.target.value })} autoComplete="new-password" />
          </label>
          <label>
            Repeteix la contrasenya nova
            <input type="password" required minLength={8} value={password.repeat} onChange={(e) => setPassword({ ...password, repeat: e.target.value })} autoComplete="new-password" />
          </label>
          <ErrorMessage message={passwordError} />
          {passwordState && <p className={passwordState === "Contrasenya canviada." ? "success" : "muted"}>{passwordState}</p>}
          <button type="submit">Canviar la contrasenya</button>
          {user?.role === "admin" && <Link to="/seguretat">Gestionar les claus d'accés i la seguretat</Link>}
        </form>
      </div>
    </section>
  );
}
