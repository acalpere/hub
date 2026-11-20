import { FadingVerse } from "./FadingVerse";
import { useEffect } from "react";
import { NavLink } from "react-router";
import type { User } from "../api";

interface Props {
  user: User;
  hasCyrano: boolean;
  verse: string | null;
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
}

// Menú lateral per a pantalles petites: surt per l'esquerra.
export function SideMenu({ user, hasCyrano, verse, open, onClose, onLogout }: Props) {
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username;

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
          {verse === null ? (
            <span className="drawer-brand">acalpere<span className="tld">.cat</span></span>
          ) : (
            <FadingVerse className="drawer-brand" text={verse || null} />
          )}
          <button type="button" className="icon-btn" aria-label="Tanca el menú" onClick={onClose}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <nav className="drawer-nav">
          <NavLink to="/" end className="drawer-link">Hub</NavLink>
          {hasCyrano && <NavLink to="/cyrano" className="drawer-link">Cyrano</NavLink>}

          {user.role === "admin" && <NavLink to="/aws" className="drawer-link">AWS</NavLink>}
          {user.role === "admin" && <NavLink to="/gestio" className="drawer-link">Gestió</NavLink>}
        </nav>
        <div className="drawer-foot">
          <img src="/logo.svg" alt="" width={96} height={96} />
        </div>
        <div className="drawer-user">
          <NavLink to="/perfil" className="drawer-me">
            {name}
          </NavLink>
          <button type="button" className="exit" onClick={onLogout}>Sortir</button>
        </div>
      </aside>
    </>
  );
}
