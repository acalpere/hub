// Copia la interfície del paquet poemes/ a frontend/public/apps/poemes i hi posa la configuració
// del hub (API sota /api/v1/poemes, sessió del hub). El resultat no es versiona (.gitignore).
// Si poemes/ es separa del repositori, indica on és amb POEMES_UI_DIR.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = process.env.POEMES_UI_DIR ?? resolve(root, "poemes/src/motfinal/adapters/web/ui");
const target = resolve(root, "frontend/public/apps/poemes");

if (!existsSync(source)) {
  console.warn(`sync-poemes-ui: no trobo ${source}; s'omet.`);
  process.exit(0);
}
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });
// Icona del hub a la còpia incrustada (el paquet independent no en porta).
const page = resolve(target, "index.html");
writeFileSync(
  page,
  readFileSync(page, "utf8").replace(
    "</head>",
    '  <link rel="icon" type="image/png" sizes="64x64" href="/favicon-64.png">\n  </head>',
  ),
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
