import Link from "next/link";
import { ArtBackdrop, ArtBand } from "@/components/Art";
import { DotCalendar, type DayState } from "@/components/DotCalendar";
import { Faq } from "@/components/Faq";
import { Founder } from "@/components/Founder";
import { Hand } from "@/components/Hand";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Logo } from "@/components/Logo";
import { PlayerCard } from "@/components/Player";
import { QuoteCard } from "@/components/QuoteCard";
import { RevealOnScroll } from "@/components/RevealOnScroll";
import { SiteFooter } from "@/components/SiteFooter";
import { SocialProof } from "@/components/SocialProof";
import { IMAGES } from "@/lib/art";
import { getUser } from "@/lib/auth";
import { todayParis } from "@/lib/dates";
import { faqItems } from "@/lib/faq";
import { fmt, formatMoney } from "@/lib/i18n/format";
import { getI18n } from "@/lib/i18n/server";
import type { PublicPlans, SocialProof as Proof, Stats } from "@/lib/types";
import { btnLink, btnPrimary, btnSecondary, label } from "@/lib/ui";

// Exemples présentés comme tels (aucun chiffre de joueurs inventé).
const EXAMPLE_DAYS: DayState[] = Array.from("GGGRGGGGGJGGGGGRGGGGGG", (c) =>
  c === "G" ? "green" : c === "R" ? "red" : c === "J" ? "joker" : "white",
);
const EXAMPLE_STATS: Stats = {
  xp: 5120, level: 11, level_floor: 5000, level_next: 6050, ovr: 74, discipline: 86, focus: 81, business: 68,
  corps: 72, esprit: 59, energie: 78, streak: 12, best_streak: 19, green_days: 41, focus_minutes: 2940, reps: 1820,
  wakes: 44, arcs_completed: 0, wallet_proven_cents: 0, wallet_declared_cents: 0,
};

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
      <ArtBackdrop slug={IMAGES.hero} tone="medium" className="min-h-dvh">
        <header className={`${wrap} flex items-center justify-between pt-6`}>
          <Link href="/" aria-label={m.common.homeAria}>
            <Logo />
          </Link>
          <div className="flex items-center gap-4">
            <LanguageSwitcher className="hidden sm:flex" />
            <Link href={user ? "/app" : "/login"} className="text-sm text-paper/80 hover:text-paper">
              {user ? m.common.actions.myArc : m.common.actions.login}
            </Link>
          </div>
        </header>
        <section className={`${wrap} mt-auto pb-16 lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end lg:gap-16 lg:pb-24`}>
          <div>
            <p className={`${label} animate-rise`}>{l.label}</p>
            <h1 className="mt-5 animate-rise font-serif text-[4.2rem] leading-[0.9] tracking-tight [animation-delay:100ms] sm:text-8xl lg:text-[8.5rem]">
              {l.title1}
              <br />
              {l.title2}
            </h1>
            <p className="mt-4 animate-rise [animation-delay:200ms]">
              <Hand underline className="text-3xl lg:text-4xl">
                {l.hand}
              </Hand>
            </p>
            <p className="mt-6 max-w-md animate-rise text-lg leading-relaxed text-paper/85 [animation-delay:300ms] lg:text-xl">{l.intro}</p>
            <div className="mt-10 max-w-md animate-rise space-y-3 [animation-delay:400ms]">
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
          <div className="hidden animate-rise [animation-delay:500ms] lg:block">
            <PlayerCard pseudo="exemple" avatarPath={null} stats={EXAMPLE_STATS} art="pluie-nuit" subtitle={l.card.subtitle} />
          </div>
        </section>
      </ArtBackdrop>

      <main>
        <section className={`${wrap} py-20 lg:grid lg:grid-cols-2 lg:gap-16 lg:py-32`}>
          <div data-reveal>
            <h2 className="font-serif text-5xl leading-none lg:text-7xl">{l.pains.title}</h2>
            <p className="mt-3">
              <Hand className="text-3xl text-mute">{l.pains.hand}</Hand>
            </p>
            <p className="mt-8 hidden text-lg text-mute lg:block">{l.pains.outro}</p>
          </div>
          <div data-reveal>
            <ul className="mt-8 space-y-4 text-lg text-paper/85 lg:mt-0">
              {l.pains.items.map((p) => (
                <li key={p} className="border-l border-line pl-4">
                  {p}
                </li>
              ))}
            </ul>
            <p className="mt-8 text-lg text-mute lg:hidden">{l.pains.outro}</p>
          </div>
        </section>

        <ArtBand slug={IMAGES.pains} className="h-72 lg:h-[28rem]" inner="py-8">
          <div className={`${wrap} w-full`}>
            <p className={label}>{l.steps.label}</p>
            <h2 className="mt-2 font-serif text-4xl leading-none lg:text-6xl">{l.steps.title}</h2>
          </div>
        </ArtBand>
        <ol data-reveal className={`${wrap} mt-8 grid gap-8 pb-20 lg:mt-12 lg:grid-cols-4 lg:pb-32`}>
          {l.steps.items.map((s, i) => (
            <li key={s.title} className="flex gap-5 lg:block">
              <span className="font-serif text-5xl leading-none text-mute">{i + 1}</span>
              <div className="lg:mt-4">
                <h3 className="text-lg font-medium">{s.title}</h3>
                <p className="mt-1 text-mute">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <section className={`${wrap} grid gap-16 pb-20 lg:grid-cols-2 lg:items-center lg:pb-32`}>
          <div data-reveal className="lg:hidden">
            <p className={label}>{l.card.label}</p>
            <div className="mt-4">
              <PlayerCard pseudo="exemple" avatarPath={null} stats={EXAMPLE_STATS} art="pluie-nuit" subtitle={l.card.subtitle} />
            </div>
            <p className="mt-4 text-sm text-mute">{l.card.text}</p>
          </div>
          <div data-reveal>
            <p className={label}>{l.calendar.label}</p>
            <div className="mt-6">
              <DotCalendar days={EXAMPLE_DAYS} today={22} />
            </div>
          </div>
          <div data-reveal>
            <p className="text-mute lg:text-lg">{l.calendar.text}</p>
            <p className="mt-6 hidden text-sm text-mute lg:block">{l.card.text}</p>
          </div>
        </section>

        <ArtBand slug={IMAGES.proofs} className="h-72 lg:h-[30rem]" inner="py-8">
          <div className={`${wrap} w-full`}>
            <p className={label}>{l.proofs.label}</p>
            <h2 className="mt-2 font-serif text-4xl leading-none lg:text-6xl">{l.proofs.title}</h2>
          </div>
        </ArtBand>
        <dl data-reveal className={`${wrap} mt-8 grid divide-y divide-line border-y border-line lg:mt-12 lg:grid-cols-4 lg:divide-x lg:divide-y-0`}>
          {l.proofs.items.map((p) => (
            <div key={p.title} className="py-5 lg:px-6 lg:py-8 lg:first:pl-0">
              <dt className="font-medium">{p.title}</dt>
              <dd className="mt-1 text-mute">{p.text}</dd>
            </div>
          ))}
        </dl>

        <section className={`${wrap} grid gap-0 py-20 lg:grid-cols-2 lg:gap-10 lg:py-32`}>
          <div>
            <ArtBand slug={IMAGES.wallet} className="-mx-5 h-64 lg:mx-0 lg:h-80">
              <p className={label}>{l.wallet.label}</p>
              <h2 className="mt-2 font-serif text-4xl leading-none">{l.wallet.title}</h2>
            </ArtBand>
            <p data-reveal className="mt-6 pb-16 text-lg text-paper/85 lg:pb-0">
              {l.wallet.text}
            </p>
          </div>
          <div>
            <ArtBand slug={IMAGES.squads} className="-mx-5 h-64 lg:mx-0 lg:h-80">
              <p className={label}>{l.squads.label}</p>
              <h2 className="mt-2 font-serif text-4xl leading-none">{l.squads.title}</h2>
            </ArtBand>
            <p data-reveal className="mt-6 text-lg text-paper/85">
              {l.squads.text}
            </p>
          </div>
        </section>

        <section data-reveal className={`${wrap} pb-20 lg:grid lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16 lg:pb-32`}>
          <h2 className="font-serif text-4xl leading-none lg:text-6xl">{l.compare.title}</h2>
          <table className="mt-8 w-full text-left text-sm lg:mt-0 lg:text-base">
            <thead className="text-mute">
              <tr className="border-b border-line">
                <th className="py-2 pr-3 font-normal" />
                <th className="py-2 pr-3 font-normal">{l.compare.elsewhere}</th>
                <th className="py-2 font-normal text-paper">Nonante</th>
              </tr>
            </thead>
            <tbody>
              {l.compare.rows.map(([k, a, b]) => (
                <tr key={k} className="border-b border-line align-top">
                  <th className="py-3 pr-3 font-normal text-mute">{k}</th>
                  <td className="py-3 pr-3 text-mute">{a}</td>
                  <td className="py-3">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <ArtBand slug={IMAGES.mood} className="h-96 lg:h-[34rem]" />

        <section className={`${wrap} py-20 lg:py-32`}>
          <div data-reveal className="lg:max-w-2xl">
            <h2 className="font-serif text-4xl leading-none lg:text-6xl">{l.why.title}</h2>
            <p className="mt-4 text-mute">{l.why.text}</p>
          </div>
          <div data-reveal className="mt-10">
            <SocialProof proof={proof} />
          </div>
        </section>

        <div data-reveal className={`${wrap} pb-20 lg:pb-32`}>
          <Founder />
        </div>

        <ArtBand slug={IMAGES.quote} className="h-auto min-h-64 lg:min-h-80" dark inner="py-12">
          <div className={`${wrap} w-full lg:max-w-4xl`}>
            <QuoteCard date={todayParis()} className="lg:[&_blockquote]:text-4xl" />
          </div>
        </ArtBand>

        <section className={`${wrap} py-20 lg:grid lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-32`}>
          <div data-reveal>
            <h2 className="font-serif text-5xl leading-none lg:text-7xl">{l.price.title}</h2>
            <p className="mt-5 text-lg text-paper/85">{l.price.text}</p>
            <Link href="/abonnement" className={`${btnLink} mt-6 hidden lg:inline-block`}>
              {l.price.more}
            </Link>
          </div>
          {plans ? (
            <div data-reveal className="mt-10 border border-paper bg-surface p-6 grain lg:mt-0 lg:p-10">
              <p className={label}>{m.game.plans.name.arc}</p>
              <p className="mt-4 flex items-baseline gap-3">
                <span className="font-serif text-7xl leading-none tabular-nums">{formatMoney(plans.arc.once, locale)}</span>
                <Hand className="text-2xl">{m.game.plans.onceShort}</Hand>
              </p>
              <p className="mt-3 text-sm text-mute">{fmt(l.price.perDay, { price: formatMoney(Math.round(plans.arc.once / 90), locale) })}</p>
              <Link href={cta} className={`${btnPrimary} mt-6`}>
                {ctaLabel}
              </Link>
            </div>
          ) : null}
          <Link href="/abonnement" className={`${btnLink} mt-6 inline-block lg:hidden`}>
            {l.price.more}
          </Link>
        </section>

        <section className={`${wrap} pb-20 lg:grid lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16 lg:pb-32`}>
          <div data-reveal>
            <h2 className="font-serif text-4xl leading-none lg:text-6xl">{l.faqTitle}</h2>
            <Link href="/faq" className={`${btnLink} mt-6 hidden lg:inline-block`}>
              {m.common.actions.allQuestions}
            </Link>
          </div>
          <div data-reveal className="mt-8 lg:mt-0">
            <Faq items={faqItems(["quoi", "payant", "renouvellement", "parrainage", "preuves", "installer"], m)} />
            <Link href="/faq" className={`${btnLink} mt-6 inline-block lg:hidden`}>
              {m.common.actions.allQuestions}
            </Link>
          </div>
        </section>

        <section className="relative overflow-hidden border-t border-line grain">
          <div data-reveal className={`${wrap} py-24 text-center lg:py-36`}>
            <Hand className="text-3xl text-mute">{l.final.hand}</Hand>
            <h2 className="mx-auto mt-4 max-w-3xl font-serif text-5xl leading-[0.95] lg:text-7xl">{l.final.title}</h2>
            <div className="mx-auto mt-10 max-w-sm">
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
