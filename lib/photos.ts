import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";

export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const ACCEPTED = new Set(["jpeg", "png", "webp", "heif"]);

/**
 * Vérifie le vrai type du fichier (décodage, pas l'extension), refuse au-delà de 3 Mo,
 * ré-encode en JPEG 1600 px maximum (métadonnées EXIF et position GPS supprimées)
 * puis dépose dans le bucket privé : proofs/<user_id>/<uuid>.jpg.
 */
export async function storeProofPhoto(userId: string, file: unknown): Promise<{ path: string } | { error: string }> {
  if (!(file instanceof File) || file.size === 0) return { error: "Photo manquante." };
  if (file.size > MAX_PHOTO_BYTES) return { error: "Photo trop lourde : 3 Mo maximum." };

  const input = Buffer.from(await file.arrayBuffer());
  let format: string | undefined;
  try {
    format = (await sharp(input).metadata()).format;
  } catch {
    return { error: "Ce fichier n'est pas une image." };
  }
  if (!format || !ACCEPTED.has(format)) return { error: "Format d'image non accepté." };

  let clean: Buffer;
  try {
    // Sans .withMetadata(), sharp ne recopie aucune métadonnée.
    clean = await sharp(input, { failOn: "error" })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
  } catch {
    return { error: "Image illisible." };
  }

  const path = `${userId}/${randomUUID()}.jpg`;
  const { error } = await createAdminClient()
    .storage.from("proofs")
    .upload(path, clean, { contentType: "image/jpeg", upsert: false });
  if (error) return { error: "Envoi impossible. Réessaie." };
  return { path };
}

export async function removeProofPhotos(paths: string[]): Promise<void> {
  if (!paths.length) return;
  const storage = createAdminClient().storage.from("proofs");
  for (let i = 0; i < paths.length; i += 100) {
    await storage.remove(paths.slice(i, i + 100));
  }
}
