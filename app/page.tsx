import Link from "next/link";
import { CheckoutForm } from "@/components/CheckoutForm";
import { Countdown } from "@/components/Countdown";
import { Dot, DotCalendar, type DayState } from "@/components/DotCalendar";
import { Logo } from "@/components/Logo";
import { Ordinals } from "@/components/Ordinals";
import { SiteFooter } from "@/components/SiteFooter";
import { WaitlistForm } from "@/components/WaitlistForm";
import { getUser } from "@/lib/auth";
import { currentPrice, getCohortSignups, getNextOpenCohort, type PublicCohort } from "@/lib/cohorts";
import { formatDayFr, parisMidnight } from "@/lib/dates";
import { formatEuros } from "@/lib/money";

// Calendrier d'exemple, présenté comme tel : 22 jours écoulés, aujourd'hui = jour 23.
const EXAMPLE_DAYS: DayState[] = Array.from("GGGRGGGGGWGGGGGRGGGGGG", (c) =>
  c === "G" ? "green" : c === "R" ? "red" : "white",
);

const LEGEND: { state: DayState; label: string; detail: string }[] = [
  { state: "green", label: "Vert", detail: "tous tes principes du jour sont prouvés." },
  { state: "red", label: "Rouge", detail: "il en manque au moins un." },
  { state: "white", label: "Blanc", detail: "tu n'es pas venu. Double peine." },
  { state: "future", label: "Contour", detail: "à venir." },
];

const PROOFS = [
  { title: "Travail", text: "Un minuteur. Si tu quittes l'écran, la session casse." },
  { title: "Sport", text: "Tes pompes sont comptées à la caméra, sur ton téléphone. Aucune image n'en sort." },
  { title: "Le reste", text: "Une photo prise dans l'app ou un lien. Un contrôle peut tomber à tout moment." },
];

function serverNow(): number {
  return Date.now();
}

export default async function Home() {
  const [cohort, { user }] = await Promise.all([getNextOpenCohort(), getUser()]);
  const signups = cohort ? await getCohortSignups(cohort.id) : null;
  const joinHref = user ? "/app" : "/login?next=/onboarding";

  return (
    <>
      <header className="mx-auto flex w-full max-w-xl items-center justify-between px-5 pt-6">
        <Link href="/" aria-label="Nonante, accueil">
          <Logo />
        </Link>
        <Link href={user ? "/app" : "/login"} className="text-sm text-mute hover:text-paper">
          {user ? "Mon arc" : "Connexion"}
        </Link>
      </header>

      <main className="mx-auto w-full max-w-xl px-5">
        <section className="pt-16 pb-16 sm:pt-24">
          <p className="text-xs tracking-[0.2em] text-mute uppercase">Arc de 90 jours</p>
          <h1 className="mt-6 font-serif text-[3.6rem] leading-[0.95] tracking-tight sm:text-7xl">
            Tiens 90 jours.
            <br />
            Prouve-le.
          </h1>
          <p className="mt-7 max-w-md text-lg leading-relaxed text-mute">
            Pour les étudiants qui mènent leurs études et leur business de front. Un objectif, une
            date, des principes imposés. Rien ne se valide sans preuve.
          </p>
          <Link
            href={cohort ? "#rejoindre" : joinHref}
            className="mt-9 inline-flex h-14 items-center rounded-xs bg-paper px-7 text-base font-medium text-ink transition-opacity hover:opacity-90"
          >
            Rejoindre l&apos;arc
          </Link>
        </section>

        {cohort && signups !== null ? (
          <CohortOffer cohort={cohort} signups={signups} joinHref={joinHref} />
        ) : (
          <NoOpenCohort />
        )}

        <section className="border-t border-line py-16">
          <h2 className="font-serif text-4xl leading-tight">90 jours. 90 points.</h2>
          <p className="mt-3 text-mute">Chaque jour devient un point. Il est jugé à minuit, heure de Paris.</p>
          <div className="mt-10">
            <DotCalendar days={EXAMPLE_DAYS} today={EXAMPLE_DAYS.length} />
            <p className="mt-5 text-xs text-mute">Exemple : jour 23 sur 90.</p>
          </div>
          <ul className="mt-8 space-y-3 text-sm">
            {LEGEND.map((item) => (
              <li key={item.state} className="flex items-center gap-3">
                <Dot state={item.state} />
                <span>
                  {item.label} <span className="text-mute">: {item.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-t border-line py-16">
          <h2 className="font-serif text-4xl leading-tight">Rien ne se valide sans preuve.</h2>
          <ol className="mt-8 space-y-6">
            {PROOFS.map((proof) => (
              <li key={proof.title} className="grid grid-cols-[6rem_1fr] gap-4">
                <span className="text-sm text-mute">{proof.title}</span>
                <span>{proof.text}</span>
              </li>
            ))}
          </ol>
          <p className="mt-10 text-sm text-mute">Preuve forte : 100&nbsp;% des points. Preuve faible : 50&nbsp;%.</p>
        </section>

        <section className="border-t border-line py-16">
          <h2 className="font-serif text-4xl leading-tight">Un classement.</h2>
          <p className="mt-5 leading-relaxed">
            Tu gagnes des points en prouvant, tu en perds en ratant, tu en perds davantage en
            disparaissant. Le classement de la semaine repart de zéro chaque lundi.
          </p>
          <p className="mt-4 leading-relaxed text-mute">
            Une épreuve par semaine, des succès à débloquer, et des œuvres d&apos;art pour ton profil.
          </p>
        </section>

        {cohort ? (
          <section className="border-t border-line py-20">
            <p className="font-serif text-4xl leading-tight">
              <Ordinals>{`Le ${formatDayFr(cohort.start_date, { year: false })}, tout le monde part de zéro.`}</Ordinals>
            </p>
            <Link
              href={joinHref}
              className="mt-8 inline-flex h-14 items-center rounded-xs border border-paper px-7 text-base text-paper transition-colors hover:bg-paper hover:text-ink"
            >
              Rejoindre l&apos;arc
            </Link>
          </section>
        ) : null}
      </main>

      <SiteFooter />
    </>
  );
}

function CohortOffer({ cohort, signups, joinHref }: { cohort: PublicCohort; signups: number; joinHref: string }) {
  const price = currentPrice(cohort);

  return (
    <section id="rejoindre" className="scroll-mt-6 border-t border-line py-16">
      <p className="text-xs tracking-[0.2em] text-mute uppercase">Prochain départ</p>
      <h2 className="mt-4 font-serif text-5xl leading-none">
        <Ordinals>{cohort.name}</Ordinals>
      </h2>
      <p className="mt-3 text-mute">
        Du {formatDayFr(cohort.start_date, { year: false })} au {formatDayFr(cohort.end_date)}.
      </p>

      <div className="mt-10">
        <Countdown target={parisMidnight(cohort.start_date).getTime()} serverNow={serverNow()} />
      </div>

      <p className="mt-8 text-paper">
        {signups === 0
          ? "Aucun inscrit pour l'instant."
          : `${signups.toLocaleString("fr-FR")} inscrit${signups > 1 ? "s" : ""}.`}{" "}
        <span className="text-mute">Chiffre exact, mis à jour en direct.</span>
      </p>

      <div className="mt-10 border-t border-line pt-10">
        <div className="flex items-baseline gap-4">
          <span className="font-serif text-6xl leading-none">{formatEuros(price.cents)}</span>
          {price.early && cohort.price_cents > price.cents ? (
            <span className="text-xl text-mute line-through">{formatEuros(cohort.price_cents)}</span>
          ) : null}
        </div>
        <p className="mt-3 text-sm text-mute">
          {price.early ? "Prix early bird jusqu'au départ. " : null}
          Paiement unique, pas d&apos;abonnement.
        </p>
        <Link
          href={joinHref}
          className="mt-8 inline-flex h-14 w-full items-center justify-center rounded-xs bg-paper px-6 text-base font-medium text-ink transition-opacity hover:opacity-90"
        >
          Rejoindre l&apos;arc
        </Link>
        <p className="mt-3 text-xs text-mute">
          Six questions, tes principes, puis le paiement. Sécurisé par Stripe, codes promo acceptés.
        </p>
      </div>

      <details className="group mt-10">
        <summary className="cursor-pointer list-none text-sm text-mute hover:text-paper [&::-webkit-details-marker]:hidden">
          Pressé ? <span className="underline underline-offset-4">Réserve ta place maintenant, crée ton compte plus tard.</span>
        </summary>
        <div className="mt-5">
          <CheckoutForm cohortId={cohort.id} label={`Réserver pour ${formatEuros(price.cents)}`} />
          <p className="mt-3 text-xs text-mute">Ta place sera rattachée au compte créé avec la même adresse email.</p>
        </div>
      </details>

      <details className="group mt-6">
        <summary className="cursor-pointer list-none text-sm text-mute hover:text-paper [&::-webkit-details-marker]:hidden">
          Pas encore prêt&nbsp;? <span className="underline underline-offset-4">Reçois un rappel avant le départ.</span>
        </summary>
        <div className="mt-5">
          <WaitlistForm cohortId={cohort.id} cta="Me prévenir" />
        </div>
      </details>
    </section>
  );
}

function NoOpenCohort() {
  return (
    <section id="rejoindre" className="scroll-mt-6 border-t border-line py-16">
      <p className="text-xs tracking-[0.2em] text-mute uppercase">Prochain arc</p>
      <h2 className="mt-4 font-serif text-4xl leading-tight">Aucun arc ouvert pour l&apos;instant.</h2>
      <p className="mt-3 text-mute">Laisse ton email : tu seras prévenu à l&apos;ouverture.</p>
      <div className="mt-8">
        <WaitlistForm cohortId={null} cta="Me prévenir" />
      </div>
    </section>
  );
}
