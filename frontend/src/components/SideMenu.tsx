import { useEffect, useState } from "react";
import { NavLink } from "react-router";
import type { User } from "../api";

interface Props {
  user: User;
  hasCyrano: boolean;
  pathname: string;
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
}

const GESTIO = [
  { to: "/gestio/hub", name: "Webs i agents" },
  { to: "/gestio/usuaris", name: "Usuaris" },
  { to: "/gestio/seguretat", name: "Seguretat" },
];

// Menú lateral per a pantalles petites: surt per l'esquerra i Gestió és un acordió.
export function SideMenu({ user, hasCyrano, pathname, open, onClose, onLogout }: Props) {
  const inGestio = pathname.startsWith("/gestio");
  const [gestio, setGestio] = useState(inGestio);
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username;

  useEffect(() => {
    if (inGestio) setGestio(true);
  }, [inGestio]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // la pàgina de sota no es mou mentre el menú és obert
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = before;
    };
  }, [open, onClose]);

  return (
    <>
      <div className={`drawer-backdrop${open ? " open" : ""}`} onClick={onClose} aria-hidden="true" />
      <aside id="side-menu" className={`drawer${open ? " open" : ""}`} aria-label="Menú" aria-hidden={!open}>
        <div className="drawer-head">
          <span>Menú</span>
          <button type="button" className="icon-btn" aria-label="Tanca el menú" onClick={onClose}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <nav className="drawer-nav">
          <NavLink to="/" end className="drawer-link">Hub</NavLink>
          {hasCyrano && <NavLink to="/cyrano" className="drawer-link">Cyrano</NavLink>}

          {user.role === "admin" && (
            <div className={`acc${gestio ? " open" : ""}`}>
              <button type="button" className={`drawer-link acc-btn${inGestio ? " active" : ""}`} aria-expanded={gestio} aria-controls="acc-gestio" onClick={() => setGestio((g) => !g)}>
                Gestió
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5" /></svg>
              </button>
              <div id="acc-gestio" className="acc-panel">
                <div>
                  {GESTIO.map((o) => (
                    <NavLink key={o.to} to={o.to} className="drawer-sub">{o.name}</NavLink>
                  ))}
                </div>
              </div>
            </div>
          )}

          <NavLink to="/perfil" className="drawer-link">El meu perfil <small>{name}</small></NavLink>
          <button type="button" className="drawer-link drawer-exit" onClick={onLogout}>Sortir</button>
        </nav>
      </aside>
    </>
  );
}
