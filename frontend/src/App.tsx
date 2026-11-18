import { Navigate, Outlet, Route, Routes, useLocation } from "react-router";
import { useAuth } from "./auth";
import { Layout } from "./Layout";
import { LoadingSpinner } from "./components/LoadingSpinner";
import { HomePage } from "./pages/HomePage";
import { AppFramePage } from "./pages/AppFramePage";
import { CyranoPage } from "./pages/CyranoPage";
import { GestioPage } from "./pages/GestioPage";
import { HubPage } from "./pages/HubPage";
import { LoginPage } from "./pages/LoginPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SecurityPage } from "./pages/SecurityPage";
import { UsersPage } from "./pages/UsersPage";
import { VerifyPage } from "./pages/VerifyPage";

function RequireAuth({ admin = false }: { admin?: boolean }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingSpinner />;
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
          <Route path="perfil" element={<ProfilePage />} />
          <Route path="verificar" element={<VerifyPage />} />
          <Route path="cyrano" element={<CyranoPage />} />
          <Route path="app/:slug" element={<AppFramePage />} />
        </Route>
        <Route element={<RequireAuth admin />}>
          <Route path="seguretat" element={<SecurityPage />} />
          <Route path="gestio" element={<GestioPage />} />
          <Route path="hub" element={<HubPage />} />
          <Route path="usuaris" element={<UsersPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
