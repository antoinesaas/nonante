// Images de démarrage iOS (apple-touch-startup-image) : affichées par l'iPhone pendant le lancement de l'app
// installée, à la place d'un écran noir. Même dessin que l'écran d'ouverture (components/Splash.tsx).
// Usage : node scripts/gen-splash.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";

export const SPLASH_DEVICES = [
  [440, 956, 3],
  [402, 874, 3],
  [430, 932, 3],
  [393, 852, 3],
  [428, 926, 3],
  [390, 844, 3],
  [375, 812, 3],
  [414, 896, 3],
  [414, 896, 2],
  [414, 736, 3],
  [375, 667, 2],
];

function svg(w, h, dpr) {
  const s = dpr;
  const cx = w / 2;
  const cy = h / 2;
  const r = 50 * s;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w * s}" height="${h * s}" viewBox="0 0 ${w * s} ${h * s}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#c9b3ff"/><stop offset="60%" stop-color="#9b6bff"/><stop offset="100%" stop-color="#9b6bff" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#9b6bff" stop-opacity="0.18"/><stop offset="100%" stop-color="#000" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="#000"/>
  <circle cx="${cx * s}" cy="${cy * s}" r="${180 * s}" fill="url(#glow)"/>
  <circle cx="${cx * s}" cy="${cy * s}" r="${r}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="${4 * s}"/>
  <path d="M ${cx * s} ${cy * s - r} A ${r} ${r} 0 1 1 ${cx * s - r} ${cy * s}" fill="none" stroke="url(#g)" stroke-width="${4 * s}" stroke-linecap="round"/>
  <g transform="translate(${(cx - 17.5 * (44 / 32)) * s} ${(cy - 17.5 * (44 / 32)) * s}) scale(${(44 / 32) * s})" fill="none">
    <path d="M6 6A20 20 0 0 1 26 26" stroke="#f5f5f7" stroke-width="2.5"/>
    <circle cx="26" cy="26" r="3" fill="#f5f5f7"/>
  </g>
</svg>`;
}

{
  mkdirSync("public/splash", { recursive: true });
  for (const [w, h, dpr] of SPLASH_DEVICES) {
    await sharp(Buffer.from(svg(w, h, dpr))).png({ compressionLevel: 9 }).toFile(`public/splash/${w * dpr}x${h * dpr}.png`);
  }
  console.log(`${SPLASH_DEVICES.length} images de démarrage dans public/splash`);
}
