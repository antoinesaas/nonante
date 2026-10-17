import type { Metadata } from "next";
import Link from "next/link";
import { Aura } from "@/components/Aura";
import { BackLink } from "@/components/BackLink";
import { CopyButton } from "@/components/CopyButton";
import { addDays } from "@/lib/answers";
import { requireUser } from "@/lib/auth";
import { todayParis } from "@/lib/dates";
import { siteUrl } from "@/lib/env";
import { fmt, formatDay } from "@/lib/i18n/format";
import { squadName } from "@/lib/i18n/labels";
import { getI18n } from "@/lib/i18n/server";
import type { PlanState, SquadView } from "@/lib/types";
import { btnSmall, label, largeTitle, sectionTitle } from "@/lib/ui";
import { JoinPublicButton, LeaveButton, SquadActions } from "./SquadForms";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.app.squads.title };
}

export default async function SquadsPage() {
  const [{ supabase }, { m, locale }] = await Promise.all([requireUser("/app/escouades"), getI18n()]);
  const t = m.app.squads;
  const [{ data: mine }, { data: open }, { data: plan }] = await Promise.all([supabase.rpc("my_squads"), supabase.rpc("public_squads"), supabase.rpc("my_plan")]);
  const squads = (mine as SquadView[] | null) ?? [];
  const publicSquads = ((open as SquadView[] | null) ?? []).filter((s) => !s.is_member);
  const canCreate = Boolean((plan as PlanState | null)?.limits?.create_squad);
  const members = (n: number) => fmt(t.members, { n }, locale);

  return (
    <>
      <Aura tone="sky" />
      <div className="lg:hidden">
        <BackLink />
      </div>
      <header className="mt-4 animate-in">
        <p className={label}>{t.title}</p>
        <h1 className={`mt-1 ${largeTitle}`}>{t.heading}</h1>
        <p className="mt-2 text-sm text-mute">{t.intro}</p>
      </header>

      <div className="mt-6">
        <SquadActions canCreate={canCreate} today={todayParis()} maxDay={addDays(todayParis(), 120)} />
      </div>

      <div className="lg:grid lg:grid-cols-2 lg:gap-12">
        <section className="mt-8">
          <h2 className={sectionTitle}>{t.mine}</h2>
          {squads.length ? (
            <ul className="mt-3 space-y-2.5">
              {squads.map((s) => (
                <li key={s.id} className="card p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[17px] font-medium">{squadName(s, m)}</p>
                      <p className="mt-0.5 text-[12px] text-mute">
                        {members(s.members)}
                        {s.is_official ? t.official : s.is_public ? t.public : t.private}
                        {s.is_official ? t.everyMonday : s.start_date ? fmt(t.start, { date: formatDay(s.start_date, locale, { year: false }) }) : ""}
                        {s.is_owner ? t.owner : ""}
                      </p>
                      {s.description && !s.is_official ? <p className="mt-2 text-sm text-mute">{s.description}</p> : null}
                    </div>
                    <Link href={`/classement?escouade=${s.id}`} className={btnSmall}>
                      {t.leaderboard}
                    </Link>
                  </div>
                  {s.code ? (
                    <div className="glow-sky mt-4 flex items-center justify-between gap-4 rounded-2xl p-3.5">
                      <span>
                        <span className="block text-[11px] text-paper/75">{t.code}</span>
                        <span className="font-display text-[22px] tracking-[0.2em]">{s.code}</span>
                      </span>
                      <CopyButton value={fmt(t.inviteText, { name: squadName(s, m), code: s.code, url: `${siteUrl()}/app/escouades` })} label={t.invite} />
                    </div>
                  ) : null}
                  <div className="mt-3">
                    <LeaveButton id={s.id} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="card mt-3 p-4 text-sm text-mute">{t.none}</p>
          )}
        </section>

        {publicSquads.length ? (
          <section className="mt-8">
            <h2 className={sectionTitle}>{t.open}</h2>
            <ul className="grouped mt-3">
              {publicSquads.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-4 px-4 py-3.5">
                  <div className="min-w-0">
                    <p className="text-[15px]">{squadName(s, m)}</p>
                    <p className="mt-0.5 text-[12px] text-mute">
                      {members(s.members)}
                      {s.is_official ? `${t.official}${t.everyMonday}` : s.start_date ? fmt(t.start, { date: formatDay(s.start_date, locale) }) : ""}
                    </p>
                    {s.description && !s.is_official ? <p className="mt-1 text-sm text-mute">{s.description}</p> : null}
                  </div>
                  <JoinPublicButton id={s.id} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}
