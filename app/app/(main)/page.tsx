import Link from "next/link";
import { redirect } from "next/navigation";
import { JokerButton, StartTodayButton } from "@/app/app/(main)/DayActions";
import { ArtBand } from "@/components/Art";
import { CalendarInteractive } from "@/components/CalendarInteractive";
import { CopyButton } from "@/components/CopyButton";
import { Countdown } from "@/components/Countdown";
import { CalendarLegend } from "@/components/DotCalendar";
import { Avatar, StatGrid, XpBar } from "@/components/Player";
import { QuoteCard } from "@/components/QuoteCard";
import { TodayPrinciple } from "@/components/TodayPrinciple";
import { IMAGES } from "@/lib/art";
import { requireUser } from "@/lib/auth";
import { formatDayFr, parisMidnight } from "@/lib/dates";
import { siteUrl } from "@/lib/env";
import { formatEuros } from "@/lib/money";
import { fulfillCheckout } from "@/lib/payments";
import { bareThen, GOAL_LABEL, plural, points as formatPoints, signed } from "@/lib/proofs";
import { titleFor } from "@/lib/rules";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import type { ChallengeView, Dashboard } from "@/lib/types";
import { btnLink, btnPrimary, btnSmall, label } from "@/lib/ui";

function serverNow(): number {
  return Date.now();
}

function challengeProgress(c: ChallengeView): string {
  const { current, goal } = c.progress;
  switch (c.rule.type) {
    case "session_minutes":
      return `${Math.floor(current / 60)} h ${String(current % 60).padStart(2, "0")} sur ${Math.floor(goal / 60)} h`;
    case "declaratif":
    case "photo":
    case "green_day":
    case "wake":
      return current >= goal ? "prouvé" : "à prouver";
    default:
      return `${current} / ${goal}`;
  }
}

export default async function DashboardPage({ searchParams }: PageProps<"/app">) {
  const { supabase, user } = await requireUser("/app");
  const params = await searchParams;

  // Retour de Stripe : on synchronise tout de suite, sans attendre le webhook (idempotent).
  const sessionId = typeof params.session_id === "string" ? params.session_id : null;
  if (params.paid === "1" && sessionId && /^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId) && stripeConfigured()) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(sessionId);
      if (session.client_reference_id === user.id) await fulfillCheckout(session);
    } catch (e) {
      console.error(`[app] vérification du paiement impossible : ${e instanceof Error ? e.name : "erreur"}`);
    }
  }

  const { data, error } = await supabase.rpc("my_dashboard");
  if (error) throw new Error(`Tableau de bord indisponible (${error.code})`);
  const d = data as Dashboard;

  if (!d.profile || !d.enrollment || d.state === "none") redirect("/onboarding");
  if (d.level_up) redirect("/app/niveau");
  if ((d.unseen_achievements ?? 0) > 0) redirect("/app/succes");

  const e = d.enrollment;
  const stats = d.stats!;
  const plan = d.plan!;
  const principles = d.principles ?? [];
  const remaining = principles.filter((p) => !p.validation);
  const atStake = remaining.reduce((sum, p) => sum + (["session", "reps", "reveil"].includes(p.proof_type) ? p.value : Math.round(p.value / 2)), 0);
  const running = d.state === "running";
  const jokersLeft = Math.max(0, e.jokers_total - e.jokers_used);
  const referralLink = d.profile.referral_code
    ? `${siteUrl()}/?utm_source=parrainage&utm_campaign=${encodeURIComponent(d.profile.referral_code)}`
    : null;
  const revenueGoal = e.goal_type === "revenu" && e.goal_target ? e.goal_target * 100 : null;

  return (
    <>
      {/* Joueur */}
      <header className="flex items-center gap-4">
        <Link href="/app/profil" aria-label="Mon profil">
          <Avatar path={d.profile.avatar_path} pseudo={d.profile.pseudo} size={52} className="size-13" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-2xl leading-none">{d.profile.pseudo}</p>
          <p className="mt-1 text-xs text-mute">
            Niv. {stats.level} · {titleFor(stats.level)} · note {stats.ovr}
          </p>
        </div>
        <div className="text-right">
          <p className="font-serif text-3xl leading-none tabular-nums">{formatPoints(d.week_points ?? 0)}</p>
          <p className="mt-1 text-[11px] text-mute">
            {d.rank ? (
              <>
                {d.rank}
                <sup>{d.rank === 1 ? "er" : "e"}</sup> sur {d.total} cette semaine
              </>
            ) : (
              "points cette semaine"
            )}
          </p>
        </div>
      </header>
      <div className="mt-4">
        <XpBar stats={stats} />
      </div>

      {params.paid === "1" && plan.plan ? (
        <p role="status" className="mt-6 border border-paper p-4 text-sm">
          Paiement confirmé. Ton arc est lancé. Prouve-le.
        </p>
      ) : params.paid === "1" ? (
        <div className="mt-6 border border-line p-4 text-sm">
          Stripe confirme ton paiement, ça prend quelques secondes.{" "}
          <Link href="/app?paid=1" className={btnLink}>
            Actualiser
          </Link>
        </div>
      ) : null}

      {d.state === "locked" ? (
        <div className="mt-6 border border-paper p-4">
          <p className="text-sm">
            Ton abonnement est inactif : ton arc continue, mais plus rien ne se valide. Chaque jour devient blanc.
          </p>
          <Link href="/abonnement" className={`${btnSmall} mt-3`}>
            Réactiver
          </Link>
        </div>
      ) : null}

      {(d.audits ?? []).map((a) => (
        <Link key={a.id} href={`/app/controle/${a.id}`} className="mt-6 block border border-paper p-4">
          <p className="text-sm">
            Contrôle : envoie une photo de ta preuve{a.label ? ` (${bareThen(a.label)})` : ""} avant{" "}
            {new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(a.due_at))}
            . Sinon : {signed(-a.penalty)} points.
          </p>
        </Link>
      ))}

      {d.running_session ? (
        <Link
          href={
            d.running_session.principle_id
              ? `/app/${d.running_session.kind}/${d.running_session.principle_id}`
              : `/app/${d.running_session.kind}/${d.running_session.assignment_id}?epreuve=1`
          }
          className="mt-6 block border border-paper p-4 text-sm"
        >
          Une session est en cours. Reprends-la.
        </Link>
      ) : null}

      {/* L'arc */}
      <section className="mt-10">
        <p className={label}>
          Arc n° {e.arc_number} · {GOAL_LABEL[e.goal_type]}
        </p>
        <h1 className="mt-3 font-serif text-6xl leading-none">
          {d.day_number ? (
            <>
              Jour {d.day_number} <span className="text-mute">/ 90</span>
            </>
          ) : d.state === "draft" ? (
            "Arc prêt."
          ) : d.state === "before" ? (
            "Avant le jour 1."
          ) : d.state === "ended" ? (
            e.status === "completed" ? "Arc tenu." : e.status === "abandoned" ? "Tu as lâché." : "Arc terminé."
          ) : (
            "Clôture en cours."
          )}
        </h1>
        <p className="mt-4 text-lg leading-snug">{e.goal_title}</p>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-mute">
          <span>
            Série : <span className="text-paper tabular-nums">{plural(stats.streak, "jour", "jours")}</span>
          </span>
          <span>
            Points de l&apos;arc : <span className="text-paper tabular-nums">{formatPoints(d.points ?? 0)}</span>
          </span>
          {e.jokers_total ? (
            <span>
              Jokers : <span className="text-paper tabular-nums">{jokersLeft}</span> / {e.jokers_total}
            </span>
          ) : null}
        </div>
        {revenueGoal && plan.limits.wallet ? (
          <Link href="/app/portefeuille" className="mt-5 block">
            <p className="flex justify-between text-xs text-mute">
              <span>Ce mois : {formatEuros(d.wallet_month_cents ?? 0)}</span>
              <span>objectif {formatEuros(revenueGoal)}</span>
            </p>
            <span className="mt-1.5 block h-1 w-full bg-line">
              <span
                className={`block h-1 bg-paper ${["w-0", "w-[10%]", "w-[20%]", "w-[30%]", "w-[40%]", "w-[50%]", "w-[60%]", "w-[70%]", "w-[80%]", "w-[90%]", "w-full"][Math.min(10, Math.floor(((d.wallet_month_cents ?? 0) / revenueGoal) * 10))]}`}
              />
            </span>
          </Link>
        ) : null}
      </section>

      {d.state === "draft" ? (
        <section className="mt-8 border border-paper p-5">
          <p className="font-serif text-2xl leading-tight">Ton arc est construit. Il ne manque que toi.</p>
          <p className="mt-2 text-sm text-mute">
            Jour 1 prévu le {formatDayFr(e.start_date, { weekday: true })}. Il démarre dès que ton abonnement est actif.
          </p>
          <Link href="/abonnement" className={`${btnPrimary} mt-5`}>
            Choisir mon plan
          </Link>
          <Link href="/app/principes" className={`${btnLink} mt-4 inline-block`}>
            Revoir mes principes
          </Link>
        </section>
      ) : null}

      {d.state === "before" ? (
        <section className="mt-8">
          <p className="text-mute">Jour 1 le {formatDayFr(e.start_date, { weekday: true })}.</p>
          <div className="mt-6">
            <Countdown target={parisMidnight(e.start_date).getTime()} serverNow={serverNow()} />
          </div>
          <div className="mt-8">
            <StartTodayButton today={d.today!} />
          </div>
        </section>
      ) : null}

      <ArtBand slug={IMAGES.quote} className="-mx-5 mt-10 h-auto min-h-56" dark>
        <QuoteCard date={d.today!} />
      </ArtBand>

      {/* Calendrier */}
      {d.calendar?.length ? (
        <section className="mt-10">
          <CalendarInteractive days={d.calendar} />
          <CalendarLegend />
        </section>
      ) : null}

      {/* Aujourd'hui */}
      <section className="mt-12">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-serif text-3xl">{running || d.state === "locked" ? "Aujourd'hui" : "Tes principes"}</h2>
          <Link href="/app/principes" className={btnLink}>
            Modifier
          </Link>
        </div>
        {running ? (
          <p className="mt-1 text-sm text-mute">
            {d.joker_today
              ? "Joker posé : aujourd'hui ne compte pas."
              : remaining.length
                ? `${plural(remaining.length, "principe", "principes")} à prouver · ${atStake} points en jeu`
                : principles.length
                  ? "Tout est prouvé. Journée verte."
                  : "Rien de prévu aujourd'hui."}
          </p>
        ) : null}
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {principles.map((p) => (
            <TodayPrinciple key={p.id} principle={p} disabled={!running} />
          ))}
          {!principles.length ? <li className="py-5 text-sm text-mute">Aucun principe prévu ce jour-là.</li> : null}
        </ul>
        {running && !d.joker_today && jokersLeft > 0 && remaining.length ? (
          <div className="mt-4">
            <JokerButton left={jokersLeft} />
          </div>
        ) : null}
      </section>

      {running && d.challenge ? (
        <Link href="/app/quete" className="mt-10 block border border-line p-4">
          <p className={label}>{d.challenge.kind === "piege" ? "Piège de la semaine" : `Quête de la semaine ${d.challenge.week}`}</p>
          <p className="mt-2 flex items-baseline justify-between gap-4">
            <span>{d.challenge.title}</span>
            <span className="shrink-0 text-sm text-mute tabular-nums">
              {d.challenge.status === "done" ? "réussie" : d.challenge.status === "failed" ? "ratée" : challengeProgress(d.challenge)}
            </span>
          </p>
          <p className="mt-1 text-xs text-mute">
            {signed(d.challenge.points_done)} si réussie · {signed(d.challenge.points_failed)} sinon
          </p>
        </Link>
      ) : null}

      {/* Stats */}
      <Link href="/app/profil" className="mt-10 block border border-line p-4">
        <div className="flex items-baseline justify-between">
          <p className={label}>Tes stats · 30 jours</p>
          <p className="font-serif text-3xl leading-none tabular-nums">{stats.ovr}</p>
        </div>
        <div className="mt-4">
          <StatGrid stats={stats} compact />
        </div>
        <p className="mt-4 text-xs text-mute">Pour maxer ta note, il faut tout travailler : chaque pilier compte autant.</p>
      </Link>

      {d.state === "ended" ? (
        <section className="mt-10 border-t border-line pt-8">
          <p className="text-mute">
            {e.status === "completed"
              ? "90 jours, prouvés. Ta prochaine facture est à −50 %."
              : e.status === "abandoned"
                ? "7 jours blancs d'affilée. Ton calendrier reste visible. Le prochain arc commence quand tu veux."
                : "Il fallait 75 jours verts, sans plus de 3 jours non verts d'affilée. On recommence ?"}
          </p>
          <Link href="/onboarding" className={`${btnPrimary} mt-6`}>
            Construire mon prochain arc
          </Link>
        </section>
      ) : null}

      <nav className="mt-10 grid grid-cols-2 gap-3 text-sm" aria-label="Raccourcis">
        <Link href="/app/escouades" className="border border-line p-4 hover:border-mute">
          Escouades
          <span className="mt-1 block text-xs text-mute">Ton classement entre proches</span>
        </Link>
        <Link href="/app/avant-apres" className="border border-line p-4 hover:border-mute">
          Avant / après
          <span className="mt-1 block text-xs text-mute">Ta photo du jour 1, verrouillée</span>
        </Link>
      </nav>

      {referralLink && d.profile.referral_code ? (
        <section className="mt-10 border-t border-line pt-6">
          <p className={label}>Parrainage</p>
          <p className="mt-3 text-sm text-mute">−20 % pour ton ami sur son premier paiement, 5 € de crédit pour toi.</p>
          <div className="mt-4 flex items-center justify-between gap-4">
            <span className="font-serif text-2xl">{d.profile.referral_code}</span>
            <CopyButton value={`${d.profile.referral_code} · ${referralLink}`} label="Copier" />
          </div>
        </section>
      ) : null}
    </>
  );
}
