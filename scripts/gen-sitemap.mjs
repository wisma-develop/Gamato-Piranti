// Membuat public/sitemap.xml dari daftar <Route> di src/App.tsx (hanya halaman sungguhan, bukan redirect).
// Tidak pernah menggagalkan build: bila ada masalah, sitemap lama dipertahankan.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://gamatopiranti.zone.id";
try {
  const app = readFileSync(resolve(root, "src/App.tsx"), "utf8");
  const blocks = app.match(/<Route\b[\s\S]*?\/?>/g) ?? [];
  const paths = new Set(["/"]);
  for (const b of blocks) {
    const m = /\bpath="([^"]+)"/.exec(b);
    if (!m || /Navigate/.test(b) || m[1] === "*" || m[1] === "/") continue;
    paths.add("/" + m[1].replace(/^\/+/, ""));
  }
  const today = new Date().toISOString().slice(0, 10);
  const list = [...paths].sort((a, b) => (a === "/" ? -1 : b === "/" ? 1 : a.localeCompare(b)));
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    list
      .map((p) => `  <url><loc>${SITE}${p === "/" ? "/" : p}</loc><lastmod>${today}</lastmod><priority>${p === "/" ? "1.0" : p.split("/").length === 2 ? "0.8" : "0.6"}</priority></url>`)
      .join("\n") +
    `\n</urlset>\n`;
  writeFileSync(resolve(root, "public/sitemap.xml"), xml);
  console.log(`[sitemap] ${list.length} URL → public/sitemap.xml`);
} catch (e) {
  console.warn("[sitemap] dilewati:", e?.message ?? e);
}
