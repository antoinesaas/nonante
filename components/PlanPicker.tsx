"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { type CheckoutState, startCheckout } from "@/app/actions/checkout";
import { Hand } from "@/components/Hand";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";
import { formatEuros } from "@/lib/money";
import { fondateurLeft, monthlyEquivalent, perDay, PLAN_FEATURES, PLAN_NAME, PLAN_PITCH, yearlySaving } from "@/lib/plans";
import type { Interval, PlanId, PublicPlans } from "@/lib/types";
import { btnPrimary, btnSecondary } from "@/lib/ui";

const initial: CheckoutState = { error: null };

/**
 * Trois façons d'agir sur un plan :
 * - « checkout » : connecté, arc construit → paiement Stripe ;
 * - « choose » : questionnaire → le parent enchaîne (compte, puis paiement) ;
 * - « link » : visiteur sur la page des plans → on construit d'abord son arc.
 */
type Mode = { kind: "checkout" } | { kind: "choose"; onChoose: (plan: PlanId, interval: Interval) => void } | { kind: "link" };

function Waiver() {
  return (
    <label className="mt-4 flex items-start gap-3 text-xs text-mute">
      <input type="checkbox" name="waiver" required className="mt-0.5 size-4 shrink-0 accent-paper" />
      <span>
        Je veux commencer tout de suite. Si je me rétracte dans les 14 jours, je paie seulement les jours déjà utilisés.
      </span>
    </label>
  );
}

function CheckoutForm({ plan, interval, cta, primary }: { plan: PlanId; interval: Interval; cta: string; primary: boolean }) {
  const [state, formAction] = useActionState(startCheckout, initial);
  return (
    <form action={formAction} className="mt-6">
      <input type="hidden" name="plan" value={plan} />
      <input type="hidden" name="interval" value={interval} />
      <SubmitButton className={primary ? btnPrimary : `${btnSecondary} w-full`} pendingLabel="Redirection…">
        {cta}
      </SubmitButton>
      <Waiver />
      <FormMessage message={state.error} />
    </form>
  );
}

function Action({ mode, plan, interval, cta, primary }: { mode: Mode; plan: PlanId; interval: Interval; cta: string; primary: boolean }) {
  const className = primary ? `${btnPrimary} mt-6` : `${btnSecondary} mt-6 w-full`;
  if (mode.kind === "checkout") return <CheckoutForm plan={plan} interval={interval} cta={cta} primary={primary} />;
  if (mode.kind === "choose") {
    return (
      <button type="button" onClick={() => mode.onChoose(plan, interval)} className={className}>
        {cta}
      </button>
    );
  }
  return (
    <Link href={`/onboarding?plan=${plan}`} className={className}>
      {cta}
    </Link>
  );
}

function Features({ plan }: { plan: PlanId }) {
  return (
    <ul className="mt-5 space-y-2.5 text-sm">
      {PLAN_FEATURES[plan].map((f) => (
        <li key={f} className="flex gap-3">
          <svg aria-hidden="true" viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0 text-paper">
            <path d="M3 8.5 L6.5 12 L13 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-paper/90">{f}</span>
        </li>
      ))}
    </ul>
  );
}

export function PlanPicker({ plans, current, mode }: { plans: PublicPlans; current: PlanId | null; mode: Mode }) {
  const [proInterval, setProInterval] = useState<"month" | "year">("year");
  const left = fondateurLeft(plans);
  const saving = yearlySaving(plans.pro.month, plans.pro.year);
  const proPrice = proInterval === "month" ? plans.pro.month : plans.pro.year;
  const covered = current === "pro" || current === "fondateur";

  return (
    <div className="space-y-5">
      {/* Arc 90 jours : l'offre principale. */}
      <section className="relative animate-rise border border-paper bg-surface p-5 grain">
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-serif text-3xl leading-none">{PLAN_NAME.arc}</h2>
          <Hand underline className="text-xl">
            recommandé
          </Hand>
        </div>
        <p className="mt-2 text-sm text-mute">{PLAN_PITCH.arc}</p>
        <p className="mt-6 flex items-baseline gap-2">
          <span className="font-serif text-6xl leading-none tabular-nums">{formatEuros(plans.arc.once)}</span>
          <span className="text-mute">une fois</span>
        </p>
        <p className="mt-2 text-xs text-mute">
          soit {perDay(plans.arc.once)} par jour · aucun renouvellement automatique
        </p>
        <Features plan="arc" />
        {current === "arc" ? (
          <p className="mt-6 text-sm">Ton arc est payé. Prouve-le.</p>
        ) : covered ? (
          <p className="mt-6 text-sm text-mute">Ton plan {PLAN_NAME[current]} couvre déjà tous tes arcs.</p>
        ) : (
          <Action mode={mode} plan="arc" interval="once" primary cta={`Lancer mon arc · ${formatEuros(plans.arc.once)}`} />
        )}
      </section>

      {/* Pro : pour enchaîner les arcs. */}
      <section className="animate-rise border border-line p-5 [animation-delay:90ms]">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-serif text-3xl leading-none">{PLAN_NAME.pro}</h2>
          <div className="grid grid-cols-2 border border-line p-0.5 text-xs" role="group" aria-label="Période de paiement">
            {(["month", "year"] as const).map((i) => (
              <button
                key={i}
                type="button"
                aria-pressed={proInterval === i}
                onClick={() => setProInterval(i)}
                className={`h-8 px-3 transition-colors ${proInterval === i ? "bg-paper text-ink" : "text-mute hover:text-paper"}`}
              >
                {i === "month" ? "Mensuel" : `Annuel −${saving} %`}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-2 text-sm text-mute">{PLAN_PITCH.pro}</p>
        <p className="mt-6 flex items-baseline gap-2">
          <span key={proPrice} className="animate-fade font-serif text-5xl leading-none tabular-nums">
            {formatEuros(proPrice)}
          </span>
          <span className="text-mute">/ {proInterval === "month" ? "mois" : "an"}</span>
        </p>
        <p className="mt-2 text-xs text-mute">
          {proInterval === "year"
            ? `soit ${monthlyEquivalent(plans.pro.year)} par mois, arcs illimités · résiliable en un clic`
            : `ou ${formatEuros(plans.pro.year)} par an (−${saving} %) · résiliable en un clic`}
        </p>
        <Features plan="pro" />
        {current === "pro" ? (
          <p className="mt-6 text-sm">C&apos;est ton plan actuel.</p>
        ) : current === "fondateur" ? null : (
          <Action mode={mode} plan="pro" interval={proInterval} primary={false} cta={current ? "Passer Pro" : "Choisir Pro"} />
        )}
      </section>

      {/* Fondateur : rareté réelle (compteur lu en base). */}
      <section className="animate-rise border border-line p-5 [animation-delay:180ms]">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-serif text-3xl leading-none">{PLAN_NAME.fondateur}</h2>
          <span className="text-xs text-mute tabular-nums">
            {left} place{left > 1 ? "s" : ""} restante{left > 1 ? "s" : ""} sur {plans.fondateur.limit}
          </span>
        </div>
        <p className="mt-2 text-sm text-mute">{PLAN_PITCH.fondateur}</p>
        <p className="mt-6 flex items-baseline gap-2">
          <span className="font-serif text-5xl leading-none tabular-nums">{formatEuros(plans.fondateur.lifetime)}</span>
          <span className="text-mute">une fois, à vie</span>
        </p>
        <span className="mt-4 block h-0.5 w-full bg-line" aria-hidden="true">
          <span
            className={`block h-0.5 bg-paper ${["w-0", "w-[10%]", "w-[20%]", "w-[30%]", "w-[40%]", "w-[50%]", "w-[60%]", "w-[70%]", "w-[80%]", "w-[90%]", "w-full"][Math.min(10, Math.floor((plans.fondateur.sold / Math.max(1, plans.fondateur.limit)) * 10))]}`}
          />
        </span>
        <Features plan="fondateur" />
        {current === "fondateur" ? (
          <p className="mt-6 text-sm">Tu es Fondateur.</p>
        ) : left > 0 ? (
          <Action mode={mode} plan="fondateur" interval="lifetime" primary={false} cta="Devenir Fondateur" />
        ) : (
          <p className="mt-6 text-sm text-mute">Les 100 places sont prises.</p>
        )}
      </section>
    </div>
  );
}
