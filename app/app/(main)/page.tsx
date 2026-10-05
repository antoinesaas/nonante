import Link from "next/link";
import { redirect } from "next/navigation";
import { StakeForm } from "@/app/app/(main)/StakeForm";
import { CalendarInteractive } from "@/components/CalendarInteractive";
import { CopyButton } from "@/components/CopyButton";
import { Countdown } from "@/components/Countdown";
import { CalendarLegend } from "@/components/DotCalendar";
import { Logo } from "@/components/Logo";
import { PrincipleList } from "@/components/PrincipleList";
import { TodayPrinciple } from "@/components/TodayPrinciple";
import { requireUser } from "@/lib/auth";
import { formatDayFr, parisMidnight } from "@/lib/dates";
import { siteUrl } from "@/lib/env";
import { formatEuros } from "@/lib/money";
import { fulfillPass } from "@/lib/payments";
import { plural, points as formatPoints, signed } from "@/lib/proofs";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import type { ChallengeView, Dashboard } from "@/lib/types";
import { btnLink, btnPrimary, label } from "@/lib/ui";

function serverNow(): number {
  return Date.now();
}

function challengeProgress(c: ChallengeView): string {
  const { current, goal } = c.progress;
  switch (c.rule.type) {
    case "session_minutes":
      return `${Math.floor(current / 60)} h ${String(current % 60).padStart(2, "0")} sur ${Math.floor(goal / 60)} h`;
    case "reps":
      return `${current} / ${goal}`;
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

  // Retour de Stripe : on active tout de suite, sans attendre le webhook (idempotent).
  const sessionId = typeof params.session_id === "string" ? params.session_id : null;
  if (params.paid === "1" && sessionId && /^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId) && stripeConfigured()) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(sessionId);
      if (session.client_reference_id === user.id) await fulfillPass(session);
    } catch (e) {
      console.error(`[app] vérification du paiement impossible : ${e instanceof Error ? e.name : "erreur"}`);
    }
  }

  const { data, error } = await supabase.rpc("my_dashboard");
  if (error) throw new Error(`Tableau de bord indisponible (${error.code})`);
  const d = data as Dashboard;

  if (!d.profile || !d.enrollment || !d.cohort) redirect("/onboarding");
  if (d.state === "pending") {
    if (params.paid === "1") {
      return (
        <section className="pt-20">
          <h1 className="font-serif text-5xl leading-none">Paiement en cours.</h1>
          <p className="mt-5 text-mute">Stripe confirme ton paiement. Ça prend quelques secondes.</p>
          <Link href="/app?paid=1" className={`${btnPrimary} mt-10`}>
            Actualiser
          </Link>
        </section>
      );
    }
    redirect("/checkout");
  }
  if (d.level_up) redirect("/app/niveau");
  if ((d.unseen_achievements ?? 0) > 0) redirect("/app/succes");

  const principles = d.principles ?? [];
  const today = principles.filter((p) => p.scheduled_today);
  const notToday = principles.filter((p) => !p.scheduled_today);
  const remaining = today.filter((p) => !p.validation);
  const atStake = remaining.reduce((sum, p) => sum + p.value, 0);
  const running = d.state === "running";
  const referralLink = d.profile.referral_code
    ? `${siteUrl()}/?utm_source=parrainage&utm_campaign=${encodeURIComponent(d.profile.referral_code)}`
    : null;

  return (
    <>
      <header className="flex items-start justify-between gap-6">
        <div>
          <Logo size="sm" />
          <h1 className="mt-8 font-serif text-5xl leading-none">
            {d.day_number ? (
              <>
                Jour {d.day_number} <span className="text-mute">/ 90</span>
              </>
            ) : d.state === "before" ? (
              "Avant le départ"
            ) : (
              "Arc terminé"
            )}
          </h1>
        </div>
        <div className="pt-9 text-right">
          <p className="font-serif text-4xl leading-none tabular-nums">{formatPoints(d.points ?? 0)}</p>
          <p className="mt-1 text-xs text-mute">points</p>
          {d.rank ? (
            <p className="mt-2 text-xs text-mute tabular-nums">
              {d.rank}
              <sup>{d.rank === 1 ? "er" : "e"}</sup> sur {d.total}
            </p>
          ) : null}
        </div>
      </header>

      {params.mise === "1" ? <p className="mt-6 text-sm">Mise enregistrée dès que Stripe confirme le paiement.</p> : null}

      {(d.audits ?? []).map((a) => (
        <Link key={a.id} href={`/app/controle/${a.id}`} className="mt-8 block border border-paper p-4">
          <p className="text-sm">
            Contrôle : envoie une photo de ta preuve{a.label ? ` (${a.label.replace(/^alors /, "").replace(/\.$/, "")})` : ""} avant{" "}
            {new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(a.due_at))}
            . Sinon : {signed(-a.penalty)} points.
          </p>
        </Link>
      ))}

      {d.state === "before" ? (
        <section className="mt-12">
          <p className={label}>{d.cohort.name}</p>
          <p className="mt-3 text-mute">Départ le {formatDayFr(d.cohort.start_date, { weekday: true })}.</p>
          <div className="mt-8">
            <Countdown target={parisMidnight(d.cohort.start_date).getTime()} serverNow={serverNow()} />
          </div>
          <h2 className="mt-14 font-serif text-3xl">Tes principes</h2>
          <div className="mt-6">
            <PrincipleList principles={principles} />
          </div>
          <Link href="/onboarding/principes" className={`${btnLink} mt-4 inline-block`}>
            Ajouter ou retirer ton principe perso
          </Link>
          {process.env.FEATURE_STAKE === "true" && d.enrollment.stake_status === "none" ? (
            <StakeForm amount={formatEuros(Number(process.env.DEFAULT_STAKE_CENTS ?? "3000"))} />
          ) : null}
        </section>
      ) : null}

      {d.calendar ? (
        <section className="mt-12">
          <CalendarInteractive days={d.calendar} />
          <CalendarLegend />
        </section>
      ) : null}

      {running ? (
        <section className="mt-14">
          <div className="flex items-baseline justify-between">
            <h2 className="font-serif text-3xl">Aujourd&apos;hui</h2>
            <p className="text-sm text-mute">
              {remaining.length ? `${plural(remaining.length, "principe", "principes")} · ${atStake} pts en jeu` : "Tout est prouvé."}
            </p>
          </div>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {today.map((p) => (
              <TodayPrinciple key={p.id} principle={p} />
            ))}
          </ul>
          {notToday.length ? (
            <p className="mt-4 text-xs text-mute">
              Pas prévu aujourd&apos;hui : {notToday.map((p) => p.then_text.replace(/^alors /, "")).join(" · ")}
            </p>
          ) : null}
        </section>
      ) : null}

      {running && d.challenge ? (
        <Link href="/app/epreuve" className="mt-10 block border-t border-line pt-6">
          <p className={label}>{d.challenge.kind === "piege" ? "Piège de la semaine" : "Épreuve de la semaine"}</p>
          <p className="mt-2 flex items-baseline justify-between gap-4">
            <span>{d.challenge.title}</span>
            <span className="shrink-0 text-sm text-mute tabular-nums">
              {d.challenge.status === "done" ? "réussie" : d.challenge.status === "failed" ? "ratée" : challengeProgress(d.challenge)}
            </span>
          </p>
        </Link>
      ) : null}

      {d.state === "abandoned" || d.state === "failed" || d.state === "completed" || d.state === "ended" ? (
        <section className="mt-12 border-t border-line pt-8">
          <h2 className="font-serif text-3xl">
            {d.state === "completed" ? "Arc tenu." : d.state === "abandoned" ? "Tu as lâché." : d.state === "failed" ? "Arc raté." : "Arc terminé."}
          </h2>
          <p className="mt-3 text-mute">
            {d.state === "completed"
              ? "90 jours, prouvés."
              : d.state === "abandoned"
                ? "7 jours blancs d'affilée. Ton calendrier reste visible. Le prochain arc t'attend."
                : d.state === "failed"
                  ? "Il fallait 75 jours verts, sans plus de 3 jours non verts d'affilée."
                  : "Le bilan arrive à la clôture de la cohorte."}
          </p>
          {d.enrollment.loyalty_code ? (
            <div className="mt-6 flex items-center justify-between gap-4 border border-line p-4">
              <p className="text-sm">
                −50 % sur ton prochain arc : <span className="font-medium">{d.enrollment.loyalty_code}</span>
              </p>
              <CopyButton value={d.enrollment.loyalty_code} />
            </div>
          ) : null}
          {d.state !== "ended" ? (
            <Link href="/onboarding" className={`${btnPrimary} mt-8`}>
              Rejoindre le prochain arc
            </Link>
          ) : null}
        </section>
      ) : null}

      {referralLink && d.profile.referral_code ? (
        <section className="mt-14 border-t border-line pt-6">
          <p className={label}>Parrainage</p>
          <p className="mt-3 text-sm text-mute">
            Ton code donne −20 % à un ami, à saisir au paiement.{" "}
            {d.profile.referral_sales ? `${plural(d.profile.referral_sales, "inscription", "inscriptions")} grâce à toi.` : null}
          </p>
          <div className="mt-4 flex items-center justify-between gap-4">
            <span className="font-serif text-2xl">{d.profile.referral_code}</span>
            <CopyButton value={`${d.profile.referral_code} · ${referralLink}`} label="Copier" />
          </div>
        </section>
      ) : null}
    </>
  );
}
