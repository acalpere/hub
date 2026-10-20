import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { useAuth } from "./auth";

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const inGestio = ["/gestio", "/hub", "/usuaris"].some((p) => pathname.startsWith(p));
  return (
    <div className="shell">
      <header className="top">
        <Link to="/" className="brand">
          <img src="/logo.svg" alt="" width={40} height={40} />
          <span>acalpere<span className="tld">.cat</span></span>
        </Link>
        {user && (
          <nav>
            <NavLink to="/" end className="navlink">Inici</NavLink>
            {user.role === "admin" && (
              <NavLink to="/gestio" className={`navlink gestio${inGestio ? " active" : ""}`}>Gestió</NavLink>
            )}
            <span className="who">{user.username}</span>
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
      <main>
        <Outlet />
      </main>
      <footer className="foot">
        <img src="/logo.svg" alt="" width={28} height={28} />
        <p>© {new Date().getFullYear()} acalpere.cat · Llibres, dades i família.</p>
      </footer>
    </div>
  );
}
