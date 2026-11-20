import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router";
import type { User } from "../api";

interface Props {
  user: User;
  hasCyrano: boolean;
  verse?: string | null;
  onLogout: () => void;
}

const ICONS = {
  hub: "M4 11l8-7 8 7v9H4z",
  cyrano: "M4 5h6a3 3 0 013 3v12a2 2 0 00-2-2H4zM20 5h-6a3 3 0 00-3 3",
  aws: "M12 3l9 5-9 5-9-5zM3 12.5l9 5 9-5M3 17l9 5 9-5",
  gestio: "M12 9a3 3 0 100 6 3 3 0 000-6zM12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1",
};

// Menú del mòbil: es desplega cap amunt des del botó del logo (a baix a l'esquerra, només a la pàgina d'inici) o cap avall
// des del logo de dalt a l'esquerra de la capçalera (a totes les pàgines). Sempre és fosc, sigui quin sigui el tema de la web.
// Es plega tocant el logo, el fons, la × o triant una opció.
export function QuickMenu({ user, hasCyrano, verse, onLogout }: Props) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState<"top" | "bottom">("bottom"); // des d'on s'ha obert: el logo de dalt o el de baix
  const { pathname } = useLocation();
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username;
  // El logo de baix només és a la pantalla d'entrada: en triar qualsevol opció, o en navegar, desapareix i queda el de dalt.
  const [entered, setEntered] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    setOpen(false);
    if (first.current) first.current = false;
    else setEntered(true);
  }, [pathname]);
  const showFab = pathname === "/" && !entered;
  // El logo de dalt a la dreta (capçalera, al mòbil) també obre i tanca el menú.
  useEffect(() => {
    const toggle = () => {
      setFrom("top");
      setOpen((o) => !o);
    };
    window.addEventListener("quick-menu-toggle", toggle);
    return () => window.removeEventListener("quick-menu-toggle", toggle);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const items: { to: string; label: string; icon: keyof typeof ICONS; end?: boolean }[] = [
    { to: "/", label: "Hub", icon: "hub", end: true },
    ...(hasCyrano ? [{ to: "/cyrano", label: "Cyrano", icon: "cyrano" as const }] : []),
    ...(user.role === "admin"
      ? [
          { to: "/aws", label: "AWS", icon: "aws" as const },
          { to: "/gestio", label: "Gestió", icon: "gestio" as const },
        ]
      : []),
  ];

  return (
    <div className={`quick${open ? " open" : ""}${showFab ? " home" : ""} from-${from}`}>
      <div className="quick-veil" onClick={() => setOpen(false)} aria-hidden="true">
        <span className="q-stars" />
        <svg className="q-moon" viewBox="0 0 120 120" aria-hidden="true">
          <defs>
            <linearGradient id="qm-wood" x1="0.1" y1="0" x2="0.9" y2="1">
              <stop offset="0" stopColor="#f0cf94" />
              <stop offset="0.55" stopColor="#c98f4e" />
              <stop offset="1" stopColor="#7d4f27" />
            </linearGradient>
            <mask id="qm-mask">
              <rect width="120" height="120" fill="#000" />
              <g transform="rotate(-8 60 60)">
                <circle cx="60" cy="60" r="52" fill="#fff" />
                <circle cx="80" cy="50" r="50" fill="#000" />
              </g>
            </mask>
            <pattern id="qm-planks" width="120" height="9" patternUnits="userSpaceOnUse">
              <rect width="120" height="9" fill="none" />
              <rect y="0" width="120" height="1.1" fill="#3a2008" opacity="0.5" />
              <rect y="1.1" width="120" height="0.8" fill="#fff3d6" opacity="0.18" />
            </pattern>
          </defs>
          <g mask="url(#qm-mask)">
            <rect width="120" height="120" fill="url(#qm-wood)" />
            <rect width="120" height="120" fill="url(#qm-planks)" />
          </g>
        </svg>
        <button type="button" className="q-close" aria-label="Tanca el menú" tabIndex={open ? 0 : -1} onClick={() => setOpen(false)}>×</button>
        {verse && <span className="q-verse">{verse}</span>}
      </div>
      <nav className="quick-stack" aria-label="Menú" aria-hidden={!open}>
        {[...items].reverse().map((it, i) => (
          <NavLink key={it.to} to={it.to} end={it.end} tabIndex={open ? 0 : -1} className={`quick-item q${items.length - 1 - i}`} onClick={() => setEntered(true)} style={{ ["--i" as string]: items.length - 1 - i }}>
            <span className="quick-ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONS[it.icon]} /></svg></span>
            {it.label}
          </NavLink>
        ))}
      </nav>
      <div className="quick-user" style={{ ["--i" as string]: items.length }}>
        <NavLink to="/perfil" tabIndex={open ? 0 : -1}>{name}</NavLink>
        <button type="button" tabIndex={open ? 0 : -1} onClick={onLogout} className="quick-exit">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 4.2A8 8 0 1019.8 15 6.5 6.5 0 0115.5 4.2z" /></svg>
          <span>Sortir</span>
        </button>
      </div>
      <button type="button" className="quick-fab" aria-label={open ? "Tanca el menú" : "Obre el menú"} aria-expanded={open} onClick={() => {
          setFrom("bottom");
          setOpen(!open);
        }}>
        <img src="/logo.svg" alt="" />
      </button>
    </div>
  );
}
