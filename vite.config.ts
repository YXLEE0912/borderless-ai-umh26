import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  server: {
    port: 5173,

    // ── Proxy: forwards all backend routes → FastAPI on :8000 ─────────────
    // Eliminates CORS issues during local development.
    proxy: {
      "/sessions":       { target: "http://localhost:8000", changeOrigin: true },
      "/chat":           { target: "http://localhost:8000", changeOrigin: true },
      "/entity":         { target: "http://localhost:8000", changeOrigin: true },
      "/consignee":      { target: "http://localhost:8000", changeOrigin: true },
      "/classification": { target: "http://localhost:8000", changeOrigin: true },
      "/permits":        { target: "http://localhost:8000", changeOrigin: true },
      "/digital-access": { target: "http://localhost:8000", changeOrigin: true },
      "/valuation":      { target: "http://localhost:8000", changeOrigin: true },
      "/logistics":      { target: "http://localhost:8000", changeOrigin: true },
      "/trade-docs":     { target: "http://localhost:8000", changeOrigin: true },
      "/customs":        { target: "http://localhost:8000", changeOrigin: true },
      "/checklist":      { target: "http://localhost:8000", changeOrigin: true },
      "/documents":      { target: "http://localhost:8000", changeOrigin: true },
      "/landed-cost":    { target: "http://localhost:8000", changeOrigin: true },
      "/health":         { target: "http://localhost:8000", changeOrigin: true },
      "/debug":          { target: "http://localhost:8000", changeOrigin: true },
      "/hs":             { target: "http://localhost:8000", changeOrigin: true }, // HS code search
    },
  },
});