import type { Metadata } from "next";
import Link from "next/link";
import { ArtBand } from "@/components/Art";
import { BackLink } from "@/components/BackLink";
import { CopyButton } from "@/components/CopyButton";
import { addDays } from "@/lib/answers";
import { IMAGES } from "@/lib/art";
import { requireUser } from "@/lib/auth";
import { todayParis } from "@/lib/dates";
import { siteUrl } from "@/lib/env";
import { fmt, formatDay } from "@/lib/i18n/format";
import { squadName } from "@/lib/i18n/labels";
import { getI18n } from "@/lib/i18n/server";
import type { PlanState, SquadView } from "@/lib/types";
import { btnLink, label } from "@/lib/ui";
import { CreateForm, JoinForm, JoinPublicButton, LeaveButton } from "./SquadForms";

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
      <div className="lg:hidden">
        <BackLink />
      </div>
      <ArtBand slug={IMAGES.squads} className="-mx-5 mt-2 h-56 lg:mx-0">
        <p className={label}>{t.title}</p>
        <h1 className="mt-2 font-serif text-4xl leading-none">{t.heading}</h1>
      </ArtBand>
      <p className="mt-6 text-sm text-mute">{t.intro}</p>

      <div className="lg:grid lg:grid-cols-2 lg:gap-12">
        <div>
          <section className="mt-10">
            <h2 className="font-serif text-3xl">{t.mine}</h2>
            {squads.length ? (
              <ul className="mt-4 divide-y divide-line border-y border-line">
                {squads.map((s) => (
                  <li key={s.id} className="py-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-lg">{squadName(s, m)}</p>
                        <p className="mt-1 text-xs text-mute">
                          {members(s.members)}
                          {s.is_official ? t.official : s.is_public ? t.public : t.private}
                          {s.is_official ? t.everyMonday : s.start_date ? fmt(t.start, { date: formatDay(s.start_date, locale, { year: false }) }) : ""}
                          {s.is_owner ? t.owner : ""}
                        </p>
                        {s.description && !s.is_official ? <p className="mt-2 text-sm text-mute">{s.description}</p> : null}
                      </div>
                      <Link href={`/classement?escouade=${s.id}`} className={btnLink}>
                        {t.leaderboard}
                      </Link>
                    </div>
                    {s.code ? (
                      <div className="mt-4 flex items-center justify-between gap-4 rounded-xs border border-line p-3">
                        <span>
                          <span className="text-xs text-mute">{t.code}</span>
                          <span className="font-serif text-2xl tracking-widest">{s.code}</span>
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
              <p className="mt-4 text-sm text-mute">{t.none}</p>
            )}
          </section>

          <section className="mt-10">
            <JoinForm />
          </section>
        </div>

        <div>
          {publicSquads.length ? (
            <section className="mt-12 lg:mt-10">
              <h2 className="font-serif text-3xl">{t.open}</h2>
              <ul className="mt-4 divide-y divide-line border-y border-line">
                {publicSquads.map((s) => (
                  <li key={s.id} className="flex items-start justify-between gap-4 py-4">
                    <div className="min-w-0">
                      <p>{squadName(s, m)}</p>
                      <p className="mt-1 text-xs text-mute">
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

          <section className="mt-12 lg:mt-10">
            <h2 className="font-serif text-3xl">{t.create}</h2>
            <div className="mt-6 rounded-xs border border-line bg-surface p-4">
              {canCreate ? (
                <CreateForm today={todayParis()} maxDay={addDays(todayParis(), 120)} />
              ) : (
                <p className="text-sm">
                  {t.proOnly}{" "}
                  <Link href="/abonnement" className={btnLink}>
                    {t.seePlans}
                  </Link>
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
