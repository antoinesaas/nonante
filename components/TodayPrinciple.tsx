"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { validateDeclaratif } from "@/app/actions/proofs";
import { useI18n } from "@/components/I18nProvider";
import { ProofIcon } from "@/components/ProofIcon";
import { bareThen, targetHint } from "@/lib/i18n/labels";
import { isStrong, proofHref } from "@/lib/proofs";
import type { PrincipleView } from "@/lib/types";
import { btnSmall } from "@/lib/ui";

function Check() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true">
      <path d="M4 10.5l4 4 8-9" pathLength="1" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="stroke-draw" />
    </svg>
  );
}

/**
 * Un principe du jour, en carte : pastille du pilier, « alors… » en titre, « si… » dessous, la valeur et un seul bouton
 * selon la preuve. « Fait » répond tout de suite (coche affichée avant la réponse du serveur, retirée en cas de refus).
 * `offDay` : principe prévu un autre jour de la semaine, affiché en retrait avec ses jours.
 */
export function TodayPrinciple({ principle, disabled = false, offDay }: { principle: PrincipleView; disabled?: boolean; offDay?: string }) {
  const { m, locale } = useI18n();
  const t = m.app.today;
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const shown = isStrong(principle.proof_type) ? principle.value : Math.round(principle.value * 0.5);
  const [v, setOptimistic] = useOptimistic(principle.validation);
  const href = proofHref(principle.proof_type, principle.id);
  const hint = targetHint(principle.proof_type, principle.target, m, locale);
  const done = Boolean(v && v.status !== "rejected");
  const title = bareThen(principle.then_text);

  function declare() {
    setMessage(null);
    startTransition(async () => {
      setOptimistic({ status: "valid", strength: "faible", points: shown, proof_type: principle.proof_type });
      const r = await validateDeclaratif(principle.id);
      // Seuls un refus ou un contrôle méritent un message : la coche suffit sinon.
      if (!r.ok || r.audit) setMessage(r.message);
    });
  }

  return (
    <li className={`card p-4 transition-opacity duration-300 ${offDay ? "opacity-55" : ""}`}>
      <div className="flex items-center gap-3.5">
        <ProofIcon proof={principle.proof_type} pillar={principle.pillar} muted={Boolean(offDay)} />
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="min-w-0 flex-1 text-left">
          <p className={`text-[15.5px] leading-snug font-medium ${done ? "text-mute line-through decoration-white/30" : ""}`}>{title.charAt(0).toUpperCase() + title.slice(1)}</p>
          <p className="mt-0.5 truncate text-[13px] text-mute">
            {offDay ?? `${m.game.proof.label[principle.proof_type]}${hint ? ` · ${hint}` : ""}`}
            {!v ? <span className="tabular-nums"> · +{shown}</span> : null}
          </p>
        </button>
        <div className="shrink-0">
          {v ? (
            <span className={`flex animate-pop items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold tabular-nums ${v.status === "rejected" ? "bg-ko/15 text-ko" : "bg-ok/15 text-ok"} ${pending ? "opacity-70" : ""}`}>
              {v.status === "rejected" ? (
                t.refused
              ) : (
                <>
                  <Check />+{v.points}
                </>
              )}
            </span>
          ) : offDay || disabled ? null : href ? (
            <Link href={href} className={btnSmall}>
              {m.game.proof.action[principle.proof_type]}
            </Link>
          ) : (
            <button type="button" disabled={pending} onClick={declare} className={btnSmall}>
              {m.game.proof.action[principle.proof_type]}
            </button>
          )}
        </div>
      </div>
      {open ? (
        <div className="mt-3 animate-in border-t border-line pt-3 text-[13px] leading-relaxed text-mute">
          <p>
            <span className="text-paper/80">{principle.if_text},</span> {principle.then_text}
          </p>
          {principle.why ? <p className="mt-2">{principle.why}</p> : null}
        </div>
      ) : null}
      {v?.status === "audit_pending" ? <p className="mt-2 text-xs text-mute">{t.auditPending}</p> : null}
      {message ? (
        <p role="status" className="mt-2 animate-in text-sm">
          {message}
        </p>
      ) : null}
    </li>
  );
}
