import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { openBillingPortal } from "@/app/actions/checkout";
import { DeleteAccountForm } from "@/app/app/(main)/profil/DeleteAccountForm";
import { InstallHint } from "@/app/app/(main)/profil/InstallHint";
import { ProfileCard } from "@/app/app/(main)/profil/ProfileCard";
import { PushToggle } from "@/app/app/(main)/profil/PushToggle";
import { SettingsForm } from "@/app/app/(main)/profil/SettingsForm";
import { CopyButton } from "@/components/CopyButton";
import { getArt } from "@/lib/art";
import { requireUser } from "@/lib/auth";
import { siteUrl } from "@/lib/env";
import { fmt, formatDay, formatMoney, formatNumber, formatPoints } from "@/lib/i18n/format";
import { nextTitle } from "@/lib/i18n/labels";
import { getI18n } from "@/lib/i18n/server";
import { STAT_KEYS } from "@/lib/stats";
import { ensureReferralCode } from "@/lib/stripe-codes";
import type { AchievementView, MyProfile } from "@/lib/types";
import { btnLink, btnPrimary, btnSecondary, label } from "@/lib/ui";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.app.profile.title };
}

function Achievement({ a, title, description, percent, locked }: { a: AchievementView; title: string; description: string; percent: string | null; locked: boolean }) {
  return (
    <li className={`flex items-start justify-between gap-4 py-4 ${locked ? "text-mute" : ""}`}>
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border ${locked ? "border-line border-dashed" : "border-paper bg-paper text-ink"}`}>
          {locked ? null : (
            <svg viewBox="0 0 16 16" className="size-3.5">
              <path d="M3 8.5 L6.5 12 L13 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        <div>
          <p className={locked ? "" : "text-paper"}>{title}</p>
          <p className="mt-1 text-xs text-mute">{description}</p>
        </div>
      </div>
      <div className="shrink-0 text-right text-xs">
        {a.points ? <p className="tabular-nums">+{a.points}</p> : null}
        {percent ? <p className="mt-1 text-mute">{percent}</p> : null}
      </div>
    </li>
  );
}

export default async function ProfilePage({ searchParams }: PageProps<"/app/profil">) {
  const [{ supabase, user }, { m, locale }, params] = await Promise.all([requireUser("/app/profil"), getI18n(), searchParams]);
  const t = m.app.profile;
  const { data } = await supabase.rpc("my_profile");
  const profile = data as MyProfile | null;
  if (!profile) redirect("/onboarding");

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

  return (
    <>
      <ProfileCard
        pseudo={profile.pseudo}
        avatarPath={profile.avatar_path}
        stats={s}
        art={profile.profile_art_slug}
        founder={plan.plan === "fondateur"}
        arts={arts.map((a) => ({ slug: a.slug, title: a.title, artist: a.artist, width: a.width, height: a.height }))}
      />
      {profile.is_public ? (
        <Link href={`/u/${profile.pseudo}`} className={`${btnLink} mt-2 inline-block`}>
          {t.publicProfile}
        </Link>
      ) : null}

      <div className="lg:grid lg:grid-cols-2 lg:gap-12">
        <section className="mt-10">
          <h2 className="font-serif text-3xl">{t.stats}</h2>
          <p className="mt-2 text-sm text-mute">
            {next ? fmt(t.nextTitle, { title: next.title, level: next.level }) : t.topTitle}
            {fmt(t.weakest, { stat: m.game.stats[weakest].label.toLowerCase() })}
          </p>
          <dl className="mt-6 divide-y divide-line border-y border-line">
            {STAT_KEYS.map((key) => (
              <div key={key} className="flex items-baseline justify-between gap-4 py-3">
                <dt>
                  {m.game.stats[key].label}
                  <span className="block text-xs text-mute">{m.game.stats[key].help}</span>
                </dt>
                <dd className="font-serif text-3xl tabular-nums">{s[key]}</dd>
              </div>
            ))}
          </dl>
          <dl className="mt-8 grid grid-cols-3 gap-y-6">
            {(
              [
                [t.numbers.points, formatPoints(profile.points, locale)],
                [t.numbers.rank, profile.rank ? formatNumber(profile.rank, locale) : "—"],
                [t.numbers.xp, formatNumber(s.xp, locale)],
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
              <div key={k}>
                <dt className="text-xs text-mute">{k}</dt>
                <dd className="mt-1 font-serif text-2xl tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-12 lg:mt-10">
          <h2 className="font-serif text-3xl">{t.achievements}</h2>
          <p className="mt-2 text-sm text-mute">
            {fmt(t.achievementsCount, { n: unlocked.length, total: profile.achievements.length })} {t.rarity}
          </p>
          {unlocked.length ? (
            <ul className="mt-6 divide-y divide-line border-y border-line">
              {unlocked.map((a) => (
                <Achievement key={a.code} a={a} {...ach(a)} percent={percent(a)} locked={false} />
              ))}
            </ul>
          ) : (
            <p className="mt-6 border-y border-line py-4 text-sm text-mute">{t.noneYet}</p>
          )}
          {upcoming.length ? (
            <>
              <p className={`${label} mt-8`}>{t.nextUp}</p>
              <ul className="mt-3 divide-y divide-line border-y border-line">
                {upcoming.map((a) => (
                  <Achievement key={a.code} a={a} {...ach(a)} percent={percent(a)} locked />
                ))}
              </ul>
            </>
          ) : null}
        </section>
      </div>

      {profile.arcs.length ? (
        <section className="mt-12">
          <h2 className="font-serif text-3xl">{t.arcs}</h2>
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {profile.arcs.map((a) => (
              <li key={a.number} className="py-4">
                <p className="flex justify-between gap-4">
                  <span>{fmt(t.arcNumber, { n: a.number })}</span>
                  <span className="text-sm text-mute">{t.arcStatus[a.status]}</span>
                </p>
                <p className="mt-1 text-sm text-mute">{a.goal_title}</p>
                <p className="mt-1 text-xs text-mute">
                  {fmt(t.arcLine, { start: day(a.start_date, false), end: day(a.end_date), green: a.green, points: formatPoints(a.points, locale) }, locale)}
                  {a.loyalty_applied ? t.loyaltyApplied : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="lg:grid lg:grid-cols-2 lg:gap-12">
        <section className="mt-12">
          <h2 className="font-serif text-3xl">{t.plan}</h2>
          <p className="mt-3">
            {plan.plan ? m.game.plans.name[plan.plan] : t.noPlan}
            {plan.plan === "arc"
              ? t.planArc
              : plan.interval === "month"
                ? t.planMonth
                : plan.interval === "year"
                  ? t.planYear
                  : plan.interval === "lifetime"
                    ? t.planLifetime
                    : ""}
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
          <div className="mt-5 flex flex-wrap gap-3">
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

        {profile.referral_code ? (
          <section className="mt-12">
            <h2 className="font-serif text-3xl">{t.referral}</h2>
            <p className="mt-2 text-sm text-mute">
              {t.referralText} {fmt(t.referralSales, { n: profile.referral_sales }, locale)}
              {profile.referral_rewards ? fmt(t.referralRewards, { n: profile.referral_rewards }, locale) : ""}.
            </p>
            <div className="mt-4 flex items-center justify-between gap-4">
              <span className="font-serif text-2xl">{profile.referral_code}</span>
              <CopyButton value={`${profile.referral_code} · ${siteUrl()}/?utm_source=parrainage&utm_campaign=${encodeURIComponent(profile.referral_code)}`} />
            </div>
          </section>
        ) : null}
      </div>

      <div className="lg:grid lg:grid-cols-2 lg:gap-12">
        <section className="mt-12">
          <h2 className="font-serif text-3xl">{t.settings}</h2>
          <SettingsForm isPublic={profile.is_public} emailReminders={profile.email_reminders} walletPublic={profile.wallet_public} bio={profile.bio} />
        </section>

        <div>
          <section className="mt-12">
            <h2 className="font-serif text-3xl">{t.notifications}</h2>
            <p className="mt-2 text-sm text-mute">{t.notificationsText}</p>
            <PushToggle subscribed={profile.push_subscriptions > 0} publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />
            <InstallHint />
          </section>

          <section className="mt-12">
            <h2 className="font-serif text-3xl">{t.data}</h2>
            <p className="mt-2 text-sm text-mute">{fmt(t.connectedAs, { email: profile.email })}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a href="/api/me/export" className={btnSecondary}>
                {t.export}
              </a>
              <form action="/auth/signout" method="post">
                <button type="submit" className={btnSecondary}>
                  {t.signOut}
                </button>
              </form>
              {profile.is_admin ? (
                <Link href="/admin" className={btnSecondary}>
                  {t.admin}
                </Link>
              ) : null}
            </div>
            <DeleteAccountForm pseudo={profile.pseudo} />
          </section>
        </div>
      </div>

      <p className="mt-12 text-xs text-mute">
        <span className={label}>{t.links}</span>{" "}
        <Link href="/app/principes" className="underline underline-offset-4">
          {t.principles}
        </Link>{" "}
        ·{" "}
        <Link href="/art" className="underline underline-offset-4">
          {m.common.footer.credits}
        </Link>{" "}
        ·{" "}
        <Link href="/faq" className="underline underline-offset-4">
          {m.common.footer.faq}
        </Link>{" "}
        ·{" "}
        <Link href="/legal/cgu" className="underline underline-offset-4">
          {m.common.footer.terms}
        </Link>{" "}
        ·{" "}
        <Link href="/legal/cgv" className="underline underline-offset-4">
          {m.common.footer.sales}
        </Link>{" "}
        ·{" "}
        <Link href="/legal/confidentialite" className="underline underline-offset-4">
          {m.common.footer.privacy}
        </Link>
      </p>
    </>
  );
}
