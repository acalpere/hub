import { useEffect, useState, type MouseEvent } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import { api } from "./api";
import { QuickMenu } from "./components/QuickMenu";
import { useAuth } from "./auth";
import { FadingVerse } from "./components/FadingVerse";

// Cada lloc on surt un vers (capçalera i peu) en tria un a l'atzar pel seu compte i el canvia al seu ritme: poden coincidir o no.
const SLOTS = {
  head: { cache: "verse-last", minutes: 10 },
  foot: { cache: "verse-last-foot", minutes: 13 },
} as const;
type Slot = keyof typeof SLOTS;

function cachedVerse(slot: Slot = "head"): string | null {
  try {
    return localStorage.getItem(SLOTS[slot].cache);
  } catch {
    return null;
  }
}

// Mida de la lletra (de Gestió) com a variables CSS: una per a pantalles grans i una per a petites.
function useVerseSettings(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const apply = () =>
      api.verseSettings().then((s) => {
        document.documentElement.style.setProperty("--verse-lg", `${s.font_large}rem`);
        document.documentElement.style.setProperty("--verse-sm", `${s.font_small}rem`);
      }).catch(() => undefined);
    void apply();
    window.addEventListener("verse-settings", apply);
    return () => window.removeEventListener("verse-settings", apply);
  }, [active]);
}

// Vers d'un lloc: un a l'atzar en obrir la sessió i un de nou cada cert temps (mai el mateix dos cops seguits).
function useVerse(active: boolean, slot: Slot): string | null {
  const [verse, setVerse] = useState<{ id: number; text: string } | null>(null);
  useEffect(() => {
    if (!verse) return;
    try {
      localStorage.setItem(SLOTS[slot].cache, verse.text);
    } catch {
      /* sense emmagatzematge: simplement no es recorda el vers */
    }
  }, [verse, slot]);
  useEffect(() => {
    if (!active) return setVerse(null);
    let last: number | undefined;
    const next = () =>
      api.randomVerse(last).then((v) => { last = v?.id; setVerse(v); }).catch(() => undefined);
    void next();
    const timer = window.setInterval(next, SLOTS[slot].minutes * 60_000);
    return () => window.clearInterval(timer);
  }, [active, slot]);
  return verse?.text ?? (active ? cachedVerse(slot) : null);
}

export function Layout() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [hasCyrano, setHasCyrano] = useState(false);
  useEffect(() => {
    if (!user) return setHasCyrano(false);
    api.menu().then((m) => setHasCyrano(m.some((i) => i.url === "/cyrano"))).catch(() => setHasCyrano(false));
  }, [user]);
  useVerseSettings(!!user);
  const headVerse = useVerse(!!user, "head");
  const footVerse = useVerse(!!user, "foot");
  // Un cop dins, mai es veu el nom del lloc: o el vers, o res fins que arriba. Només es mostra el nom a qui no ha entrat.
  const showVerse = !!user || (loading && !!cachedVerse());
  const cached = showVerse ? (headVerse ?? cachedVerse("head")) : null;
  const footCached = showVerse ? (footVerse ?? cachedVerse("foot")) : null;
  // Al mòbil, obrir el lloc directament dins de Gestió (adreça escrita, marcador, autocompletat del navegador) porta a la
  // pàgina principal: s'entra pel Hub. Recarregar o tirar enrere dins de Gestió no es toca.
  useEffect(() => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const small = window.matchMedia("(max-width: 48rem)").matches;
    if (small && nav?.type === "navigate" && window.location.pathname.startsWith("/gestio")) navigate("/", { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // El logo (de la capçalera i del peu) obre el menú de la lluna en lloc de portar a l'inici; Hub hi és com una opció més.
  const openMenu = (e: MouseEvent) => {
    if (!user) return;
    e.preventDefault();
    window.dispatchEvent(new Event("quick-menu-toggle"));
  };
  const framed = pathname.startsWith("/app/");
  return (
    <div className={`shell${framed ? " framed" : ""}`}>
      <header className="top">
        <Link to="/" className="brand">
          <img src="/logo.svg" alt="" width={40} height={40} onClick={openMenu} />
          {showVerse ? <FadingVerse className="brand-verse" text={cached} /> : <span>acalpere<span className="tld">.cat</span></span>}
        </Link>
      </header>
      {user && (
        <QuickMenu
          user={user}
          hasCyrano={hasCyrano}
          verse={showVerse ? cached : null}
          onLogout={async () => {
            await logout();
            navigate("/login");
          }}
        />
      )}
      <main className={framed ? "framed" : undefined}>
        <Outlet />
      </main>
      {!framed && (
        <footer className="foot">
          <div className="foot-in">
            <Link to="/" className="foot-brand">
              <img src="/logo.svg" alt="" width={32} height={32} onClick={openMenu} />
              {showVerse ? <FadingVerse className="brand-verse" text={footCached} /> : <span>acalpere<span className="tld">.cat</span></span>}
            </Link>
          </div>
        </footer>
      )}
    </div>
  );
}
