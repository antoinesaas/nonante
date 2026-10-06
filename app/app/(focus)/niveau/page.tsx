import type { Metadata } from "next";
import { ArtBackdrop } from "@/components/Art";
import { IMAGES } from "@/lib/art";
import { markLevelSeen } from "@/app/actions/seen";
import { requireUser } from "@/lib/auth";
import { nextTitle, titleFor } from "@/lib/rules";
import { btnPrimary } from "@/lib/ui";

export const metadata: Metadata = { title: "Niveau" };

/** Montée de niveau : une image plein écran, le niveau, le titre, rien d'autre. */
export default async function LevelPage() {
  const { supabase, user } = await requireUser("/app/niveau");
  const { data } = await supabase.from("player_stats").select("level").eq("user_id", user.id).maybeSingle();
  const level = data?.level ?? 1;
  const next = nextTitle(level);
  const newTitle = titleFor(level) !== titleFor(level - 1);

  return (
    <ArtBackdrop slug={IMAGES.levelUp}>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-end px-5 pb-16">
        <p className="text-xs tracking-[0.2em] text-mute uppercase">{newTitle ? "Nouveau titre" : "Niveau supérieur"}</p>
        <p className="mt-4 font-serif text-7xl leading-none">Niveau {level}.</p>
        <p className="mt-4 font-serif text-3xl">{titleFor(level)}</p>
        <p className="mt-6 text-lg text-paper/85">
          {next ? `Prochain titre : ${next.title}, au niveau ${next.level}.` : "Le sommet. Reste-y."}
        </p>
        <form action={markLevelSeen} className="mt-12">
          <button type="submit" className={btnPrimary}>
            Continuer
          </button>
        </form>
      </main>
    </ArtBackdrop>
  );
}
