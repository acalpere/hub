import { useState } from "react";
import { getTheme, setTheme, type Theme } from "../theme";

const THEMES: { value: Theme; name: string; text: string }[] = [
  { value: "dark", name: "Fosc", text: "Negre càlid amb crema i ambre, com el menú de la lluna de fusta." },
  { value: "light", name: "Clar", text: "El fons de paper de sempre." },
];

// Ajustos generals: el tema de tota la web. Es recorda en aquest dispositiu.
export function GeneralPage() {
  const [theme, setCurrent] = useState<Theme>(getTheme);
  const pick = (t: Theme) => {
    setCurrent(t);
    setTheme(t);
  };
  return (
    <section>
      <h2>General</h2>
      <p className="lead">Tema de la web. Es recorda en aquest dispositiu; per defecte és el fosc.</p>
      <div className="theme-cards" role="radiogroup" aria-label="Tema">
        {THEMES.map((t) => (
          <button key={t.value} type="button" role="radio" aria-checked={theme === t.value} className={`theme-card ${t.value}${theme === t.value ? " on" : ""}`} onClick={() => pick(t.value)}>
            <span className="theme-swatch" aria-hidden="true"><i /><i /><i /></span>
            <strong>{t.name}</strong>
            <span>{t.text}</span>
          </button>
        ))}
      </div>
      <p className="muted small">Les aplicacions incrustades (calendari, herència, poemes…) conserven el seu aspecte clar.</p>
    </section>
  );
}
