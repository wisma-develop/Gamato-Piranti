import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Header keamanan (termasuk Permissions-Policy untuk kamera/mikrofon/lokasi/dll.) dibaca dari vercel.json
// sehingga dev server & `vite preview` berperilaku sama persis dengan produksi — izin diuji dengan kebijakan yang sama.
function securityHeaders(): Record<string, string> {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.resolve(__dirname, "vercel.json"), "utf8"));
    const out: Record<string, string> = {};
    for (const rule of cfg.headers ?? []) for (const h of rule.headers ?? []) out[h.key] = h.value;
    delete out["Strict-Transport-Security"]; // HSTS hanya bermakna di HTTPS produksi
    return out;
  } catch {
    return {};
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: { headers: securityHeaders() },
  preview: { headers: securityHeaders() },
  build: {
    chunkSizeWarningLimit: 1600,
  },
});
