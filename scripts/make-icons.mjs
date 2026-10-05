// Génère les icônes de la PWA à partir du symbole (quart de cercle terminé par un point).
// Usage : node scripts/make-icons.mjs
import { mkdirSync } from "node:fs";
import sharp from "sharp";

// zone : part du carré occupée par le symbole (les icônes « maskable » gardent une marge de sécurité).
function svg(size, zone) {
  const pad = (size * (1 - zone)) / 2;
  const s = size * zone;
  const x0 = pad + s * 0.12;
  const y0 = pad + s * 0.12;
  const r = s * 0.7;
  const stroke = Math.max(2, s * 0.075);
  const dot = s * 0.095;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="#0A0A0A"/>
    <path d="M${x0} ${y0}A${r} ${r} 0 0 1 ${x0 + r} ${y0 + r}" fill="none" stroke="#F2F2F2" stroke-width="${stroke}"/>
    <circle cx="${x0 + r}" cy="${y0 + r}" r="${dot}" fill="#F2F2F2"/>
  </svg>`;
}

mkdirSync("public/icons", { recursive: true });
const icons = [
  ["icon-192.png", 192, 0.7],
  ["icon-512.png", 512, 0.7],
  ["icon-maskable-512.png", 512, 0.5],
  ["apple-touch-icon.png", 180, 0.62],
];
for (const [name, size, zone] of icons) {
  await sharp(Buffer.from(svg(size, zone))).png().toFile(`public/icons/${name}`);
}
console.log("Icônes générées dans public/icons.");
