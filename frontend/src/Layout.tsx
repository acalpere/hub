import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { api } from "./api";
import { SideMenu } from "./components/SideMenu";
import { useAuth } from "./auth";

const VERSE_MINUTES = 10;

// Vers de la capçalera: un a l'atzar en obrir la sessió, i un de nou cada deu minuts (mai el mateix dos cops seguits).
function useVerse(active: boolean): string | null {
  // Mida de la lletra (de Gestió) com a variables CSS: una per a pantalles grans i una per a petites.
  useEffect(() => {
    if (!active) return;
    const apply = () =>
      api.verseSettings().then((s) => {
        document.documentElement.style.setProperty("--verse-lg", `${s.font_large}rem`);
        document.documentElement.style.setProperty("--verse-sm", `${s.font_small}rem`);
      }).catch(() => undefined);
    void apply();
    window.addEventListener("verse-settings", apply);
    return () => window.removeEventListener("verse-settings", apply);
  }, [active]);
  const [verse, setVerse] = useState<{ id: number; text: string } | null>(null);
  useEffect(() => {
    if (!active) return setVerse(null);
    let last: number | undefined;
    const next = () =>
      api.randomVerse(last).then((v) => { last = v?.id; setVerse(v); }).catch(() => undefined);
    void next();
    const timer = window.setInterval(next, VERSE_MINUTES * 60_000);
    return () => window.clearInterval(timer);
  }, [active]);
  return verse?.text ?? null;
}

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [hasCyrano, setHasCyrano] = useState(false);
  useEffect(() => {
    if (!user) return setHasCyrano(false);
    api.menu().then((m) => setHasCyrano(m.some((i) => i.url === "/cyrano"))).catch(() => setHasCyrano(false));
  }, [user]);
  const verse = useVerse(!!user);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMenuOpen(false), [pathname]); // en navegar, el menú es tanca
  const framed = pathname.startsWith("/app/");
  const inGestio = pathname.startsWith("/gestio");
  return (
    <div className={`shell${framed ? " framed" : ""}`}>
      <header className="top">
        {user && (
          <button type="button" className="icon-btn burger" aria-label="Obre el menú" aria-expanded={menuOpen} aria-controls="side-menu" onClick={() => setMenuOpen(true)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
        )}
        <Link to="/" className="brand">
          <img src="/logo.svg" alt="" width={40} height={40} />
          {user && verse ? <span className="brand-verse">{verse}</span> : <span>acalpere<span className="tld">.cat</span></span>}
        </Link>
        {user && (
          <nav>
            <NavLink to="/" end className="navlink">Hub</NavLink>
            {hasCyrano && <NavLink to="/cyrano" className="navlink">Cyrano</NavLink>}
            {user.role === "admin" && <NavLink to="/aws" className="navlink">AWS</NavLink>}
            {user.role === "admin" && (
              <NavLink to="/gestio" className={`navlink gestio${inGestio ? " active" : ""}`}>Gestió</NavLink>
            )}
            <div className="who-box">
              <NavLink to="/perfil" className="who" title="El meu perfil">
                {[user.first_name, user.last_name].filter(Boolean).join(" ") || user.username}
              </NavLink>
              <button
                type="button"
                className="link exit"
                onClick={async () => {
                  await logout();
                  navigate("/login");
                }}
              >
                Sortir
              </button>
            </div>
          </nav>
        )}
      </header>
      {user && (
        <SideMenu
          user={user}
          hasCyrano={hasCyrano}
          verse={verse}
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          onLogout={async () => {
            await logout();
            navigate("/login");
          }}
        />
      )}
      <main className={framed ? "framed" : undefined}>
        <Outlet />
      </main>
      {!framed && (
        <footer className="foot">
          <div className="foot-in">
            <Link to="/" className="foot-brand">
              <img src="/logo.svg" alt="" width={32} height={32} />
              {user && verse ? <span className="brand-verse">{verse}</span> : <span>acalpere<span className="tld">.cat</span></span>}
            </Link>
            {user && (
              <nav className="foot-nav" aria-label="Peu">
                <Link to="/">Hub</Link>
                {hasCyrano && <Link to="/cyrano">Cyrano</Link>}
                <Link to="/perfil">El meu perfil</Link>
              </nav>
            )}
            <p>© {new Date().getFullYear()} acalpere.cat</p>
          </div>
        </footer>
      )}
    </div>
  );
}
