import { Link } from "react-router";

const OPTIONS = [
  { to: "/hub", name: "Hub", text: "Afegeix, edita i treu les webs i els agents." },
  { to: "/usuaris", name: "Usuaris", text: "Dades dels usuaris i què pot veure cadascun." },
];

export function GestioPage() {
  return (
    <section>
      <h1>Gestió</h1>
      <p className="lead">Opcions d'administració.</p>
      <ul className="projects">
        {OPTIONS.map((o) => (
          <li key={o.to} className="project">
            <h3>{o.name}</h3>
            <p>{o.text}</p>
            <div className="actions">
              <Link className="btn" to={o.to}>Obrir</Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
