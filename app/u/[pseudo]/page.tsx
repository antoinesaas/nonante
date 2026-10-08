import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportForm } from "@/app/u/[pseudo]/ReportForm";
import { CalendarLegend, DotCalendar } from "@/components/DotCalendar";
import { Logo } from "@/components/Logo";
import { PlayerCard } from "@/components/Player";
import { SiteFooter } from "@/components/SiteFooter";
import { getUser } from "@/lib/auth";
import { fmt, formatDay, formatMoney, formatNumber, formatPoints } from "@/lib/i18n/format";
import { titleFor } from "@/lib/i18n/labels";
import { getI18n } from "@/lib/i18n/server";
import type { PublicProfile } from "@/lib/types";
import { btnPrimary, label } from "@/lib/ui";

async function load(pseudo: string): Promise<PublicProfile | null> {
  if (!/^[a-z0-9_]{3,20}$/.test(pseudo)) return null;
  const { supabase } = await getUser();
  const { data } = await supabase.rpc("public_profile", { p_pseudo: pseudo });
  return (data as PublicProfile | null) ?? null;
}

export async function generateMetadata({ params }: PageProps<"/u/[pseudo]">): Promise<Metadata> {
  const [{ pseudo }, { m }] = await Promise.all([params, getI18n()]);
  const t = m.pages.publicProfile;
  const profile = await load(pseudo);
  if (!profile) return { title: t.fallbackTitle, robots: { index: false } };
  return {
    title: profile.pseudo,
    description:
      fmt(t.description, { level: profile.stats.level, title: titleFor(profile.stats.level, m), ovr: profile.stats.ovr }) +
      (profile.arc?.day_number ? fmt(t.descriptionDay, { n: profile.arc.day_number }) : ""),
  };
}

export default async function PublicProfilePage({ params }: PageProps<"/u/[pseudo]">) {
  const [{ pseudo }, { m, locale }] = await Promise.all([params, getI18n()]);
  const t = m.pages.publicProfile;
  const profile = await load(pseudo);
  if (!profile) notFound();
  const { user } = await getUser();
  const todayIndex = profile.calendar.findIndex((d) => d.status === "today");
  const s = profile.stats;

  return (
    <>
      <main className="mx-auto w-full max-w-xl px-5 pt-6 pb-16 lg:max-w-2xl">
        <Link href="/" aria-label={m.common.homeAria}>
          <Logo size="sm" />
        </Link>

        <div className="mt-8">
          <PlayerCard
            pseudo={profile.pseudo}
            avatarPath={profile.avatar_path}
            stats={s}
            art={profile.art}
            founder={profile.founder}
            subtitle={profile.arc?.day_number ? fmt(t.dayOf, { n: profile.arc.day_number }) : null}
          />
        </div>

        {profile.bio ? <p className="mt-6 text-lg">{profile.bio}</p> : null}
        {profile.arc?.goal ? (
          <div className="mt-6">
            <p className={label}>{m.game.goals[profile.arc.goal_type].label}</p>
            <p className="mt-2 text-lg">{profile.arc.goal}</p>
          </div>
        ) : null}

        <dl className="mt-8 grid grid-cols-3 gap-y-6 border-y border-line py-6">
          <div>
            <dt className="text-xs text-mute">{t.points}</dt>
            <dd className="mt-1 font-serif text-3xl tabular-nums">{formatPoints(profile.points, locale)}</dd>
          </div>
          <div>
            <dt className="text-xs text-mute">{t.rank}</dt>
            <dd className="mt-1 font-serif text-3xl tabular-nums">{profile.rank ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-mute">{t.streak}</dt>
            <dd className="mt-1 font-serif text-3xl tabular-nums">{s.streak}</dd>
          </div>
          <div>
            <dt className="text-xs text-mute">{t.greenDays}</dt>
            <dd className="mt-1 font-serif text-3xl tabular-nums">{s.green_days}</dd>
          </div>
          <div>
            <dt className="text-xs text-mute">{t.focusHours}</dt>
            <dd className="mt-1 font-serif text-3xl tabular-nums">{Math.floor(s.focus_minutes / 60)}</dd>
          </div>
          <div>
            <dt className="text-xs text-mute">{t.reps}</dt>
            <dd className="mt-1 font-serif text-3xl tabular-nums">{formatNumber(s.reps, locale)}</dd>
          </div>
          {profile.wallet_proven_cents !== null ? (
            <div className="col-span-3">
              <dt className="text-xs text-mute">{t.income}</dt>
              <dd className="mt-1 font-serif text-3xl tabular-nums">{formatMoney(profile.wallet_proven_cents, locale)}</dd>
            </div>
          ) : null}
        </dl>

        <p className="mt-4 text-sm text-mute">
          {profile.arc ? fmt(t.arc, { n: profile.arc.number, category: m.game.category[profile.arc.category] }) : ""}
          {fmt(t.arcsDone, { n: s.arcs_completed }, locale)} · {fmt(t.refused, { n: profile.refused_proofs }, locale)} ·{" "}
          {fmt(t.since, { date: formatDay(profile.member_since.slice(0, 10), locale) })}
        </p>

        {profile.calendar.length ? (
          <section className="mt-10">
            <DotCalendar days={profile.calendar.map((d) => d.status)} today={todayIndex >= 0 ? todayIndex : undefined} />
            <CalendarLegend />
          </section>
        ) : null}

        <section className="mt-12">
          <h2 className="font-serif text-3xl">{t.achievements}</h2>
          {profile.achievements.length ? (
            <ul className="mt-4 divide-y divide-line border-y border-line">
              {profile.achievements.map((a) => (
                <li key={a.code} className="py-3">
                  <p>{m.content.achievements[a.code]?.title ?? a.title}</p>
                  <p className="text-xs text-mute">{m.content.achievements[a.code]?.description ?? a.description}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-mute">{t.none}</p>
          )}
        </section>

        {!user ? (
          <Link href="/onboarding" className={`${btnPrimary} mt-12`}>
            {t.createCard}
          </Link>
        ) : null}

        <section className="mt-12 border-t border-line pt-6">
          {user ? (
            <ReportForm pseudo={profile.pseudo} />
          ) : (
            <Link href={`/login?next=/u/${profile.pseudo}`} className="text-sm text-mute underline underline-offset-4">
              {t.report}
            </Link>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
