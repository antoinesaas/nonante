import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArtBackdrop } from "@/components/Art";
import { DEFAULT_PROFILE_ART } from "@/lib/art";
import { requireUser } from "@/lib/auth";
import { btnPrimary } from "@/lib/ui";

export const metadata: Metadata = { title: "Succès" };

type NewAchievement = { code: string; title: string; description: string; points: number; art_slug: string | null };

/** Succès débloqués depuis la dernière visite, avec l'œuvre qu'ils débloquent. */
export default async function AchievementsPage() {
  const { supabase } = await requireUser("/app/succes");
  const { data } = await supabase.rpc("new_achievements");
  const items = (data as NewAchievement[] | null) ?? [];
  if (!items.length) redirect("/app");
  await supabase.rpc("mark_achievements_seen");
  const withArt = items.find((a) => a.art_slug);

  return (
    <ArtBackdrop slug={withArt?.art_slug ?? DEFAULT_PROFILE_ART}>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-end px-5 pb-16">
        <p className="text-xs tracking-[0.2em] text-mute uppercase">{items.length > 1 ? "Succès débloqués" : "Succès débloqué"}</p>
        <ul className="mt-6 space-y-6">
          {items.map((a) => (
            <li key={a.code}>
              <p className="font-serif text-5xl leading-none">{a.title}</p>
              <p className="mt-3 text-paper/80">
                {a.description}
                {a.points ? ` +${a.points} points.` : ""}
              </p>
            </li>
          ))}
        </ul>
        {withArt ? <p className="mt-6 text-sm text-mute">Une œuvre rejoint ton profil.</p> : null}
        <Link href="/app" className={`${btnPrimary} mt-12`}>
          Continuer
        </Link>
      </main>
    </ArtBackdrop>
  );
}
