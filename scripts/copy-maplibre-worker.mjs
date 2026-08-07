// Turbopack doesn't produce an http(s) import.meta.url for maplibre-gl's
// own worker auto-detection (defaultWorkerUrl() in maplibre-gl's source
// requires /^https?:/ and silently returns "" otherwise, which maplibre-gl
// then hands straight to `new Worker("")` with no error — the map just
// never fires 'load' and no tiles ever render). The fix is to serve the
// worker script ourselves and point maplibre-gl at it via setWorkerUrl()
// (see src/lib/map-config.ts). This script copies it into public/ so it's
// always in sync with the installed maplibre-gl version.
import { copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "..", "node_modules", "maplibre-gl", "dist");
const publicDir = path.join(__dirname, "..", "public");

// worker.mjs imports "./maplibre-gl-shared.mjs" as a relative sibling —
// since it's loaded raw by the browser (not bundled by Turbopack), that
// sibling has to physically exist next to it in public/ too, or the module
// worker fails with an opaque, unhelpful error and the map silently never
// loads.
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(path.join(distDir, file), path.join(publicDir, file));
}
console.log("Copied maplibre-gl worker + shared chunk to public/");
