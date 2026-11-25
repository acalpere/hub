// Copia la interfície del paquet poemes/ a frontend/public/apps/poemes i hi posa la configuració
// del hub (API sota /api/v1/poemes, sessió del hub). El resultat no es versiona (.gitignore).
// Si poemes/ es separa del repositori, indica on és amb POEMES_UI_DIR.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = process.env.POEMES_UI_DIR ?? resolve(root, "poemes/src/motfinal/adapters/web/ui");
const target = resolve(root, "frontend/public/apps/poemes");

if (!existsSync(source)) {
  console.warn(`sync-poemes-ui: no trobo ${source}; s'omet.`);
  process.exit(0);
}
// Es buida el contingut però no la carpeta: així el servidor de desenvolupament (Vite) no perd de vista els fitxers.
mkdirSync(target, { recursive: true });
for (const name of readdirSync(target)) rmSync(resolve(target, name), { recursive: true, force: true });
cpSync(source, target, { recursive: true });
// Icona del hub a la còpia incrustada (el paquet independent no en porta).
const page = resolve(target, "index.html");
// El script és inline (així mai no queda una còpia antiga a la memòria cau del navegador).
const THEME_JS = `(function () {
  function read() {
    try { var t = window.parent !== window && window.parent.document.documentElement.dataset.theme; if (t === "light" || t === "dark") return t; } catch (e) { /* altre origen */ }
    try { return localStorage.getItem("site-theme") === "light" ? "light" : "dark"; } catch (e) { return "dark"; }
  }
  function apply() { document.documentElement.dataset.theme = read(); }
  apply();
  window.addEventListener("storage", apply);
})();`;
// Mode fosc/clar del hub (localStorage «site-theme», mateix origen): theme.js posa data-theme i theme.css el pinta.
writeFileSync(
  page,
  readFileSync(page, "utf8").replace(
    "</head>",
    `  <link rel="icon" type="image/png" sizes="64x64" href="/favicon-64.png">\n    <script>${THEME_JS}</script>\n    <link rel="stylesheet" href="theme.css?v=${Date.now()}">\n  </head>`,
  ),
);
writeFileSync(
  resolve(target, "theme.css"),
  `/* Generat per scripts/sync-poemes-ui.mjs: no editar. */
:root[data-theme="dark"] {
  --ink: #f3e6d0; --muted: #a99a85; --paper: #120d09; --card: #1c140d; --accent: #e0aa60; --accent-soft: #2a1d10;
  --action: #c98f4e; --action-dark: #dca565; --line: #3a2a1b; --sage: #a99a85;
  color-scheme: dark;
}
:root[data-theme="dark"] button { color: #1a0f06; }
:root[data-theme="dark"] .synonyms-main, :root[data-theme="dark"] .secondary, :root[data-theme="dark"] .secondary-small,
:root[data-theme="dark"] .mode-toggle, :root[data-theme="dark"] .mic-button { color: #e0aa60; border-color: #5a4630; background: transparent; }
:root[data-theme="dark"] .synonyms-main:hover, :root[data-theme="dark"] .secondary-small:hover, :root[data-theme="dark"] .mode-toggle:hover,
:root[data-theme="dark"] .mic-button:hover { color: #1a0f06; background: #c98f4e; }
:root[data-theme="dark"] .view-mode, :root[data-theme="dark"] .segmented { background: #17100a; border-color: #3a2a1b; }
:root[data-theme="dark"] .view-mode input:checked + span, :root[data-theme="dark"] .segmented input:checked + span { background: #2a1d10; color: #f3e6d0; box-shadow: none; }
:root[data-theme="dark"] .badge, :root[data-theme="dark"] .synonym-list li, :root[data-theme="dark"] .word-dialog-content ul li { background: #2a1d10; color: #e0aa60; }
:root[data-theme="dark"] .badge.finished { background: #3a2a1b; color: #e8c99a; }
:root[data-theme="dark"] .badge.published { background: #c98f4e; color: #1a0f06; }
:root[data-theme="dark"] .poem-list button.poem-item:hover, :root[data-theme="dark"] .poem-list button.poem-item.current, :root[data-theme="dark"] .dialog-close:hover { background: #2a1d10; }
:root[data-theme="dark"] .synonym-list li:has(.synonym-link):hover, :root[data-theme="dark"] .word-dialog-content ul li:has(.synonym-link):hover { background: #3a2a1b; }
:root[data-theme="dark"] .notice.error { background: #2e1512; color: #f0a99f; }
:root[data-theme="dark"] .word-chip { border-color: #3a2a1b; }
:root[data-theme="dark"] .reference-field > span { color: #e0aa60; }
:root[data-theme="dark"] dialog::backdrop { background: rgba(0, 0, 0, .6); }
:root[data-theme="dark"] .hub-home { background: rgba(28, 20, 13, .92); }
.reference-field > span { font-size: 1rem; }
:root[data-theme="dark"] .poem-list button.poem-item { color: #f3e6d0; }
:root[data-theme="dark"] .dialog-close { color: #a99a85; }
:root[data-theme="dark"] .dialog-close:hover { color: #f3e6d0; }
:root[data-theme="dark"] .poem-body { background: transparent; }
:root[data-theme="dark"] .poem-marks i { background: rgba(255, 238, 0, .3); }
:root[data-theme="dark"] .poem-gutter li.marked { color: #1a1500; background: rgba(255, 238, 0, .7); }
:root[data-theme="dark"] .marking .poem-gutter li[data-verse]:hover { background: rgba(255, 238, 0, .22); color: #f3e6d0; }
:root[data-theme="dark"] .mark-toggle { color: #a99a85; background: transparent; }
:root[data-theme="dark"] .mark-toggle:hover { color: #f3e6d0; }
:root[data-theme="dark"] .mark-toggle[aria-pressed="true"] { color: #1a1500; background: #ffe94d; border-color: #ffe94d; }
:root[data-theme="dark"] .word-badge { color: #fff; border-color: #120d09; }
:root[data-theme="dark"] .poem-gutter { color: #8a7352; background: #17100a; border-right-color: #2e2216; }
:root[data-theme="dark"] .poem-title::placeholder, :root[data-theme="dark"] .poem-body::placeholder { color: #6b5a45; }
:root[data-theme="dark"] textarea, :root[data-theme="dark"] select, :root[data-theme="dark"] .segmented,
:root[data-theme="dark"] .definition-option .checkmark, :root[data-theme="dark"] .hub-home { background: #1c140d; color: var(--ink); }
:root[data-theme="dark"] .segmented input:checked + span { background: #2a1d10; color: #f3e6d0; border-color: #3a2a1b; }
:root[data-theme="dark"] input { border-bottom-color: #6b5a45; }
:root[data-theme="dark"] .poem-editor, :root[data-theme="dark"] .status-field select, :root[data-theme="dark"] .view-mode input:checked + span { background: #1c140d; color: #f3e6d0; }
:root[data-theme="dark"] .mode-toggle[aria-pressed="true"], :root[data-theme="dark"] .badge.published { color: #1a0f06; background: #c98f4e; border-color: #c98f4e; }
`,
);
writeFileSync(
  resolve(target, "config.js"),
  `// Generat per scripts/sync-poemes-ui.mjs: no editar.
window.MOTFINAL = {
  api: "/api/v1/poemes",
  csrf: "acalpere",
  auth: "host",
  loginUrl: "/login",
  homeUrl: "/",
};
`,
);
console.log(`sync-poemes-ui: ${target}`);
