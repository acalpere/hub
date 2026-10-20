import { Link, Outlet, useNavigate } from "react-router";
import { useAuth } from "./auth";

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <>
      <header className="top">
        <Link to="/" className="brand">
          <img src="/logo.png" alt="" width={36} height={36} />
          <span>acalpere</span>
        </Link>
        {user && (
          <nav>
            <span className="who">{user.username}</span>
            <button
              className="link"
              onClick={async () => {
                await logout();
                navigate("/login");
              }}
            >
              Sortir
            </button>
          </nav>
        )}
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}
