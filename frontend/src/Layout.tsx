import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { api } from "./api";
import { useAuth } from "./auth";

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [hasCyrano, setHasCyrano] = useState(false);
  useEffect(() => {
    if (!user) return setHasCyrano(false);
    api.menu().then((m) => setHasCyrano(m.some((i) => i.url === "/cyrano"))).catch(() => setHasCyrano(false));
  }, [user]);
  const framed = pathname.startsWith("/app/");
  const inGestio = ["/gestio", "/hub", "/usuaris"].some((p) => pathname.startsWith(p));
  return (
    <div className={`shell${framed ? " framed" : ""}`}>
      <header className="top">
        <Link to="/" className="brand">
          <img src="/logo.svg" alt="" width={40} height={40} />
          <span>acalpere<span className="tld">.cat</span></span>
        </Link>
        {user && (
          <nav>
            <NavLink to="/" end className="navlink">Hub</NavLink>
            {hasCyrano && <NavLink to="/cyrano" className="navlink">Cyrano</NavLink>}
            {user.role === "admin" && (
              <NavLink to="/gestio" className={`navlink gestio${inGestio ? " active" : ""}`}>Gestió</NavLink>
            )}
            <NavLink to="/perfil" className="who" title="El meu perfil">
              {[user.first_name, user.last_name].filter(Boolean).join(" ") || user.username}
            </NavLink>
            {user.role === "admin" && (
              <Link to="/seguretat" className="icon-btn" aria-label="Seguretat" title="Seguretat">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 3l7 3v5c0 4.500-3 8-7 10-4-2-7-5.500-7-10V6z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              </Link>
            )}
            <button
              className="icon-btn"
              aria-label="Sortir"
              title="Sortir"
              onClick={async () => {
                await logout();
                navigate("/login");
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" />
                <path d="M16 8l4 4-4 4M20 12H9" />
              </svg>
            </button>
          </nav>
        )}
      </header>
      <main className={framed ? "framed" : undefined}>
        <Outlet />
      </main>
      {!framed && (
        <footer className="foot">
          <div className="foot-in">
            <Link to="/" className="foot-brand">
              <img src="/logo.svg" alt="" width={32} height={32} />
              <span>acalpere<span className="tld">.cat</span></span>
            </Link>
            {user && (
              <nav className="foot-nav" aria-label="Peu">
                <Link to="/">Hub</Link>
                {hasCyrano && <Link to="/cyrano">Cyrano</Link>}
                <Link to="/perfil">El meu perfil</Link>
              </nav>
            )}
            <p>© {new Date().getFullYear()} acalpere.cat · Llibres, dades i família.</p>
          </div>
        </footer>
      )}
    </div>
  );
}
