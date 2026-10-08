"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { type CheckoutState, startCheckout } from "@/app/actions/checkout";
import { Hand } from "@/components/Hand";
import { useI18n } from "@/components/I18nProvider";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";
import { fmt, formatMoney } from "@/lib/i18n/format";
import { fondateurLeft, yearlySaving } from "@/lib/plans";
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
  const { m } = useI18n();
  return (
    <label className="mt-4 flex items-start gap-3 text-xs text-mute">
      <input type="checkbox" name="waiver" required className="mt-0.5 size-4 shrink-0 accent-paper" />
      <span>{m.game.plans.waiver}</span>
    </label>
  );
}

function CheckoutForm({ plan, interval, cta, primary }: { plan: PlanId; interval: Interval; cta: string; primary: boolean }) {
  const { m } = useI18n();
  const [state, formAction] = useActionState(startCheckout, initial);
  return (
    <form action={formAction} className="mt-6">
      <input type="hidden" name="plan" value={plan} />
      <input type="hidden" name="interval" value={interval} />
      <SubmitButton className={primary ? btnPrimary : `${btnSecondary} w-full`} pendingLabel={m.common.actions.redirecting}>
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
  const { m } = useI18n();
  return (
    <ul className="mt-5 space-y-2.5 text-sm">
      {m.game.plans.features[plan].map((f) => (
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
  const { m, locale } = useI18n();
  const p = m.game.plans;
  const money = (cents: number) => formatMoney(cents, locale);
  const [proInterval, setProInterval] = useState<"month" | "year">("year");
  const left = fondateurLeft(plans);
  const saving = yearlySaving(plans.pro.month, plans.pro.year);
  const proPrice = proInterval === "month" ? plans.pro.month : plans.pro.year;
  const covered = current === "pro" || current === "fondateur";

  return (
    <div className="grid gap-5 lg:grid-cols-3 lg:items-start">
      {/* Arc 90 jours : l'offre principale. */}
      <section className="relative animate-rise border border-paper bg-surface p-5 grain">
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-serif text-3xl leading-none">{p.name.arc}</h2>
          <Hand underline className="text-xl">
            {p.recommended}
          </Hand>
        </div>
        <p className="mt-2 text-sm text-mute">{p.pitch.arc}</p>
        <p className="mt-6 flex items-baseline gap-2">
          <span className="font-serif text-6xl leading-none tabular-nums">{money(plans.arc.once)}</span>
          <span className="text-mute">{p.onceShort}</span>
        </p>
        <p className="mt-2 text-xs text-mute">{fmt(p.perDay, { price: money(Math.round(plans.arc.once / 90)) })}</p>
        <Features plan="arc" />
        {current === "arc" ? (
          <p className="mt-6 text-sm">{p.arcPaid}</p>
        ) : covered ? (
          <p className="mt-6 text-sm text-mute">{fmt(p.coveredBy, { plan: p.name[current] })}</p>
        ) : (
          <Action mode={mode} plan="arc" interval="once" primary cta={fmt(p.launch, { price: money(plans.arc.once) })} />
        )}
      </section>

      {/* Pro : pour enchaîner les arcs. */}
      <section className="animate-rise border border-line p-5 [animation-delay:90ms]">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-serif text-3xl leading-none">{p.name.pro}</h2>
          <div className="grid grid-cols-2 border border-line p-0.5 text-xs" role="group" aria-label={p.periodAria}>
            {(["month", "year"] as const).map((i) => (
              <button
                key={i}
                type="button"
                aria-pressed={proInterval === i}
                onClick={() => setProInterval(i)}
                className={`h-8 px-3 transition-colors ${proInterval === i ? "bg-paper text-ink" : "text-mute hover:text-paper"}`}
              >
                {i === "month" ? p.monthly : fmt(p.yearly, { n: saving })}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-2 text-sm text-mute">{p.pitch.pro}</p>
        <p className="mt-6 flex items-baseline gap-2">
          <span key={proPrice} className="animate-fade font-serif text-5xl leading-none tabular-nums">
            {money(proPrice)}
          </span>
          <span className="text-mute">/ {proInterval === "month" ? p.perMonth : p.perYear}</span>
        </p>
        <p className="mt-2 text-xs text-mute">
          {proInterval === "year"
            ? fmt(p.yearNote, { price: money(Math.round(plans.pro.year / 12)) })
            : fmt(p.monthNote, { price: money(plans.pro.year), n: saving })}
        </p>
        <Features plan="pro" />
        {current === "pro" ? (
          <p className="mt-6 text-sm">{p.current}</p>
        ) : current === "fondateur" ? null : (
          <Action mode={mode} plan="pro" interval={proInterval} primary={false} cta={current ? p.switchPro : p.choosePro} />
        )}
      </section>

      {/* Fondateur : rareté réelle (compteur lu en base). */}
      <section className="animate-rise border border-line p-5 [animation-delay:180ms]">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-serif text-3xl leading-none">{p.name.fondateur}</h2>
          <span className="text-right text-xs text-mute tabular-nums">{fmt(p.placesLeft, { n: left, total: plans.fondateur.limit }, locale)}</span>
        </div>
        <p className="mt-2 text-sm text-mute">{p.pitch.fondateur}</p>
        <p className="mt-6 flex items-baseline gap-2">
          <span className="font-serif text-5xl leading-none tabular-nums">{money(plans.fondateur.lifetime)}</span>
          <span className="text-mute">{p.lifetimeNote}</span>
        </p>
        <span className="mt-4 block h-0.5 w-full bg-line" aria-hidden="true">
          <span
            className={`block h-0.5 bg-paper ${["w-0", "w-[10%]", "w-[20%]", "w-[30%]", "w-[40%]", "w-[50%]", "w-[60%]", "w-[70%]", "w-[80%]", "w-[90%]", "w-full"][Math.min(10, Math.floor((plans.fondateur.sold / Math.max(1, plans.fondateur.limit)) * 10))]}`}
          />
        </span>
        <Features plan="fondateur" />
        {current === "fondateur" ? (
          <p className="mt-6 text-sm">{p.isFounder}</p>
        ) : left > 0 ? (
          <Action mode={mode} plan="fondateur" interval="lifetime" primary={false} cta={p.becomeFounder} />
        ) : (
          <p className="mt-6 text-sm text-mute">{p.soldOut}</p>
        )}
      </section>
    </div>
  );
}
