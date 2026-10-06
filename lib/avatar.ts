/** URL publique d'une photo de profil (bucket public « avatars »), ou null. */
export function avatarUrl(path: string | null | undefined): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!path || !base || !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/.test(path)) return null;
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/avatars/${path}`;
}
