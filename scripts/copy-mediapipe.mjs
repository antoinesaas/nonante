// Copie les fichiers WebAssembly de MediaPipe dans public/mediapipe (servis par le site lui-même,
// aucune requête vers un CDN tiers). Lancé automatiquement après npm install.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const from = join(process.cwd(), "node_modules", "@mediapipe", "tasks-vision", "wasm");
const to = join(process.cwd(), "public", "mediapipe");
const files = [
  "vision_wasm_internal.js",
  "vision_wasm_internal.wasm",
  "vision_wasm_nosimd_internal.js",
  "vision_wasm_nosimd_internal.wasm",
];

if (!existsSync(from)) {
  console.warn("[mediapipe] paquet absent, copie ignorée.");
  process.exit(0);
}
mkdirSync(to, { recursive: true });
for (const file of files) copyFileSync(join(from, file), join(to, file));
console.log(`[mediapipe] ${files.length} fichiers copiés dans public/mediapipe.`);
