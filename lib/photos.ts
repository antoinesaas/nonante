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
type PhotoMessages = { missing: string; tooBig: string; notImage: string; format: string; unreadable: string; upload: string };

export async function storeProofPhoto(userId: string, file: unknown, t: PhotoMessages): Promise<{ path: string } | { error: string }> {
  if (!(file instanceof File) || file.size === 0) return { error: t.missing };
  if (file.size > MAX_PHOTO_BYTES) return { error: t.tooBig };

  const input = Buffer.from(await file.arrayBuffer());
  let format: string | undefined;
  try {
    format = (await sharp(input).metadata()).format;
  } catch {
    return { error: t.notImage };
  }
  if (!format || !ACCEPTED.has(format)) return { error: t.format };

  let clean: Buffer;
  try {
    // Sans .withMetadata(), sharp ne recopie aucune métadonnée.
    clean = await sharp(input, { failOn: "error" })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
  } catch {
    return { error: t.unreadable };
  }

  const path = `${userId}/${randomUUID()}.jpg`;
  const { error } = await createAdminClient()
    .storage.from("proofs")
    .upload(path, clean, { contentType: "image/jpeg", upsert: false });
  if (error) return { error: t.upload };
  return { path };
}

export async function removeProofPhotos(paths: string[]): Promise<void> {
  if (!paths.length) return;
  const storage = createAdminClient().storage.from("proofs");
  for (let i = 0; i < paths.length; i += 100) {
    await storage.remove(paths.slice(i, i + 100));
  }
}

/** Photo de profil : carré 512 px, WebP, sans métadonnées, dans le bucket public avatars/<user_id>/<uuid>.webp. */
export async function storeAvatar(userId: string, file: unknown, t: PhotoMessages): Promise<{ path: string } | { error: string }> {
  if (!(file instanceof File) || file.size === 0) return { error: t.missing };
  if (file.size > MAX_PHOTO_BYTES) return { error: t.tooBig };
  const input = Buffer.from(await file.arrayBuffer());
  let format: string | undefined;
  try {
    format = (await sharp(input).metadata()).format;
  } catch {
    return { error: t.notImage };
  }
  if (!format || !ACCEPTED.has(format)) return { error: t.format };
  let clean: Buffer;
  try {
    clean = await sharp(input, { failOn: "error" })
      .rotate()
      .resize({ width: 512, height: 512, fit: "cover", position: "attention" })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    return { error: t.unreadable };
  }
  const path = `${userId}/${randomUUID()}.webp`;
  const { error } = await createAdminClient()
    .storage.from("avatars")
    .upload(path, clean, { contentType: "image/webp", upsert: false, cacheControl: "31536000" });
  if (error) return { error: t.upload };
  return { path };
}

export async function removeAvatars(paths: string[]): Promise<void> {
  if (!paths.length) return;
  await createAdminClient().storage.from("avatars").remove(paths);
}
