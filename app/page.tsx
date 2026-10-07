import Link from "next/link";
import { ArtBackdrop, ArtBand } from "@/components/Art";
import { DotCalendar, type DayState } from "@/components/DotCalendar";
import { Faq } from "@/components/Faq";
import { Hand } from "@/components/Hand";
import { Logo } from "@/components/Logo";
import { PlayerCard } from "@/components/Player";
import { QuoteCard } from "@/components/QuoteCard";
import { SiteFooter } from "@/components/SiteFooter";
import { SocialProof } from "@/components/SocialProof";
import { IMAGES } from "@/lib/art";
import { getUser } from "@/lib/auth";
import { todayParis } from "@/lib/dates";
import { faqItems } from "@/lib/faq";
import { formatEuros } from "@/lib/money";
import { perDay } from "@/lib/plans";
import { plural } from "@/lib/proofs";
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

const PAINS = [
  "Tu ouvres TikTok « deux minutes » et la soirée est partie.",
  "Tu repousses la tâche qui compte, tous les jours un peu.",
  "Tu bosses ton produit au lieu de parler à des clients.",
  "Tu commences fort le lundi. Le jeudi, plus rien.",
];

const STEPS = [
  { n: "1", title: "Ton objectif", text: "Un chiffre, une date : 3 000 € par mois, 10 clients, ton partiel. Affiché en haut de chaque écran." },
  {
    n: "2",
    title: "Tes principes",
    text: "« Si je m'assois à mon bureau, alors 50 minutes sans téléphone. » Proposés pour ton objectif et tes points faibles, puis modifiables à 100 %.",
  },
  { n: "3", title: "Chaque jour, une preuve", text: "Rien ne se valide sur parole. La caméra compte tes pompes, le minuteur surveille ta concentration." },
  { n: "4", title: "Maxe tes stats", text: "Discipline, Focus, Business, Corps, Esprit, Énergie. Une note globale, des niveaux, un classement." },
];

const PROOFS = [
  { title: "Minuteur", text: "25, 50 ou 90 minutes. Tu quittes l'écran plus de 10 secondes : la session casse." },
  { title: "Caméra", text: "Pompes et squats comptés par l'IA, sur ton téléphone. Aucune image n'en sort." },
  { title: "Réveil", text: "Un code à recopier avant ton heure de lever. Impossible de tricher depuis ton lit." },
  { title: "Photo, capture, lien", text: "La salle, tes messages de prospection, ta publication. Contrôles aléatoires." },
];

const COMPARE = [
  ["Validation", "Une case à cocher", "Une preuve : caméra, minuteur, code"],
  ["Principes", "Les mêmes pour tous", "Construits pour ton objectif"],
  ["Ton business", "Rien", "Prospection, portefeuille de revenus"],
  ["Progression", "Une série", "6 stats, une note, des niveaux"],
  ["Les autres", "Seul", "Classement et escouades"],
];

export default async function Home() {
  const { supabase, user } = await getUser();
  const [{ data: proofData }, { data: plansData }] = await Promise.all([supabase.rpc("social_proof"), supabase.rpc("plans_public")]);
  const proof = proofData as Proof | null;
  const plans = plansData as PublicPlans | null;
  const cta = user ? "/app" : "/onboarding";
  const ctaLabel = user ? "Mon arc" : "Construire mon arc";

  return (
    <>
      <ArtBackdrop slug={IMAGES.hero} tone="medium" className="min-h-dvh">
        <header className="mx-auto flex w-full max-w-xl items-center justify-between px-5 pt-6">
          <Link href="/" aria-label="Nonante, accueil">
            <Logo />
          </Link>
          <Link href={user ? "/app" : "/login"} className="text-sm text-paper/80 hover:text-paper">
            {user ? "Mon arc" : "Connexion"}
          </Link>
        </header>
        <section className="mx-auto mt-auto w-full max-w-xl px-5 pb-16">
          <p className={`${label} animate-rise`}>Pour les jeunes entrepreneurs</p>
          <h1 className="mt-5 animate-rise font-serif text-[3.7rem] leading-[0.92] tracking-tight [animation-delay:100ms] sm:text-7xl">
            Le jeu de la vraie vie.
          </h1>
          <p className="mt-4 animate-rise [animation-delay:200ms]">
            <Hand underline className="text-3xl">
              pas de motivation, de la discipline
            </Hand>
          </p>
          <p className="mt-6 max-w-md animate-rise text-lg leading-relaxed text-paper/85 [animation-delay:300ms]">
            90 jours pour atteindre ton objectif. Des principes construits pour toi, chaque jour une preuve, et des stats de
            joueur à maxer.
          </p>
          <div className="mt-10 animate-rise space-y-3 [animation-delay:400ms]">
            <Link href={cta} className={btnPrimary}>
              {ctaLabel}
            </Link>
            {!user ? <p className="text-center text-xs text-paper/60">2 minutes de questions · tu vois ton arc avant de payer</p> : null}
            <Link href="/classement" className={`${btnSecondary} w-full`}>
              Voir le classement
            </Link>
          </div>
          {proof && proof.joueurs >= 20 ? (
            <p className="mt-6 animate-fade text-sm text-paper/70 [animation-delay:600ms]">
              <span aria-hidden="true" className="mr-2 inline-block size-1.5 animate-breathe rounded-full bg-ok align-middle" />
              {plural(proof.joueurs, "joueur", "joueurs")} · {plural(proof.arcs_en_cours, "arc en cours", "arcs en cours")} en ce moment.
            </p>
          ) : null}
        </section>
      </ArtBackdrop>

      <main className="mx-auto w-full max-w-xl px-5">
        <section className="reveal py-20">
          <h2 className="font-serif text-5xl leading-none">
            Tu sais quoi faire. Tu ne le <Hand className="text-6xl">fais</Hand> pas.
          </h2>
          <ul className="mt-8 space-y-4 text-lg text-paper/85">
            {PAINS.map((p) => (
              <li key={p} className="border-l border-line pl-4">
                {p}
              </li>
            ))}
          </ul>
          <p className="mt-8 text-lg text-mute">
            La motivation ne dure pas. La discipline, si : elle se construit avec des règles précises et des preuves, jour après
            jour.
          </p>
        </section>

        <ArtBand slug="echecs" className="-mx-5 h-72">
          <p className={label}>Comment ça marche</p>
          <h2 className="mt-2 font-serif text-4xl leading-none">Quatre étapes. Quatre-vingt-dix jours.</h2>
        </ArtBand>
        <ol className="reveal mt-8 space-y-8 pb-20">
          {STEPS.map((s) => (
            <li key={s.n} className="flex gap-5">
              <span className="font-serif text-5xl leading-none text-mute">{s.n}</span>
              <div>
                <h3 className="text-lg font-medium">{s.title}</h3>
                <p className="mt-1 text-mute">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <section className="reveal pb-20">
          <p className={label}>Exemple de carte de joueur</p>
          <div className="mt-4">
            <PlayerCard pseudo="exemple" avatarPath={null} stats={EXAMPLE_STATS} art="pluie-nuit" subtitle="jour 23/90" />
          </div>
          <p className="mt-4 text-sm text-mute">
            Six stats calculées sur tes 30 derniers jours. Pour monter ta note, tu ne peux rien négliger. Ta carte se partage en un
            lien.
          </p>
        </section>

        <ArtBand slug={IMAGES.proofs} className="-mx-5 h-64">
          <p className={label}>Les preuves</p>
          <h2 className="mt-2 font-serif text-4xl leading-none">Rien ne se valide sur parole.</h2>
        </ArtBand>
        <dl className="reveal mt-8 divide-y divide-line border-y border-line">
          {PROOFS.map((p) => (
            <div key={p.title} className="py-5">
              <dt className="font-medium">{p.title}</dt>
              <dd className="mt-1 text-mute">{p.text}</dd>
            </div>
          ))}
        </dl>

        <section className="reveal py-20">
          <p className={label}>Exemple : jour 23</p>
          <div className="mt-6">
            <DotCalendar days={EXAMPLE_DAYS} today={22} />
          </div>
          <p className="mt-6 text-mute">
            Un point par jour. Vert : tout est prouvé. Rouge : il manque quelque chose. Blanc : tu n&apos;es pas venu, double
            peine. Un joker, et la journée ne compte pas.
          </p>
        </section>

        <ArtBand slug={IMAGES.wallet} className="-mx-5 h-64">
          <p className={label}>Portefeuille</p>
          <h2 className="mt-2 font-serif text-4xl leading-none">Ton argent, prouvé.</h2>
        </ArtBand>
        <p className="mt-6 pb-20 text-lg text-paper/85">
          Chaque euro gagné grâce à ton projet, avec une capture en preuve. Il fait monter ta stat Business, débloque des
          succès et suit ton objectif de revenu. Ce que tu gagnes, ce n&apos;est pas un lot : c&apos;est ton business.
        </p>

        <ArtBand slug={IMAGES.squads} className="-mx-5 h-64">
          <p className={label}>Classement et escouades</p>
          <h2 className="mt-2 font-serif text-4xl leading-none">Seul on lâche. En escouade, on tient.</h2>
        </ArtBand>
        <p className="mt-6 pb-20 text-lg text-paper/85">
          Le classement de la semaine repart de zéro chaque lundi. Crée ton escouade avec tes associés ou ta promo, et voyez qui
          tient vraiment.
        </p>

        <section className="reveal pb-20">
          <h2 className="font-serif text-4xl leading-none">Pas une app d&apos;habitudes de plus.</h2>
          <table className="mt-8 w-full text-left text-sm">
            <thead className="text-mute">
              <tr className="border-b border-line">
                <th className="py-2 pr-3 font-normal" />
                <th className="py-2 pr-3 font-normal">Ailleurs</th>
                <th className="py-2 font-normal text-paper">Nonante</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map(([k, a, b]) => (
                <tr key={k} className="border-b border-line align-top">
                  <th className="py-3 pr-3 font-normal text-mute">{k}</th>
                  <td className="py-3 pr-3 text-mute">{a}</td>
                  <td className="py-3">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="reveal pb-20">
          <h2 className="font-serif text-4xl leading-none">Pourquoi ça marche.</h2>
          <p className="mt-4 text-mute">Pas de recette miracle : des méthodes étudiées, appliquées tous les jours.</p>
          <div className="mt-10">
            <SocialProof proof={proof} />
          </div>
        </section>

        <ArtBand slug={IMAGES.quote} className="-mx-5 h-auto min-h-64" dark>
          <QuoteCard date={todayParis()} />
        </ArtBand>

        <section className="reveal py-20">
          <h2 className="font-serif text-5xl leading-none">Payer, c&apos;est déjà s&apos;engager.</h2>
          <p className="mt-5 text-lg text-paper/85">
            Pas de version gratuite : un arc gratuit se lâche au premier soir difficile. Tu construis ton arc gratuitement, tu
            vois tes principes, puis tu le lances.
          </p>
          {plans ? (
            <div className="mt-10 border border-paper bg-surface p-6 grain">
              <p className={label}>Arc 90 jours</p>
              <p className="mt-4 flex items-baseline gap-3">
                <span className="font-serif text-7xl leading-none tabular-nums">{formatEuros(plans.arc.once)}</span>
                <Hand className="text-2xl">une fois</Hand>
              </p>
              <p className="mt-3 text-sm text-mute">
                Soit {perDay(plans.arc.once)} par jour. Pas d&apos;abonnement, rien ne se renouvelle tout seul.
              </p>
              <Link href={cta} className={`${btnPrimary} mt-6`}>
                {ctaLabel}
              </Link>
            </div>
          ) : null}
          <Link href="/abonnement" className={`${btnLink} mt-6 inline-block`}>
            Voir aussi Pro et Fondateur
          </Link>
        </section>

        <section className="reveal pb-20">
          <h2 className="font-serif text-4xl leading-none">Questions.</h2>
          <div className="mt-8">
            <Faq items={faqItems(["quoi", "payant", "renouvellement", "preuves", "temps", "installer"])} />
          </div>
          <Link href="/faq" className={`${btnLink} mt-6 inline-block`}>
            Toutes les questions
          </Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
