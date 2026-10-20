import { Navigate, Outlet, Route, Routes, useLocation } from "react-router";
import { useAuth } from "./auth";
import { Layout } from "./Layout";
import { HomePage } from "./pages/HomePage";
import { HubPage } from "./pages/HubPage";
import { LoginPage } from "./pages/LoginPage";

function RequireAuth({ admin = false }: { admin?: boolean }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p className="status">Carregant…</p>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (admin && user.role !== "admin") return <Navigate to="/" replace />;
  return <Outlet />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Layout />}>
        <Route element={<RequireAuth />}>
          <Route index element={<HomePage />} />
        </Route>
        <Route element={<RequireAuth admin />}>
          <Route path="hub" element={<HubPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
