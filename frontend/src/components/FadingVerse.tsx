import { useEffect, useState } from "react";

const FADE_MS = 650;

// El vers de la capçalera: quan canvia, el vell s'esvaeix suaument i el nou apareix amb un petit lliscament cap amunt.
// Sense text (encara no ha arribat) no es mostra res: així no es veu mai el nom del lloc abans del vers.
export function FadingVerse({ text, className }: { text: string | null; className?: string }) {
  const [shown, setShown] = useState(text ?? "");
  const [phase, setPhase] = useState<"in" | "out">("in");

  useEffect(() => {
    if (text === null || text === shown) return;
    if (!shown) {
      setShown(text);
      return;
    }
    setPhase("out");
    const t = window.setTimeout(() => {
      setShown(text);
      setPhase("in");
    }, FADE_MS);
    return () => window.clearTimeout(t);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <span className={`${className ?? ""} verse-fade ${phase}`} aria-live="off">
      {shown}
    </span>
  );
}
