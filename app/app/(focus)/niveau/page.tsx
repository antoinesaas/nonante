import type { Metadata } from "next";
import Link from "next/link";
import { ArtBackdrop } from "@/components/Art";
import { LEVEL_ART } from "@/lib/art";
import { requireUser } from "@/lib/auth";
import type { Dashboard } from "@/lib/types";
import { btnPrimary } from "@/lib/ui";

export const metadata: Metadata = { title: "Niveau" };

const PHRASES: Record<number, string> = {
  2: "Trois épreuves d'affilée. Les principes de difficulté 3 sont à toi.",
  3: "Niveau 3. Les épreuves les plus dures commencent.",
};

/** Montée de niveau : l'œuvre en plein écran, en noir et blanc, une phrase, rien d'autre. */
export default async function LevelPage() {
  const { supabase } = await requireUser("/app/niveau");
  const { data } = await supabase.rpc("my_dashboard");
  const level = (data as Dashboard | null)?.enrollment?.level ?? 1;
  // Vu : on ne le montre qu'une fois.
  await supabase.rpc("mark_level_seen");

  return (
    <ArtBackdrop slug={LEVEL_ART[level]}>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-end px-5 pb-16">
        <p className="font-serif text-7xl leading-none">Niveau {level}.</p>
        <p className="mt-6 text-lg">{PHRASES[level] ?? ""}</p>
        <Link href="/app" className={`${btnPrimary} mt-12`}>
          Continuer
        </Link>
      </main>
    </ArtBackdrop>
  );
}
