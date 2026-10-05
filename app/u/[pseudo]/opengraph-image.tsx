import { createClient } from "@supabase/supabase-js";
import { ImageResponse } from "next/og";
import { DEFAULT_PROFILE_ART, getArt } from "@/lib/art";
import type { Database } from "@/lib/database.types";
import { siteUrl } from "@/lib/env";
import { points } from "@/lib/proofs";
import type { PublicProfile } from "@/lib/types";

export const alt = "Profil Nonante";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Carte de partage d'un profil public : l'œuvre en noir et blanc, le pseudo, le jour, les points. */
export default async function Image({ params }: { params: Promise<{ pseudo: string }> }) {
  const { pseudo } = await params;
  let profile: PublicProfile | null = null;
  if (/^[a-z0-9_]{3,20}$/.test(pseudo) && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
    const { data } = await supabase.rpc("public_profile", { p_pseudo: pseudo });
    profile = (data as PublicProfile | null) ?? null;
  }

  const art = getArt(profile?.art) ?? getArt(DEFAULT_PROFILE_ART);
  let artData: string | null = null;
  if (art) {
    try {
      const res = await fetch(`${siteUrl()}/art/${art.slug}-nb.jpg`);
      if (res.ok) artData = `data:image/jpeg;base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
    } catch {
      artData = null;
    }
  }

  const line = profile
    ? [profile.day_number ? `Jour ${profile.day_number} sur 90` : null, `${points(profile.points ?? 0)} points`].filter(Boolean).join(" · ")
    : "Tiens 90 jours. Prouve-le.";

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#0A0A0A", color: "#F2F2F2" }}>
        {artData ? (
          <img src={artData} alt="" width={540} height={630} style={{ objectFit: "cover", width: 540, height: 630 }} />
        ) : null}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 64, flex: 1 }}>
          <div style={{ fontSize: 34, letterSpacing: -0.5 }}>nonante</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 76, lineHeight: 1 }}>{profile?.pseudo ?? "Nonante"}</div>
            <div style={{ fontSize: 30, marginTop: 24, color: "#8A8A8A" }}>{line}</div>
          </div>
          <div style={{ fontSize: 22, color: "#8A8A8A" }}>{art ? `${art.artist}, ${art.title}. Domaine public.` : ""}</div>
        </div>
      </div>
    ),
    size,
  );
}
