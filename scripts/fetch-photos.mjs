/**
 * Photos de la marque : uniquement des images sous licence CC0 ou marquées « domaine public »,
 * trouvées via l'API Openverse (https://api.openverse.org). Jamais d'images Pinterest ou Google Images.
 *
 * Pour chaque photo : vérifie la licence à la source, télécharge, passe en noir et blanc légèrement
 * granulé (public/art/<slug>-nb.jpg) et ajoute le crédit dans public/art/credits.json.
 * Refuse toute photo dont la licence n'est plus CC0 / PDM.
 *
 * Usage : npm run photos:fetch
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "public", "art");
const CREDITS = path.join(OUT, "credits.json");

// [slug, identifiant Openverse, recadrage facultatif en fractions { left, top, width, height }]
const PHOTOS = [
  ["nuit-tours", "efdf9715-f67d-45fc-a7e0-4b8e74009279"],
  ["ville-nuit", "da233d77-c3a4-4dea-8802-ab5c439414b6"],
  ["echecs", "ee6da7f7-aad1-4836-a2cd-e1632fead45c", { left: 0, top: 0, width: 1, height: 0.92 }],
  ["oiseaux-fil", "77e377ac-c21c-4572-92de-e7f1818d8059", { left: 0.02, top: 0.02, width: 0.96, height: 0.86 }],
  ["clavier", "83010544-bd85-49ee-aa13-6e8a641debee"],
  ["billets", "afd007d4-b1cf-43f8-aabb-0984a4160728"],
  ["liasse", "bbea2daf-d372-45fc-aa59-e4d73af08b4e"],
  ["sommet", "b33222f8-f471-4d0f-bb95-f7ee125f61f6"],
  ["aube", "eff3712f-d562-4d5f-a6da-32508c7aa727"],
  ["halteres", "bfd480c9-ff6f-4305-9d8d-6aa63630dcb2"],
  ["marc-aurele", "d8988515-54d8-40dd-b02f-d65b62bc48cd"],
  ["fenetre", "33f871fd-0473-467c-8ffc-42b313b80e1e", { left: 0.04, top: 0.04, width: 0.92, height: 0.86 }],
  ["escalier", "a710dedc-c9fb-4292-850e-799ecbb0d1aa"],
  ["piste", "742a1739-9e21-4c0d-ac36-7f7ce63da071"],
  ["carnet", "6d55483a-ac31-4291-bf17-5e4d52b6e34c"],
  ["bureau-nuit", "b90b48bd-5f3a-4adb-a018-45afa6c4db8b"],
  ["route", "3d9483a5-b913-4250-9fee-80a40eff9891"],
  ["arbre", "d1a69a7c-3674-4f5d-bb4f-185beed8db22"],
  ["montre", "a51ea738-3df9-4694-9ad7-b711b697e7ec"],
  ["pluie-nuit", "e40d9a05-6635-4bb4-851a-835409f63f00"],
  ["au-dessus-nuages", "d8822786-e3b0-4e73-9148-a0580fa019aa"],
];

const LICENSES = { cc0: "CC0", pdm: "Domaine public (PDM)" };

/** Grain fin et régulier, généré une fois par taille. */
async function grain(width, height) {
  const pixels = Buffer.alloc(width * height);
  let seed = 7;
  for (let i = 0; i < pixels.length; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    pixels[i] = 128 + ((seed >> 16) % 36) - 18;
  }
  return sharp(pixels, { raw: { width, height, channels: 1 } }).png().toBuffer();
}

async function main() {
  const credits = JSON.parse(await readFile(CREDITS, "utf8")).filter((c) => c.kind !== "photo");
  let refused = 0;

  for (const [slug, id, crop] of PHOTOS) {
    const res = await fetch(`https://api.openverse.org/v1/images/${id}/`);
    if (!res.ok) {
      console.error(`${slug} : introuvable sur Openverse (${res.status}).`);
      refused++;
      continue;
    }
    const meta = await res.json();
    if (!LICENSES[meta.license]) {
      console.error(`${slug} : licence « ${meta.license} » refusée.`);
      refused++;
      continue;
    }
    const img = await fetch(meta.url);
    if (!img.ok) {
      console.error(`${slug} : téléchargement impossible (${img.status}).`);
      refused++;
      continue;
    }
    let input = Buffer.from(await img.arrayBuffer());
    if (crop) {
      const { width: w, height: h } = await sharp(input).rotate().metadata();
      input = await sharp(input).rotate().extract({
        left: Math.round(crop.left * w), top: Math.round(crop.top * h),
        width: Math.round(crop.width * w), height: Math.round(crop.height * h),
      }).toBuffer();
    }
    const base = sharp(input).rotate().resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: true });
    const { width, height } = await base.clone().toBuffer({ resolveWithObject: true }).then((r) => r.info);
    await base
      .grayscale()
      .linear(1.08, -10)
      .composite([{ input: await grain(width, height), blend: "overlay" }])
      .jpeg({ quality: 74, progressive: true, mozjpeg: true })
      .toFile(path.join(OUT, `${slug}-nb.jpg`));

    credits.push({
      slug,
      kind: "photo",
      title: (meta.title || "Sans titre").slice(0, 120),
      artist: meta.creator || "Auteur inconnu",
      year: "",
      license: LICENSES[meta.license],
      source: meta.foreign_landing_url || meta.url,
      width,
      height,
    });
    console.log(`${slug} : ${LICENSES[meta.license]}, ${width}×${height}`);
  }

  await writeFile(CREDITS, JSON.stringify(credits, null, 2) + "\n");
  if (refused) {
    console.error(`${refused} photo(s) refusée(s).`);
    process.exitCode = 1;
  }
}

main();
