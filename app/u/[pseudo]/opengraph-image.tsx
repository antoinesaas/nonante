import { createClient } from "@supabase/supabase-js";
import { ImageResponse } from "next/og";
import { DEFAULT_PROFILE_ART, getArt } from "@/lib/art";
import type { Database } from "@/lib/database.types";
import { siteUrl } from "@/lib/env";
import { titleFor } from "@/lib/rules";
import type { PublicProfile } from "@/lib/types";

export const alt = "Carte de joueur Nonante";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const STATS: [keyof PublicProfile["stats"], string][] = [
  ["discipline", "DIS"],
  ["focus", "FOC"],
  ["business", "BUS"],
  ["corps", "COR"],
  ["esprit", "ESP"],
  ["energie", "ÉNE"],
];

/** Carte de partage : la carte de joueur (note, niveau, stats) sur le fond choisi. */
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

  const s = profile?.stats;
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#0A0A0A", color: "#F2F2F2", position: "relative" }}>
        {artData ? (
          <img src={artData} alt="" width={1200} height={630} style={{ position: "absolute", inset: 0, objectFit: "cover", width: 1200, height: 630, opacity: 0.28 }} />
        ) : null}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 64, width: "100%" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 30 }}>
            <span>nonante</span>
            <span style={{ color: "#8A8A8A" }}>90 jours. zéro excuse.</span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 48 }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 150, lineHeight: 1 }}>{s ? s.ovr : "90"}</span>
              <span style={{ fontSize: 22, color: "#8A8A8A", letterSpacing: 4 }}>NOTE GLOBALE</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 76, lineHeight: 1 }}>{profile?.pseudo ?? "Nonante"}</span>
              <span style={{ fontSize: 28, marginTop: 12, color: "#8A8A8A" }}>
                {s ? `Niveau ${s.level} · ${titleFor(s.level)}${profile?.arc?.day_number ? ` · jour ${profile.arc.day_number}/90` : ""}` : "90 jours. Prouve-le."}
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 36 }}>
            {s
              ? STATS.map(([key, short]) => (
                  <div key={key} style={{ display: "flex", flexDirection: "column", width: 140 }}>
                    <span style={{ fontSize: 20, color: "#8A8A8A" }}>{short}</span>
                    <span style={{ fontSize: 44 }}>{String(s[key])}</span>
                    <div style={{ display: "flex", height: 4, background: "#2A2A2A" }}>
                      <div style={{ display: "flex", height: 4, width: `${Math.min(99, Number(s[key]))}%`, background: "#F2F2F2" }} />
                    </div>
                  </div>
                ))
              : null}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
