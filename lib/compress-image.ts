/**
 * Réduit une image côté navigateur (1600 px, JPEG) avant l'envoi : les captures d'écran de téléphone
 * dépassent souvent la limite de 3 Mo. Le serveur re-vérifie et ré-encode de toute façon.
 * Si le navigateur ne sait pas décoder le fichier (HEIC sur Chrome…), on envoie l'original.
 */
export async function compressImage(file: File, max = 1600): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], "image.jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/** Remplace un fichier d'un FormData par sa version réduite. */
export async function compressField(formData: FormData, name: string): Promise<FormData> {
  const file = formData.get(name);
  if (file instanceof File && file.size > 0) formData.set(name, await compressImage(file));
  return formData;
}
