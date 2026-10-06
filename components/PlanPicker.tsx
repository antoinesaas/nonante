"use client";

import { useActionState, useState } from "react";
import { type CheckoutState, startCheckout } from "@/app/actions/checkout";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";
import { formatEuros } from "@/lib/money";
import { fondateurLeft, monthlyEquivalent, PLAN_FEATURES, PLAN_NAME, PLAN_PITCH, yearlySaving } from "@/lib/plans";
import type { PlanId, PublicPlans } from "@/lib/types";
import { btnPrimary, btnSecondary } from "@/lib/ui";

const initial: CheckoutState = { error: null };

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

function PlanForm({ plan, interval, cta, primary }: { plan: PlanId; interval: "month" | "year" | "lifetime"; cta: string; primary: boolean }) {
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

function Features({ plan }: { plan: PlanId }) {
  return (
    <ul className="mt-5 space-y-2 text-sm">
      {PLAN_FEATURES[plan].map((f) => (
        <li key={f} className="flex gap-3">
          <span aria-hidden="true" className="mt-2 block size-1 shrink-0 rounded-full bg-paper" />
          {f}
        </li>
      ))}
    </ul>
  );
}

export function PlanPicker({ plans, current }: { plans: PublicPlans; current: PlanId | null }) {
  const [interval, setPeriod] = useState<"month" | "year">("year");
  const left = fondateurLeft(plans);
  const saving = Math.max(yearlySaving(plans.essentiel.month, plans.essentiel.year), yearlySaving(plans.pro.month, plans.pro.year));

  return (
    <div>
      <div className="grid grid-cols-2 border border-line p-1" role="group" aria-label="Période de paiement">
        {(["month", "year"] as const).map((i) => (
          <button
            key={i}
            type="button"
            aria-pressed={interval === i}
            onClick={() => setPeriod(i)}
            className={`h-10 text-sm ${interval === i ? "bg-paper text-ink" : "text-mute hover:text-paper"}`}
          >
            {i === "month" ? "Mensuel" : `Annuel · jusqu'à −${saving} %`}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-5">
        {(["pro", "essentiel"] as const).map((plan) => {
          const month = plans[plan].month;
          const year = plans[plan].year;
          const price = interval === "month" ? month : year;
          return (
            <section key={plan} className={`border p-5 ${plan === "pro" ? "border-paper" : "border-line"}`}>
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="font-serif text-3xl">{PLAN_NAME[plan]}</h2>
                {plan === "pro" ? <span className="text-[10px] tracking-[0.2em] uppercase">Le plus choisi</span> : null}
              </div>
              <p className="mt-1 text-sm text-mute">{PLAN_PITCH[plan]}</p>
              <p className="mt-5">
                <span className="font-serif text-5xl leading-none tabular-nums">{formatEuros(price)}</span>
                <span className="text-mute"> / {interval === "month" ? "mois" : "an"}</span>
              </p>
              <p className="mt-1 text-xs text-mute">
                {interval === "year"
                  ? `soit ${monthlyEquivalent(year)} par mois · −${yearlySaving(month, year)} % par rapport au mensuel`
                  : `ou ${formatEuros(year)} par an (−${yearlySaving(month, year)} %)`}
              </p>
              <Features plan={plan} />
              {current === plan ? (
                <p className="mt-6 text-sm">C&apos;est ton plan actuel.</p>
              ) : (
                <PlanForm
                  plan={plan}
                  interval={interval}
                  primary={plan === "pro"}
                  cta={current ? `Passer à ${PLAN_NAME[plan]}` : `Lancer mon arc avec ${PLAN_NAME[plan]}`}
                />
              )}
            </section>
          );
        })}

        <section className="border border-line p-5">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-serif text-3xl">{PLAN_NAME.fondateur}</h2>
            <span className="text-xs text-mute tabular-nums">
              {left} place{left > 1 ? "s" : ""} restante{left > 1 ? "s" : ""} sur {plans.fondateur.limit}
            </span>
          </div>
          <p className="mt-1 text-sm text-mute">{PLAN_PITCH.fondateur}</p>
          <p className="mt-5">
            <span className="font-serif text-5xl leading-none tabular-nums">{formatEuros(plans.fondateur.lifetime)}</span>
            <span className="text-mute"> une fois</span>
          </p>
          <Features plan="fondateur" />
          {current === "fondateur" ? (
            <p className="mt-6 text-sm">Tu es Fondateur.</p>
          ) : left > 0 ? (
            <PlanForm plan="fondateur" interval="lifetime" primary={false} cta="Devenir Fondateur" />
          ) : (
            <p className="mt-6 text-sm text-mute">Toutes les places sont prises.</p>
          )}
        </section>
      </div>
    </div>
  );
}
