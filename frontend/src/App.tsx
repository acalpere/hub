import { Navigate, Outlet, Route, Routes, useLocation } from "react-router";
import { useAuth } from "./auth";
import { Layout } from "./Layout";
import { LoadingSpinner } from "./components/LoadingSpinner";
import { HomePage } from "./pages/HomePage";
import { AppFramePage } from "./pages/AppFramePage";
import { AwsLayout } from "./components/AwsAskBar";
import { AwsArchitecture, AwsArchitectures, AwsHome, AwsNeed, AwsNeeds, AwsService, AwsServices } from "./pages/AwsPage";
import { AwsDrawer } from "./pages/AwsDrawerPage";
import { AwsStudy } from "./pages/AwsStudyPage";
import { CyranoPage } from "./pages/CyranoPage";
import { GestioLayout } from "./pages/GestioPage";
import { GeneralPage } from "./pages/GeneralPage";
import { HubPage } from "./pages/HubPage";
import { LoginPage } from "./pages/LoginPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SecurityPage } from "./pages/SecurityPage";
import { UsersPage } from "./pages/UsersPage";
import { VersesPage } from "./pages/VersesPage";
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
          <Route path="aws" element={<AwsLayout />}>
            <Route index element={<AwsHome />} />
            <Route path="necessitats" element={<AwsNeeds />} />
            <Route path="necessitats/:slug" element={<AwsNeed />} />
            <Route path="quiz" element={<AwsStudy />} />
            <Route path="calaix" element={<AwsDrawer />} />
            <Route path="serveis" element={<AwsServices />} />
            <Route path="serveis/:slug" element={<AwsService />} />
            <Route path="arquitectures" element={<AwsArchitectures />} />
            <Route path="arquitectures/:slug" element={<AwsArchitecture />} />
          </Route>
          <Route path="seguretat" element={<Navigate to="/gestio/seguretat" replace />} />
          <Route path="gestio" element={<GestioLayout />}>
            <Route index element={<Navigate to="hub" replace />} />
            <Route path="hub" element={<HubPage />} />
            <Route path="usuaris" element={<UsersPage />} />
            <Route path="general" element={<GeneralPage />} />
            <Route path="versos" element={<VersesPage />} />
            <Route path="seguretat" element={<SecurityPage />} />
          </Route>
          <Route path="hub" element={<Navigate to="/gestio/hub" replace />} />
          <Route path="usuaris" element={<Navigate to="/gestio/usuaris" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
