/**
 * Télécharge les œuvres de la marque depuis Wikimedia Commons (§4).
 * - Ne garde que les fichiers dont la licence (LicenseShortName) indique le domaine public.
 * - Écrit public/art/<slug>.jpg, sa variante noir et blanc granulée <slug>-nb.jpg, et credits.json.
 * - Refuse et signale toute œuvre dont la licence n'est pas claire.
 * Usage : npm run art:fetch
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

type Work = {
  slug: string;
  query: string;
  // Le titre du fichier doit contenir l'un de ces mots (évite les homonymes).
  keywords: string[];
  title: string;
  artist: string;
  year: string;
};

const WORKS: Work[] = [
  { slug: "friedrich-moine", query: "Caspar David Friedrich Der Mönch am Meer", keywords: ["mönch am meer", "monk by the sea"],
    title: "Le Moine au bord de la mer", artist: "Caspar David Friedrich", year: "1808-1810" },
  { slug: "friedrich-voyageur", query: "Caspar David Friedrich Wanderer above the sea of fog", keywords: ["wanderer"],
    title: "Le Voyageur contemplant une mer de nuages", artist: "Caspar David Friedrich", year: "vers 1818" },
  { slug: "friedrich-rugen", query: "Caspar David Friedrich Kreidefelsen auf Rügen", keywords: ["kreidefelsen", "chalk cliffs"],
    title: "Falaises de craie sur l'île de Rügen", artist: "Caspar David Friedrich", year: "1818" },
  { slug: "malevitch-carre-noir", query: "Malevich Black Suprematic Square 1915", keywords: ["black square", "black suprematic square", "чёрный"],
    title: "Carré noir", artist: "Kasimir Malevitch", year: "1915" },
  { slug: "malevitch-carre-blanc", query: "Malevich Suprematist Composition White on White 1918", keywords: ["white on white"],
    title: "Carré blanc sur fond blanc", artist: "Kasimir Malevitch", year: "1918" },
  { slug: "mondrian-jetee", query: "Piet Mondrian Pier and Ocean 1915", keywords: ["pier and ocean", "pier en oceaan", "composition 10"],
    title: "Jetée et océan", artist: "Piet Mondrian", year: "1915" },
  { slug: "hammershoi-strandgade", query: "Vilhelm Hammershøi Interior Strandgade 30", keywords: ["strandgade"],
    title: "Intérieur, Strandgade 30", artist: "Vilhelm Hammershøi", year: "1901-1906" },
  { slug: "turner-norham", query: "Turner Norham Castle Sunrise", keywords: ["norham castle"],
    title: "Norham Castle, lever du soleil", artist: "J. M. W. Turner", year: "vers 1845" },
  { slug: "hokusai-vague", query: "Hokusai The Great Wave off Kanagawa", keywords: ["great wave", "kanagawa"],
    title: "La Grande Vague de Kanagawa", artist: "Katsushika Hokusai", year: "vers 1831" },
  { slug: "hiroshige-neige", query: "Hiroshige Kanbara night snow Tokaido", keywords: ["kanbara", "kambara"],
    title: "Neige de nuit à Kanbara", artist: "Utagawa Hiroshige", year: "1833-1834" },
  { slug: "adams-tetons", query: "Ansel Adams The Tetons and the Snake River", keywords: ["tetons"],
    title: "The Tetons and the Snake River", artist: "Ansel Adams (National Park Service)", year: "1942" },
];

const API = "https://commons.wikimedia.org/w/api.php";
// Wikimedia demande un User-Agent identifiable.
const HEADERS = { "User-Agent": "Nonante-fetch-art/1.0 (https://github.com/antoinesaas/nonante)" };
const OUT = join(process.cwd(), "public", "art");

type ImageInfo = {
  thumburl?: string;
  thumbwidth?: number;
  thumbheight?: number;
  width: number;
  mime: string;
  descriptionurl: string;
  extmetadata?: Record<string, { value: string }>;
};
type Page = { title: string; index?: number; imageinfo?: ImageInfo[] };

const isPublicDomain = (license: string) => /public domain|domaine public|^pd(\b|-)/i.test(license.trim());

async function candidates(query: string): Promise<Page[]> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrsearch: query,
    gsrnamespace: "6",
    gsrlimit: "15",
    prop: "imageinfo",
    iiprop: "url|extmetadata|size|mime",
    iiurlwidth: "2000",
  });
  const res = await fetch(`${API}?${params}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`Wikimedia : HTTP ${res.status}`);
  const json = (await res.json()) as { query?: { pages?: Record<string, Page> } };
  return Object.values(json.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
}

async function grain(input: Buffer): Promise<Buffer> {
  const base = sharp(input).grayscale();
  const { width = 0, height = 0 } = await base.metadata();
  const noise = Buffer.alloc(width * height);
  for (let i = 0; i < noise.length; i++) noise[i] = 128 + Math.round((Math.random() - 0.5) * 36);
  const noiseLayer = await sharp(noise, { raw: { width, height, channels: 1 } }).png().toBuffer();
  return base.composite([{ input: noiseLayer, blend: "overlay" }]).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const credits: Record<string, unknown>[] = [];
  const refused: string[] = [];

  for (const work of WORKS) {
    const pages = await candidates(work.query);
    const matching = pages.filter((p) => {
      const info = p.imageinfo?.[0];
      const title = p.title.toLowerCase();
      return (
        info?.thumburl &&
        /image\/(jpeg|png|tiff)/.test(info.mime) &&
        info.width >= 1000 &&
        work.keywords.some((k) => title.includes(k))
      );
    });
    // Premier fichier dont la licence indique clairement le domaine public.
    const match = matching.find((p) => isPublicDomain(p.imageinfo?.[0]?.extmetadata?.LicenseShortName?.value ?? ""));
    const info = match?.imageinfo?.[0];
    const license = info?.extmetadata?.LicenseShortName?.value ?? "";
    if (!matching.length) {
      refused.push(`${work.slug} : aucun fichier trouvé`);
      continue;
    }
    if (!match || !info?.thumburl) {
      const seen = matching.map((p) => p.imageinfo?.[0]?.extmetadata?.LicenseShortName?.value ?? "inconnue");
      refused.push(`${work.slug} : licence pas clairement du domaine public (${[...new Set(seen)].join(", ")})`);
      continue;
    }

    const res = await fetch(info.thumburl, { headers: HEADERS });
    if (!res.ok) {
      refused.push(`${work.slug} : téléchargement impossible (HTTP ${res.status})`);
      continue;
    }
    const original = Buffer.from(await res.arrayBuffer());
    const color = await sharp(original)
      .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 84, mozjpeg: true })
      .toBuffer();
    const { width = 0, height = 0 } = await sharp(color).metadata();
    writeFileSync(join(OUT, `${work.slug}.jpg`), color);
    writeFileSync(join(OUT, `${work.slug}-nb.jpg`), await grain(color));

    credits.push({
      slug: work.slug,
      title: work.title,
      artist: work.artist,
      year: work.year,
      license: license.trim(),
      source: info.descriptionurl,
      width,
      height,
    });
    console.log(`ok   ${work.slug} ← ${match.title} (${license.trim()})`);
  }

  writeFileSync(join(OUT, "credits.json"), `${JSON.stringify(credits, null, 2)}\n`);
  for (const line of refused) console.warn(`refusée  ${line}`);
  console.log(`\n${credits.length} œuvres gardées, ${refused.length} refusées.`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
