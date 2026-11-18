import { Navigate, useParams } from "react-router";

// Una app antiga (pàgina estàtica) oberta sota el menú principal: el Hub sempre és a un clic.
export function AppFramePage() {
  const { slug = "" } = useParams();
  if (!/^[a-z0-9-]+$/.test(slug)) return <Navigate to="/" replace />;
  return <iframe className="app-frame" src={`/apps/${slug}/`} title="Aplicació" />;
}
