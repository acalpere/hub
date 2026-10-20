import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

// En producció, CloudFront reescriu /apps/x/ a /apps/x/index.html; en local ho fem aquí.
function appDirectoryIndex(): Plugin {
  return {
    name: "app-directory-index",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? "").split("?")[0] ?? "";
        if (path.startsWith("/apps/") && path.endsWith("/")) {
          const file = resolve(server.config.publicDir, "." + path, "index.html");
          if (existsSync(file)) {
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.end(readFileSync(file));
            return;
          }
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), appDirectoryIndex()],
  // Si un servidor antic ja ocupa el 5173, que falli en lloc de saltar al 5174.
  server: {
    port: 5173,
    strictPort: true,
    proxy: { "/api": { target: process.env.API_URL ?? "http://localhost:8000", changeOrigin: false } },
  },
});
