import { Link, NavLink, Outlet } from "react-router";

const OPTIONS = [
  { to: "/gestio/hub", name: "Webs i agents" },
  { to: "/gestio/usuaris", name: "Usuaris" },
  { to: "/gestio/versos", name: "Versos" },
  { to: "/gestio/seguretat", name: "Seguretat" },
];

// El títol sempre és «Gestió»; l'opció triada s'obre a sota, amb les pestanyes per canviar-ne o tornar-hi.
export function GestioLayout() {
  return (
    <section>
      <h1><Link to="/gestio">Gestió</Link></h1>
      <nav className="tabs" aria-label="Opcions de gestió">
        {OPTIONS.map((o) => (
          <NavLink key={o.to} to={o.to} className="tab">{o.name}</NavLink>
        ))}
      </nav>
      <Outlet />
    </section>
  );
}
