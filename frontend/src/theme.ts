// Tema de la web (fosc o clar). Es tria a Gestió → General i es recorda en aquest dispositiu; per defecte, fosc.
export type Theme = "dark" | "light";
const KEY = "site-theme";

export function getTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function applyTheme(theme: Theme = getTheme()) {
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute("content", theme === "dark" ? "#120d09" : "#7a2e2e");
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* sense emmagatzematge: el canvi només val fins que es recarregui */
  }
  applyTheme(theme);
  window.dispatchEvent(new Event("site-theme"));
}
