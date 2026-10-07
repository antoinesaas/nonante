"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { validateDeclaratif } from "@/app/actions/proofs";
import { ACTION_LABEL, isStrong, PILLAR_LABEL, PROOF_LABEL, proofHref, targetHint } from "@/lib/proofs";
import type { PrincipleView } from "@/lib/types";
import { btnSmall } from "@/lib/ui";

function Check() {
  return (
    <svg viewBox="0 0 20 20" className="size-5 text-ok" aria-hidden="true">
      <path d="M4 10.5l4 4 8-9" pathLength="1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="stroke-draw" />
    </svg>
  );
}

/** Un principe du jour : « si… » en gris, « alors… » en blanc, la valeur, un seul bouton selon la preuve. */
export function TodayPrinciple({ principle, disabled = false }: { principle: PrincipleView; disabled?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [showWhy, setShowWhy] = useState(false);
  const v = principle.validation;
  const href = proofHref(principle.proof_type, principle.id);
  const shown = isStrong(principle.proof_type) ? principle.value : Math.round(principle.value * 0.5);
  const hint = targetHint(principle.proof_type, principle.target);

  return (
    <li className="py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] tracking-[0.2em] text-mute uppercase">{PILLAR_LABEL[principle.pillar]}</p>
          <p className="mt-1.5 text-mute">{principle.if_text},</p>
          <p className="mt-0.5 text-lg leading-snug">{principle.then_text}</p>
          <p className="mt-2 text-xs text-mute">
            {PROOF_LABEL[principle.proof_type]}
            {hint ? ` · ${hint}` : null}
            {principle.why ? (
              <>
                {" · "}
                <button type="button" onClick={() => setShowWhy((s) => !s)} className="underline underline-offset-2 hover:text-paper">
                  pourquoi
                </button>
              </>
            ) : null}
          </p>
          {showWhy && principle.why ? <p className="mt-2 text-sm text-mute">{principle.why}</p> : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {v ? (
            <span className="flex animate-pop items-center gap-1.5 tabular-nums">
              {v.status === "rejected" ? (
                <span className="text-sm text-ko">refusée</span>
              ) : (
                <>
                  <Check />+{v.points}
                </>
              )}
            </span>
          ) : (
            <span className="font-serif text-2xl leading-none tabular-nums">+{shown}</span>
          )}
          {!v && !disabled ? (
            href ? (
              <Link href={href} className={btnSmall}>
                {ACTION_LABEL[principle.proof_type]}
              </Link>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const r = await validateDeclaratif(principle.id);
                    setMessage(r.message);
                  })
                }
                className={btnSmall}
              >
                {pending ? "…" : ACTION_LABEL[principle.proof_type]}
              </button>
            )
          ) : null}
        </div>
      </div>
      {v?.status === "audit_pending" ? <p className="mt-2 text-xs text-mute">Contrôle en cours.</p> : null}
      {message ? (
        <p role="status" className="mt-2 text-sm">
          {message}
        </p>
      ) : null}
    </li>
  );
}
