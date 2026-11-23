import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** The API runs in `wrangler dev` on this port; the web dev server forwards /api to it, so both share one origin. */
const API_DEV_PORT = 8787;

export default defineConfig({
  root: "web",
  plugins: [react()],
  build: { outDir: "../dist", emptyOutDir: true },
  server: {
    port: 5190,
    proxy: { "/api": { target: `http://localhost:${API_DEV_PORT}`, changeOrigin: false } },
  },
});
