import type { Metadata } from "next";
import { markLevelSeen } from "@/app/actions/seen";
import { Aura } from "@/components/Aura";
import { CelebrationBurst, CelebrationTitle } from "@/components/Celebration";
import { requireUser } from "@/lib/auth";
import { fmt } from "@/lib/i18n/format";
import { nextTitle, titleFor } from "@/lib/i18n/labels";
import { getI18n } from "@/lib/i18n/server";
import { SubmitButton } from "@/components/SubmitButton";
import { btnPrimary } from "@/lib/ui";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.app.rewards.levelTitle };
}

/** Montée de niveau : une image plein écran, le niveau, le titre, rien d'autre. */
export default async function LevelPage() {
  const [{ supabase, user }, { m }] = await Promise.all([requireUser("/app/niveau"), getI18n()]);
  const t = m.app.rewards;
  const { data } = await supabase.from("player_stats").select("level").eq("user_id", user.id).maybeSingle();
  const level = data?.level ?? 1;
  const next = nextTitle(level, m);
  const newTitle = titleFor(level, m) !== titleFor(level - 1, m);

  return (
    <main className="relative isolate mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-end overflow-x-clip px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <Aura tone="violet" className="h-[40rem] opacity-60" />
        <div className="grid flex-1 place-items-center pt-10">
          <CelebrationBurst kind="level" className="size-60" />
        </div>
        <p className="animate-rise text-[13px] font-medium text-mute [animation-delay:500ms]">{newTitle ? t.newTitle : t.levelUp}</p>
        <p className="mt-3 font-display text-[56px] leading-none">
          <CelebrationTitle text={fmt(t.level, { n: level })} />
        </p>
        <p className="mt-3 animate-rise bg-linear-to-r from-rose via-violet to-sky bg-clip-text font-display text-[28px] text-transparent [animation-delay:900ms]">{titleFor(level, m)}</p>
        <p className="mt-6 animate-rise text-lg text-paper/85 [animation-delay:1000ms]">{next ? fmt(t.next, { title: next.title, level: next.level }) : t.top}</p>
        <form action={markLevelSeen} className="mt-12 animate-rise [animation-delay:1100ms]">
          <SubmitButton className={btnPrimary} pendingLabel={m.common.actions.loading}>
            {m.common.actions.continue}
          </SubmitButton>
        </form>
    </main>
  );
}
