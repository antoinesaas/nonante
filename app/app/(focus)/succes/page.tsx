import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { markAchievementsSeen } from "@/app/actions/seen";
import { ArtBackdrop } from "@/components/Art";
import { IMAGES } from "@/lib/art";
import { requireUser } from "@/lib/auth";
import { fmt } from "@/lib/i18n/format";
import { getI18n } from "@/lib/i18n/server";
import { SubmitButton } from "@/components/SubmitButton";
import { btnPrimary } from "@/lib/ui";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.app.rewards.achievementsTitle };
}

type NewAchievement = { code: string; title: string; description: string; points: number; art_slug: string | null };

const DELAYS = ["[animation-delay:150ms]", "[animation-delay:300ms]", "[animation-delay:450ms]", "[animation-delay:600ms]"];

/** Succès débloqués depuis la dernière visite, avec l'œuvre qu'ils débloquent. */
export default async function AchievementsPage() {
  const [{ supabase }, { m }] = await Promise.all([requireUser("/app/succes"), getI18n()]);
  const t = m.app.rewards;
  const { data } = await supabase.rpc("new_achievements");
  const items = (data as NewAchievement[] | null) ?? [];
  if (!items.length) redirect("/app");
  const withArt = items.find((a) => a.art_slug);

  return (
    <ArtBackdrop slug={withArt?.art_slug ?? IMAGES.arcDone}>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-end px-5 pb-16">
        <p className="animate-rise text-xs tracking-[0.2em] text-mute uppercase">{items.length > 1 ? t.unlockedMany : t.unlockedOne}</p>
        <ul className="mt-6 space-y-6">
          {items.map((a, i) => {
            const text = m.content.achievements[a.code] ?? a;
            return (
              <li key={a.code} className={`animate-rise ${DELAYS[i] ?? ""}`}>
                <p className="font-serif text-5xl leading-none">{text.title}</p>
                <p className="mt-3 text-paper/80">
                  {text.description}
                  {a.points ? fmt(t.points, { n: a.points }) : ""}
                </p>
              </li>
            );
          })}
        </ul>
        {withArt ? <p className="mt-6 text-sm text-mute">{t.newBackground}</p> : null}
        <form action={markAchievementsSeen} className="mt-12">
          <SubmitButton className={btnPrimary} pendingLabel={m.common.actions.loading}>
            {m.common.actions.continue}
          </SubmitButton>
        </form>
      </main>
    </ArtBackdrop>
  );
}
