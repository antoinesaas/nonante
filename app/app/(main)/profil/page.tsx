import type { MathMode } from "@/lib/math";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { openBillingPortal } from "@/app/actions/checkout";
import { ProfileCard } from "@/app/app/(main)/profil/ProfileCard";
import { SettingsSheet } from "@/app/app/(main)/profil/SettingsSheet";
import { ReferralRow } from "@/app/app/(main)/ReferralRow";
import { Aura } from "@/components/Aura";
import { getArt } from "@/lib/art";
import { requireUser } from "@/lib/auth";
import { siteUrl } from "@/lib/env";
import { EDITOR } from "@/lib/legal";
import { fmt, formatDay, formatMoney, formatNumber, formatPoints } from "@/lib/i18n/format";
import { nextTitle } from "@/lib/i18n/labels";
import { getI18n } from "@/lib/i18n/server";
import { STAT_KEYS } from "@/lib/stats";
import { ensureReferralCode } from "@/lib/stripe-codes";
import type { AchievementView, MyProfile } from "@/lib/types";
import { btnPrimary, btnSecondary, btnSmall, label, largeTitle, sectionTitle } from "@/lib/ui";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.app.profile.title };
}

/** Succès en médaille : anneau blanc et étoile quand il est débloqué, pointillés sinon. Sobre, une seule couleur. */
function Achievement({ a, title, description, percent, locked }: { a: AchievementView; title: string; description: string; percent: string | null; locked: boolean }) {
  return (
    <li className={`flex flex-col items-center px-1 text-center ${locked ? "opacity-45" : ""}`}>
      <span
        aria-hidden="true"
        className={`relative grid size-16 place-items-center rounded-full ${
          locked ? "border border-dashed border-white/25" : "bg-[radial-gradient(circle_at_50%_35%,#2a2140,#121016)] shadow-[inset_0_0_0_1.5px_rgb(255_255_255/0.55),0_0_24px_rgb(155_107_255/0.25)]"
        }`}
      >
        <svg viewBox="0 0 24 24" className={`size-7 ${locked ? "text-mute" : "text-paper"}`} fill={locked ? "none" : "currentColor"} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
          <path d="M12 3.5 L14.6 8.9 L20.5 9.6 L16.1 13.6 L17.3 19.5 L12 16.6 L6.7 19.5 L7.9 13.6 L3.5 9.6 L9.4 8.9 Z" />
        </svg>
      </span>
      <p className="mt-2 text-[13px] leading-tight font-medium">{title}</p>
      <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-mute">{description}</p>
      <p className="mt-1 text-[11px] text-mute tabular-nums">
        {a.points ? `+${a.points}` : ""}
        {a.points && percent ? " · " : ""}
        {percent}
      </p>
    </li>
  );
}

export default async function ProfilePage({ searchParams }: PageProps<"/app/profil">) {
  const [{ supabase, user }, { m, locale }, params] = await Promise.all([requireUser("/app/profil"), getI18n(), searchParams]);
  const t = m.app.profile;
  const { data } = await supabase.rpc("my_profile");
  const profile = data as MyProfile | null;
  if (!profile) redirect("/onboarding");
  const { data: math } = await supabase.from("profiles").select("math_mode").eq("id", user.id).maybeSingle();

  // Code de parrainage pas encore créé chez Stripe (Stripe indisponible à l'onboarding) : on réessaie.
  if (profile.referral_code && !profile.referral_ready && process.env.STRIPE_SECRET_KEY) {
    try {
      await ensureReferralCode(user.id, profile.referral_code);
    } catch {
      // Sans gravité : nouvel essai à la prochaine visite.
    }
  }

  const s = profile.stats;
  const day = (d: string, year = true) => formatDay(d, locale, { year });
  const ach = (a: AchievementView) => m.content.achievements[a.code] ?? { title: a.title, description: a.description };
  // Succès : ceux débloqués (du plus récent au plus ancien), puis les 3 prochains dans l'ordre du jeu.
  const unlocked = profile.achievements.filter((a) => a.unlocked_at).sort((a, b) => (b.unlocked_at ?? "").localeCompare(a.unlocked_at ?? ""));
  const upcoming = profile.achievements.filter((a) => !a.unlocked_at).slice(0, 3);
  const arts = profile.arts.map((slug) => getArt(slug)).filter((a) => a !== null);
  const next = nextTitle(s.level, m);
  const plan = profile.plan;
  const weakest = [...STAT_KEYS].sort((a, b) => Number(s[a]) - Number(s[b]))[0];
  const percent = (a: AchievementView) => (a.percent !== null ? fmt(t.percent, { n: a.percent }) : null);

  const row = "flex items-center justify-between gap-3 px-4 py-3.5 text-[15px] transition-colors active:bg-white/[0.04]";
  const links: [string, string][] = [
    ["/app/principes", t.principles],
    ["/faq", m.common.footer.faq],
    ["/art", m.common.footer.credits],
    ["/legal/cgu", m.common.footer.terms],
    ["/legal/cgv", m.common.footer.sales],
    ["/legal/confidentialite", m.common.footer.privacy],
  ];

  return (
    <>
      <Aura tone="violet" />
      <div className="mb-5 flex items-center justify-between gap-4 pt-2">
        <h1 className={largeTitle}>{t.title}</h1>
        <SettingsSheet isPublic={profile.is_public} walletPublic={profile.wallet_public} bio={profile.bio} email={profile.email} isAdmin={profile.is_admin} pseudo={profile.pseudo} mathMode={(math?.math_mode ?? "auto") as MathMode} />
      </div>
      <div className="animate-in">
        <ProfileCard
          pseudo={profile.pseudo}
          avatarPath={profile.avatar_path}
          stats={s}
          art={profile.profile_art_slug}
          founder={plan.plan === "fondateur"}
          arts={arts.map((a) => ({ slug: a.slug, title: a.title, artist: a.artist, width: a.width, height: a.height }))}
        />
      </div>
      {profile.is_public ? (
        <Link href={`/u/${profile.pseudo}`} className={`${btnSmall} mt-3`}>
          {t.publicProfile}
        </Link>
      ) : null}

      <div className="lg:grid lg:grid-cols-2 lg:gap-12">
        <section className="mt-8">
          <h2 className={sectionTitle}>{t.stats}</h2>
          <p className="mt-1 text-sm text-mute">
            {next ? fmt(t.nextTitle, { title: next.title, level: next.level }) : t.topTitle}
            {fmt(t.weakest, { stat: m.game.stats[weakest].label.toLowerCase() })}
          </p>
          <dl className="grouped mt-3">
            {STAT_KEYS.map((key) => (
              <div key={key} className="flex items-center justify-between gap-4 px-4 py-3">
                <dt className="min-w-0">
                  <span className="text-[15px]">{m.game.stats[key].label}</span>
                  <span className="block text-[12px] text-mute">{m.game.stats[key].help}</span>
                </dt>
                <dd className="font-display text-[22px] tabular-nums">{s[key]}</dd>
              </div>
            ))}
          </dl>
          <div className="card mt-3 grid grid-cols-3 divide-x divide-white/[0.07] py-4">
            {(
              [
                [t.numbers.points, formatPoints(profile.points, locale)],
                [t.numbers.rank, profile.rank ? `#${formatNumber(profile.rank, locale)}` : "—"],
                [t.numbers.xp, formatNumber(s.xp, locale)],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="px-3 text-center">
                <p className="font-display text-[24px] leading-none tabular-nums">{v}</p>
                <p className="mt-1.5 text-[12px] text-mute">{k}</p>
              </div>
            ))}
          </div>
          <dl className="grouped mt-3">
            {(
              [
                [t.numbers.streak, String(s.streak)],
                [t.numbers.bestStreak, String(s.best_streak)],
                [t.numbers.greenDays, String(s.green_days)],
                [t.numbers.focusHours, String(Math.floor(s.focus_minutes / 60))],
                [t.numbers.reps, formatNumber(s.reps, locale)],
                [t.numbers.wakes, String(s.wakes)],
                [t.numbers.income, formatMoney(s.wallet_proven_cents, locale)],
                [t.numbers.arcsDone, String(s.arcs_completed)],
                [t.numbers.refused, String(profile.refused_proofs)],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4 px-4 py-3">
                <dt className="text-[15px] text-paper/85">{k}</dt>
                <dd className="text-[15px] font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-8">
          <h2 className={sectionTitle}>{t.achievements}</h2>
          <p className="mt-1 text-sm text-mute">
            {fmt(t.achievementsCount, { n: unlocked.length, total: profile.achievements.length })} {t.rarity}
          </p>
          {unlocked.length ? (
            <ul className="card mt-3 grid grid-cols-3 gap-y-5 p-4">
              {unlocked.map((a) => (
                <Achievement key={a.code} a={a} {...ach(a)} percent={percent(a)} locked={false} />
              ))}
            </ul>
          ) : (
            <p className="card mt-3 p-4 text-sm text-mute">{t.noneYet}</p>
          )}
          {upcoming.length ? (
            <>
              <p className={`${label} mt-5 px-1`}>{t.nextUp}</p>
              <ul className="card mt-2 grid grid-cols-3 gap-y-5 p-4">
                {upcoming.map((a) => (
                  <Achievement key={a.code} a={a} {...ach(a)} percent={percent(a)} locked />
                ))}
              </ul>
            </>
          ) : null}
        </section>
      </div>

      {profile.arcs.length ? (
        <section className="mt-8">
          <h2 className={sectionTitle}>{t.arcs}</h2>
          <ul className="grouped mt-3">
            {profile.arcs.map((a) => (
              <li key={a.number} className="px-4 py-3.5">
                <p className="flex justify-between gap-4 text-[15px]">
                  <span>{fmt(t.arcNumber, { n: a.number })}</span>
                  <span className="text-sm text-mute">{t.arcStatus[a.status]}</span>
                </p>
                <p className="mt-0.5 text-sm text-mute">{a.goal_title}</p>
                <p className="mt-0.5 text-[12px] text-mute">
                  {fmt(t.arcLine, { start: day(a.start_date, false), end: day(a.end_date), green: a.green, points: formatPoints(a.points, locale) }, locale)}
                  {a.loyalty_applied ? t.loyaltyApplied : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="lg:grid lg:grid-cols-2 lg:gap-12">
        <section className="card mt-8 p-5">
          <p className="text-[13px] text-mute">{t.plan}</p>
          <p className="mt-0.5 font-display text-[22px]">
            {plan.plan ? m.game.plans.name[plan.plan] : t.noPlan}
            <span className="text-[15px] font-normal text-mute">
              {plan.plan === "arc"
                ? t.planArc
                : plan.interval === "month"
                  ? t.planMonth
                  : plan.interval === "year"
                    ? t.planYear
                    : plan.interval === "lifetime"
                      ? t.planLifetime
                      : ""}
            </span>
          </p>
          <p className="mt-1 text-sm text-mute">
            {plan.comp_until
              ? fmt(t.compUntil, { date: day(plan.comp_until) })
              : plan.plan === "arc"
                ? t.arcOnce
                : plan.cancel_at_period_end && plan.period_end
                  ? fmt(t.cancelled, { date: day(plan.period_end.slice(0, 10)) })
                  : plan.period_end && plan.interval !== "lifetime"
                    ? fmt(t.renews, { date: day(plan.period_end.slice(0, 10)) })
                    : null}
            {plan.status === "past_due" ? t.pastDue : ""}
            {plan.arc_credits > 0 ? fmt(t.credits, { n: plan.arc_credits }, locale) : ""}
            {plan.loyalty_pending ? t.loyalty : ""}
          </p>
          {params.portail === "indisponible" ? <p className="mt-3 text-sm">{t.portalDown}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2.5">
            {profile.has_billing ? (
              <form action={openBillingPortal}>
                <button type="submit" className={btnSecondary}>
                  {plan.paid_plan === "pro" ? t.manageSub : t.invoices}
                </button>
              </form>
            ) : null}
            {plan.plan !== "fondateur" ? (
              <Link href="/abonnement" className={plan.plan ? btnSecondary : btnPrimary}>
                {plan.plan === "arc" ? t.goPro : plan.plan ? t.changePlan : t.choosePlan}
              </Link>
            ) : null}
          </div>
        </section>

        <div className="mt-8 space-y-3">
          {profile.referral_code ? (
            <div className="grouped overflow-hidden">
              <ReferralRow
                code={profile.referral_code}
                link={`${siteUrl()}/?utm_source=parrainage&utm_campaign=${encodeURIComponent(profile.referral_code)}`}
                shareUrl={
                  profile.is_public
                    ? `${siteUrl()}/u/${encodeURIComponent(profile.pseudo)}?utm_source=parrainage&utm_campaign=${encodeURIComponent(profile.referral_code)}`
                    : null
                }
              />
            </div>
          ) : null}
          {profile.referral_code ? (
            <p className="px-1 text-[12px] text-mute">
              {fmt(t.referralSales, { n: profile.referral_sales }, locale)}
              {profile.referral_rewards ? fmt(t.referralRewards, { n: profile.referral_rewards }, locale) : ""}.
            </p>
          ) : null}

          <nav className="grouped overflow-hidden" aria-label={t.links}>
            <a href={`mailto:${EDITOR.email}?subject=${encodeURIComponent(m.common.nav.helpSubject)}`} className={row}>
              <span>{m.common.nav.help}</span>
              <svg viewBox="0 0 16 16" className="size-3.5 shrink-0 text-mute" aria-hidden="true">
                  <path d="M6 3.5 L10.5 8 L6 12.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </a>
            {links.map(([href, text]) => (
              <Link key={href} href={href} className={row}>
                <span>{text}</span>
                <svg viewBox="0 0 16 16" className="size-3.5 shrink-0 text-mute" aria-hidden="true">
                  <path d="M6 3.5 L10.5 8 L6 12.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </>
  );
}
