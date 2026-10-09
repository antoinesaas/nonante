import type { Metadata } from "next";
import { markLevelSeen } from "@/app/actions/seen";
import { ArtBackdrop } from "@/components/Art";
import { IMAGES } from "@/lib/art";
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
    <ArtBackdrop slug={IMAGES.levelUp}>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-end px-5 pb-16">
        <p className="animate-rise text-xs tracking-[0.2em] text-mute uppercase">{newTitle ? t.newTitle : t.levelUp}</p>
        <p className="mt-4 animate-pop font-serif text-7xl leading-none [animation-delay:150ms]">{fmt(t.level, { n: level })}</p>
        <p className="mt-4 animate-rise font-serif text-3xl [animation-delay:350ms]">{titleFor(level, m)}</p>
        <p className="mt-6 animate-rise text-lg text-paper/85 [animation-delay:450ms]">{next ? fmt(t.next, { title: next.title, level: next.level }) : t.top}</p>
        <form action={markLevelSeen} className="mt-12 animate-rise [animation-delay:600ms]">
          <SubmitButton className={btnPrimary} pendingLabel={m.common.actions.loading}>
            {m.common.actions.continue}
          </SubmitButton>
        </form>
      </main>
    </ArtBackdrop>
  );
}
