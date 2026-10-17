import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { markAchievementsSeen } from "@/app/actions/seen";
import { Aura } from "@/components/Aura";
import { CelebrationBurst, CelebrationTitle } from "@/components/Celebration";
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

const DELAYS = ["", "[animation-delay:1000ms]", "[animation-delay:1150ms]", "[animation-delay:1300ms]"];

/** Succès débloqués depuis la dernière visite, avec l'œuvre qu'ils débloquent. */
export default async function AchievementsPage() {
  const [{ supabase }, { m }] = await Promise.all([requireUser("/app/succes"), getI18n()]);
  const t = m.app.rewards;
  const { data } = await supabase.rpc("new_achievements");
  const items = (data as NewAchievement[] | null) ?? [];
  if (!items.length) redirect("/app");
  const withArt = items.find((a) => a.art_slug);

  return (
    <main className="relative isolate mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-end overflow-x-clip px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <Aura tone="amber" className="h-[40rem] opacity-60" />
        <div className="grid flex-1 place-items-center pt-10">
          <CelebrationBurst kind="achievement" className="size-60" />
        </div>
        <p className="animate-rise text-[13px] font-medium text-mute [animation-delay:500ms]">{items.length > 1 ? t.unlockedMany : t.unlockedOne}</p>
        <ul className="mt-6 space-y-6">
          {items.map((a, i) => {
            const text = m.content.achievements[a.code] ?? a;
            return (
              <li key={a.code} className={i ? `animate-rise ${DELAYS[i] ?? ""}` : ""}>
                <p className="font-display text-[40px] leading-none">{i ? text.title : <CelebrationTitle text={text.title} />}</p>
                <p className={`mt-3 text-paper/80 ${i ? "" : "animate-rise [animation-delay:900ms]"}`}>
                  {text.description}
                  {a.points ? fmt(t.points, { n: a.points }) : ""}
                </p>
              </li>
            );
          })}
        </ul>
        {withArt ? <p className="mt-6 animate-rise text-sm text-mute [animation-delay:1000ms]">{t.newBackground}</p> : null}
        <form action={markAchievementsSeen} className="mt-12 animate-rise [animation-delay:1100ms]">
          <SubmitButton className={btnPrimary} pendingLabel={m.common.actions.loading}>
            {m.common.actions.continue}
          </SubmitButton>
        </form>
    </main>
  );
}
