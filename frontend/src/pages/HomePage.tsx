import { useEffect, useState } from "react";
import { Link } from "react-router";
import { api, type MenuItem } from "../api";
import { useAuth } from "../auth";

export function HomePage() {
  const { user } = useAuth();
  const [items, setItems] = useState<MenuItem[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.menu().then(setItems).catch((e) => setError(e.message));
  }, []);

  return (
    <section>
      <h1>Hola, {user?.username}</h1>
      {error && <p role="alert" className="error">{error}</p>}
      {items === null && !error && <p className="status">Carregant…</p>}
      <ul className="grid">
        {items?.map((item) => (
          <li key={item.id}>
            {/* Les apps antigues són pàgines estàtiques: enllaç normal; la resta, ruta de l'SPA */}
            {item.url.startsWith("/apps/") ? <a href={item.url}>{item.name}</a> : <Link to={item.url}>{item.name}</Link>}
          </li>
        ))}
      </ul>
    </section>
  );
}
