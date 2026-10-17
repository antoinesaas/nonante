import Link from "next/link";
import { ActivityRings } from "@/components/ActivityRings";
import { Aura } from "@/components/Aura";
import { DotCalendar, type DayState } from "@/components/DotCalendar";
import { Faq } from "@/components/Faq";
import { Founder } from "@/components/Founder";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Logo } from "@/components/Logo";
import { PlayerCard } from "@/components/Player";
import { ProofIcon } from "@/components/ProofIcon";
import { QuoteCard } from "@/components/QuoteCard";
import { RevealOnScroll } from "@/components/RevealOnScroll";
import { SiteFooter } from "@/components/SiteFooter";
import { SocialProof } from "@/components/SocialProof";
import { getUser } from "@/lib/auth";
import { todayParis } from "@/lib/dates";
import { faqItems } from "@/lib/faq";
import { fmt, formatMoney } from "@/lib/i18n/format";
import { getI18n } from "@/lib/i18n/server";
import type { Pillar, ProofType, PublicPlans, SocialProof as Proof, Stats } from "@/lib/types";
import { btnPrimary, btnSecondary, btnSmall, label } from "@/lib/ui";

// Exemples présentés comme tels (aucun chiffre de joueurs inventé).
const EXAMPLE_DAYS: DayState[] = Array.from("GGGRGGGGGJGGGGGRGGGGGG", (c) =>
  c === "G" ? "green" : c === "R" ? "red" : c === "J" ? "joker" : "white",
);
const EXAMPLE_STATS: Stats = {
  xp: 5120, level: 11, level_floor: 5000, level_next: 6050, ovr: 74, discipline: 86, focus: 81, business: 68,
  corps: 72, esprit: 59, energie: 78, streak: 12, best_streak: 19, green_days: 41, focus_minutes: 2940, reps: 1820,
  wakes: 44, arcs_completed: 0, wallet_proven_cents: 0, wallet_declared_cents: 0,
};
// Une pastille par preuve présentée (minuteur, caméra, réveil, photo).
const PROOF_ICONS: [ProofType, Pillar][] = [
  ["session", "focus"],
  ["reps", "corps"],
  ["reveil", "energie"],
  ["photo", "esprit"],
];
const STEP_GLOW = ["glow-rose", "glow-violet", "glow-sky", "glow-mint"];

/** Conteneur : une colonne sur téléphone, large sur ordinateur. */
const wrap = "mx-auto w-full max-w-xl px-5 lg:max-w-6xl lg:px-8";

export default async function Home() {
  const [{ supabase, user }, { m, locale }] = await Promise.all([getUser(), getI18n()]);
  const [{ data: proofData }, { data: plansData }] = await Promise.all([supabase.rpc("social_proof"), supabase.rpc("plans_public")]);
  const proof = proofData as Proof | null;
  const plans = plansData as PublicPlans | null;
  const l = m.landing;
  const cta = user ? "/app" : "/onboarding";
  const ctaLabel = user ? m.common.actions.myArc : m.common.actions.buildArc;

  return (
    <>
      <div className="relative isolate overflow-x-clip">
        <Aura tone="rose" className="h-[44rem] opacity-60" />
        <header className={`${wrap} flex items-center justify-between pt-[max(1.25rem,env(safe-area-inset-top))]`}>
          <Link href="/" aria-label={m.common.homeAria}>
            <Logo />
          </Link>
          <div className="flex items-center gap-3">
            <LanguageSwitcher className="hidden sm:flex" />
            <Link href={user ? "/app" : "/login"} className={btnSmall}>
              {user ? m.common.actions.myArc : m.common.actions.login}
            </Link>
          </div>
        </header>

        <section className={`${wrap} pt-14 pb-16 lg:grid lg:min-h-[80dvh] lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center lg:gap-16 lg:pb-24`}>
          <div>
            <p className={`${label} animate-in`}>{l.label}</p>
            <h1 className="mt-3 animate-in font-display text-[56px] leading-[0.95] [animation-delay:80ms] sm:text-7xl lg:text-[7rem]">
              {l.title1}
              <br />
              {l.title2}
            </h1>
            <p className="mt-4 animate-in bg-linear-to-r from-rose via-violet to-sky bg-clip-text text-[19px] font-semibold text-transparent [animation-delay:160ms]">{l.hand}</p>
            <p className="mt-4 max-w-md animate-in text-[17px] leading-relaxed text-paper/80 [animation-delay:240ms] lg:text-xl">{l.intro}</p>
            <div className="mt-8 max-w-md animate-in space-y-3 [animation-delay:320ms]">
              <Link href={cta} className={btnPrimary}>
                {ctaLabel}
              </Link>
              {!user ? <p className="text-center text-xs text-paper/60">{l.ctaHint}</p> : null}
              <Link href="/classement" className={`${btnSecondary} w-full`}>
                {m.common.actions.seeLeaderboard}
              </Link>
            </div>
            {proof && proof.joueurs >= 20 ? (
              <p className="mt-6 animate-fade text-sm text-paper/70 [animation-delay:600ms]">
                <span aria-hidden="true" className="mr-2 inline-block size-1.5 animate-breathe rounded-full bg-ok align-middle" />
                {fmt(l.live, { players: proof.joueurs, arcs: proof.arcs_en_cours }, locale)}
              </p>
            ) : null}
          </div>
          <div className="mt-14 grid animate-in place-items-center [animation-delay:400ms] lg:mt-0">
            <div className="relative grid place-items-center">
              <div className="glow-rose absolute size-72 rounded-full opacity-50 blur-3xl" />
              <ActivityRings
                rings={[
                  { value: 0.86, max: 1, tone: "rose" },
                  { value: 0.68, max: 1, tone: "mint" },
                  { value: 0.45, max: 1, tone: "sky" },
                ]}
                size={250}
                stroke={26}
                gap={6}
                label=""
                className="relative"
              />
            </div>
          </div>
        </section>
      </div>

      <main>
        <section className={`${wrap} py-14 lg:grid lg:grid-cols-2 lg:gap-16 lg:py-28`}>
          <div data-reveal>
            <h2 className="font-display text-[38px] leading-[1.02] lg:text-6xl">{l.pains.title}</h2>
            <p className="mt-2 bg-linear-to-r from-rose via-violet to-sky bg-clip-text text-[17px] font-semibold text-transparent">{l.pains.hand}</p>
            <p className="mt-6 hidden text-lg text-mute lg:block">{l.pains.outro}</p>
          </div>
          <div data-reveal>
            <ul className="grouped mt-6 lg:mt-0">
              {l.pains.items.map((p) => (
                <li key={p} className="px-4 py-3.5 text-[15px] text-paper/85">
                  {p}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-[15px] text-mute lg:hidden">{l.pains.outro}</p>
          </div>
        </section>

        <section className={`${wrap} pb-14 lg:pb-28`}>
          <div data-reveal>
            <p className={label}>{l.steps.label}</p>
            <h2 className="mt-1 font-display text-[34px] leading-[1.05] lg:text-6xl">{l.steps.title}</h2>
          </div>
          <ol data-reveal className="mt-6 grid gap-3 lg:grid-cols-4">
            {l.steps.items.map((s, i) => (
              <li key={s.title} className={`${STEP_GLOW[i]} rounded-[1.75rem] p-5`}>
                <span className="font-dot text-[40px] leading-none">{i + 1}</span>
                <h3 className="mt-3 font-display text-[20px]">{s.title}</h3>
                <p className="mt-1 text-sm text-paper/85">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className={`${wrap} grid gap-6 pb-14 lg:grid-cols-2 lg:items-center lg:gap-12 lg:pb-28`}>
          <div data-reveal>
            <p className={label}>{l.card.label}</p>
            <div className="mt-3">
              <PlayerCard pseudo="exemple" avatarPath={null} stats={EXAMPLE_STATS} art={null} subtitle={l.card.subtitle} />
            </div>
            <p className="mt-3 text-sm text-mute">{l.card.text}</p>
          </div>
          <div data-reveal className="card p-5">
            <p className="text-[13px] font-medium text-mute">{l.calendar.label}</p>
            <div className="mt-4">
              <DotCalendar days={EXAMPLE_DAYS} today={22} />
            </div>
            <p className="mt-4 text-sm text-mute">{l.calendar.text}</p>
          </div>
        </section>

        <section className={`${wrap} pb-14 lg:pb-28`}>
          <div data-reveal>
            <p className={label}>{l.proofs.label}</p>
            <h2 className="mt-1 font-display text-[34px] leading-[1.05] lg:text-6xl">{l.proofs.title}</h2>
          </div>
          <dl data-reveal className="mt-6 grid gap-3 lg:grid-cols-4">
            {l.proofs.items.map((p, i) => (
              <div key={p.title} className="card p-5">
                <ProofIcon proof={PROOF_ICONS[i]?.[0] ?? "declaratif"} pillar={PROOF_ICONS[i]?.[1] ?? "focus"} />
                <dt className="mt-4 font-display text-[19px]">{p.title}</dt>
                <dd className="mt-1 text-sm text-mute">{p.text}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className={`${wrap} grid gap-3 pb-14 lg:grid-cols-2 lg:pb-28`}>
          <div data-reveal className="glow-mint rounded-[2rem] p-6">
            <p className="text-[13px] font-medium text-paper/75">{l.wallet.label}</p>
            <h2 className="mt-1 font-display text-[28px] leading-tight">{l.wallet.title}</h2>
            <p className="mt-3 text-[15px] text-paper/85">{l.wallet.text}</p>
          </div>
          <div data-reveal className="glow-sky rounded-[2rem] p-6">
            <p className="text-[13px] font-medium text-paper/75">{l.squads.label}</p>
            <h2 className="mt-1 font-display text-[28px] leading-tight">{l.squads.title}</h2>
            <p className="mt-3 text-[15px] text-paper/85">{l.squads.text}</p>
          </div>
        </section>

        <section data-reveal className={`${wrap} pb-14 lg:grid lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16 lg:pb-28`}>
          <h2 className="font-display text-[34px] leading-[1.05] lg:text-6xl">{l.compare.title}</h2>
          <div className="card mt-6 overflow-hidden lg:mt-0">
            <table className="w-full text-left text-sm lg:text-base">
              <thead className="text-mute">
                <tr className="border-b border-line">
                  <th className="px-4 py-3 font-normal" />
                  <th className="px-2 py-3 font-normal">{l.compare.elsewhere}</th>
                  <th className="px-4 py-3 font-semibold text-paper">Nonante</th>
                </tr>
              </thead>
              <tbody>
                {l.compare.rows.map(([k, a, b]) => (
                  <tr key={k} className="border-b border-line align-top last:border-0">
                    <th className="px-4 py-3 font-normal text-mute">{k}</th>
                    <td className="px-2 py-3 text-mute">{a}</td>
                    <td className="px-4 py-3">{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={`${wrap} pb-14 lg:pb-28`}>
          <div data-reveal className="lg:max-w-2xl">
            <h2 className="font-display text-[34px] leading-[1.05] lg:text-6xl">{l.why.title}</h2>
            <p className="mt-2 text-mute">{l.why.text}</p>
          </div>
          <div data-reveal className="mt-6">
            <SocialProof proof={proof} />
          </div>
        </section>

        <div data-reveal className={`${wrap} pb-14 lg:pb-28`}>
          <Founder />
        </div>

        <div data-reveal className={`${wrap} pb-14 lg:max-w-4xl lg:pb-28`}>
          <QuoteCard date={todayParis()} />
        </div>

        <section className={`${wrap} pb-14 lg:grid lg:grid-cols-2 lg:items-center lg:gap-16 lg:pb-28`}>
          <div data-reveal>
            <h2 className="font-display text-[38px] leading-[1.02] lg:text-6xl">{l.price.title}</h2>
            <p className="mt-3 text-[17px] text-paper/80">{l.price.text}</p>
          </div>
          {plans ? (
            <div data-reveal className="glow-violet mt-6 rounded-[2rem] p-6 lg:mt-0 lg:p-10">
              <p className="text-[13px] font-medium text-paper/75">{m.game.plans.name.arc}</p>
              <p className="mt-3 flex items-baseline gap-3">
                <span className="font-display text-[56px] leading-none tabular-nums">{formatMoney(plans.arc.once, locale)}</span>
                <span className="text-paper/75">{m.game.plans.onceShort}</span>
              </p>
              <p className="mt-2 text-sm text-paper/85">{fmt(l.price.perDay, { price: formatMoney(Math.round(plans.arc.once / 90), locale) })}</p>
              <Link href={cta} className={`${btnPrimary} mt-6`}>
                {ctaLabel}
              </Link>
              <Link href="/abonnement" className="mt-4 block text-center text-sm text-paper/75">
                {l.price.more}
              </Link>
            </div>
          ) : null}
        </section>

        <section className={`${wrap} pb-14 lg:grid lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16 lg:pb-28`}>
          <div data-reveal>
            <h2 className="font-display text-[34px] leading-[1.05] lg:text-6xl">{l.faqTitle}</h2>
            <Link href="/faq" className={`${btnSmall} mt-4 hidden lg:inline-flex`}>
              {m.common.actions.allQuestions}
            </Link>
          </div>
          <div data-reveal className="mt-6 lg:mt-0">
            <Faq items={faqItems(["quoi", "payant", "renouvellement", "parrainage", "preuves", "installer"], m)} />
            <Link href="/faq" className={`${btnSmall} mt-4 lg:hidden`}>
              {m.common.actions.allQuestions}
            </Link>
          </div>
        </section>

        <section className="relative isolate overflow-hidden">
          <Aura tone="violet" className="top-auto bottom-0 h-[30rem] opacity-50 [mask-image:linear-gradient(to_top,#000_30%,transparent)]" />
          <div data-reveal className={`${wrap} py-20 text-center lg:py-32`}>
            <p className="bg-linear-to-r from-rose via-violet to-sky bg-clip-text text-[17px] font-semibold text-transparent">{l.final.hand}</p>
            <h2 className="mx-auto mt-3 max-w-3xl font-display text-[40px] leading-[1.02] lg:text-7xl">{l.final.title}</h2>
            <div className="mx-auto mt-8 max-w-sm">
              <Link href={cta} className={btnPrimary}>
                {ctaLabel}
              </Link>
              {!user ? <p className="mt-3 text-xs text-mute">{l.final.hint}</p> : null}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
      <RevealOnScroll />
    </>
  );
}
