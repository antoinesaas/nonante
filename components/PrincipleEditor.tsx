"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { addTemplate, removePrinciple, savePrinciple } from "@/app/actions/principles";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";
import { idle } from "@/lib/errors";
import {
  DAY_SHORT,
  daysLabel,
  isStrong,
  LINK_DOMAINS,
  PILLAR_LABEL,
  PILLARS,
  PROOF_HELP,
  PROOF_LABEL,
  targetHint,
  timeFr,
} from "@/lib/proofs";
import type { EditablePrinciple, Pillar, ProofType, TemplateView } from "@/lib/types";
import { btnLink, btnPrimary, btnSmall, input, label } from "@/lib/ui";

const PROOFS: ProofType[] = ["session", "reps", "reveil", "photo", "capture", "lien", "declaratif"];
const TIMES = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`);

/** Points affichés : difficulté calculée comme sur le serveur, preuve faible à 50 %. */
function estimate(proof: ProofType, minutes: number, reps: number, exercise: string, wake: string, difficulty: number): { difficulty: number; points: number } {
  let d = Math.min(Math.max(difficulty, 1), 2);
  if (proof === "session") d = minutes <= 25 ? 1 : minutes <= 50 ? 2 : 3;
  if (proof === "reps") d = exercise === "squat" ? (reps <= 25 ? 1 : reps <= 60 ? 2 : 3) : reps <= 15 ? 1 : reps <= 40 ? 2 : 3;
  if (proof === "reveil") d = wake >= "07:30" ? 1 : wake >= "06:30" ? 2 : 3;
  return { difficulty: d, points: isStrong(proof) ? 10 * d : 5 * d };
}

function stripIf(text: string) {
  return text.replace(/^(si |s'il |s')/i, (m) => (m.toLowerCase() === "s'il " ? "il " : "")).replace(/,$/, "");
}

export function PrincipleForm({ principle, onDone }: { principle?: EditablePrinciple; onDone?: () => void }) {
  const [state, formAction] = useActionState(savePrinciple, idle);
  const [pillar, setPillar] = useState<Pillar>(principle?.pillar ?? "focus");
  const [proof, setProof] = useState<ProofType>(principle?.proof_type ?? "declaratif");
  const [days, setDays] = useState<number[]>(principle?.days ?? [1, 2, 3, 4, 5, 6, 7]);
  const [minutes, setMinutes] = useState(principle?.target.minutes ?? 50);
  const [reps, setReps] = useState(principle?.target.reps ?? 20);
  const [exercise, setExercise] = useState(principle?.target.exercise ?? "pushup");
  const [wake, setWake] = useState(principle?.target.before && principle.proof_type === "reveil" ? principle.target.before : "07:00");
  const [difficulty, setDifficulty] = useState(principle && !isStrong(principle.proof_type) ? principle.difficulty : 1);
  const est = estimate(proof, minutes, reps, exercise, wake, difficulty);

  useEffect(() => {
    if (state.ok) onDone?.();
  }, [state, onDone]);

  return (
    <form action={formAction} className="space-y-5">
      {principle ? <input type="hidden" name="id" value={principle.id} /> : null}
      <input type="hidden" name="pillar" value={pillar} />
      <input type="hidden" name="proofType" value={proof} />
      <input type="hidden" name="difficulty" value={difficulty} />
      {days.map((d) => (
        <input key={d} type="hidden" name="days" value={d} />
      ))}

      <div>
        <p className={label}>Pilier</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {PILLARS.map((p) => (
            <button
              key={p.value}
              type="button"
              aria-pressed={pillar === p.value}
              onClick={() => setPillar(p.value)}
              className={`h-9 rounded-xs border px-3 text-sm ${pillar === p.value ? "border-paper bg-paper text-ink" : "border-line text-mute hover:text-paper"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className={label}>Si…</span>
        <input name="ifText" defaultValue={principle ? stripIf(principle.if_text) : ""} placeholder="je m'assois à mon bureau" maxLength={110} className={`${input} mt-2`} />
      </label>
      <label className="block">
        <span className={label}>alors…</span>
        <input
          name="thenText"
          defaultValue={principle ? principle.then_text.replace(/^alors /, "").replace(/\.$/, "") : ""}
          placeholder="50 minutes sans téléphone"
          maxLength={150}
          className={`${input} mt-2`}
        />
      </label>

      <div>
        <p className={label}>Preuve</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {PROOFS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={proof === p}
              onClick={() => setProof(p)}
              className={`h-10 rounded-xs border px-3 text-left text-sm ${proof === p ? "border-paper bg-paper text-ink" : "border-line text-paper hover:border-mute"}`}
            >
              {PROOF_LABEL[p]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-mute">{PROOF_HELP[proof]}</p>
      </div>

      {proof === "session" ? (
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={label}>Durée</span>
            <select name="minutes" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className={`${input} mt-2`}>
              <option value={25}>25 min</option>
              <option value={50}>50 min</option>
              <option value={90}>90 min</option>
            </select>
          </label>
          <label className="block">
            <span className={label}>Finie avant</span>
            <select name="before" defaultValue={principle?.target.before ?? ""} className={`${input} mt-2`}>
              <option value="">Pas de limite</option>
              {TIMES.filter((t) => t >= "06:00").map((t) => (
                <option key={t} value={t}>
                  {timeFr(t)}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {proof === "reps" ? (
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={label}>Exercice</span>
            <select name="exercise" value={exercise} onChange={(e) => setExercise(e.target.value as "pushup" | "squat")} className={`${input} mt-2`}>
              <option value="pushup">Pompes</option>
              <option value="squat">Squats</option>
            </select>
          </label>
          <label className="block">
            <span className={label}>Répétitions</span>
            <input name="reps" type="number" min={5} max={300} value={reps} onChange={(e) => setReps(Number(e.target.value))} className={`${input} mt-2`} />
          </label>
        </div>
      ) : null}

      {proof === "reveil" ? (
        <label className="block">
          <span className={label}>Debout avant</span>
          <select name="wake" value={wake} onChange={(e) => setWake(e.target.value)} className={`${input} mt-2`}>
            {TIMES.filter((t) => t >= "04:00" && t <= "10:00").map((t) => (
              <option key={t} value={t}>
                {timeFr(t)}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {proof === "photo" ? (
        <label className="block">
          <span className={label}>À partir de (facultatif)</span>
          <select name="after" defaultValue={principle?.target.after ?? ""} className={`${input} mt-2`}>
            <option value="">N&apos;importe quand</option>
            {TIMES.map((t) => (
              <option key={t} value={t}>
                {timeFr(t)}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {proof === "lien" ? (
        <fieldset>
          <legend className={label}>Sites acceptés (aucun coché : tous)</legend>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {LINK_DOMAINS.map((d) => (
              <label key={d} className="flex items-center gap-2">
                <input type="checkbox" name="domains" value={d} defaultChecked={principle?.target.domains?.includes(d)} className="size-4 accent-paper" />
                {d}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {["capture", "declaratif", "photo", "lien"].includes(proof) ? (
        <div className="grid grid-cols-[1fr_8rem] gap-3">
          <label className="block">
            <span className={label}>Objectif chiffré (facultatif)</span>
            <input name="count" inputMode="numeric" defaultValue={principle?.target.count ?? ""} placeholder="20" className={`${input} mt-2`} />
          </label>
          <label className="block">
            <span className={label}>Unité</span>
            <input name="unit" defaultValue={principle?.target.unit ?? ""} placeholder="messages" maxLength={20} className={`${input} mt-2`} />
          </label>
        </div>
      ) : null}

      {!isStrong(proof) ? (
        <div>
          <p className={label}>Difficulté</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {[1, 2].map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={difficulty === d}
                onClick={() => setDifficulty(d)}
                className={`h-10 rounded-xs border text-sm ${difficulty === d ? "border-paper bg-paper text-ink" : "border-line text-paper"}`}
              >
                {d === 1 ? "Normale" : "Exigeante"}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <p className={label}>Jours</p>
        <div className="mt-2 grid grid-cols-7 gap-1.5">
          {DAY_SHORT.map((d, i) => {
            const day = i + 1;
            const on = days.includes(day);
            return (
              <button
                key={day}
                type="button"
                aria-pressed={on}
                aria-label={["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"][i]}
                onClick={() => setDays((list) => (on ? list.filter((x) => x !== day) : [...list, day].sort()))}
                className={`h-10 rounded-xs border text-sm ${on ? "border-paper bg-paper text-ink" : "border-line text-mute"}`}
              >
                {d}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-mute">{days.length ? daysLabel(days) : "Aucun jour"}</p>
      </div>

      <p className="text-sm text-mute">
        Difficulté {est.difficulty} · <span className="text-paper">+{est.points} points</span> par jour prouvé, − {10 * est.difficulty} si raté.
      </p>

      <SubmitButton className={btnPrimary} pendingLabel="Enregistrement…">
        {principle ? "Enregistrer" : "Ajouter ce principe"}
      </SubmitButton>
      <FormMessage message={state.message} ok={state.ok} />
    </form>
  );
}

export function PrincipleRow({ principle, editable }: { principle: EditablePrinciple; editable: boolean }) {
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const hint = targetHint(principle.proof_type, principle.target);
  const shown = isStrong(principle.proof_type) ? principle.value : Math.round(principle.value / 2);

  return (
    <li className="py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] tracking-[0.2em] text-mute uppercase">
            {PILLAR_LABEL[principle.pillar]}
            {principle.pending ? " · dès demain" : ""}
          </p>
          <p className="mt-1.5 text-mute">{principle.if_text},</p>
          <p className="mt-0.5 text-lg leading-snug">{principle.then_text}</p>
          <p className="mt-2 text-xs text-mute">
            {PROOF_LABEL[principle.proof_type]}
            {hint ? ` · ${hint}` : ""} · {daysLabel(principle.days)}
          </p>
          {principle.why ? <p className="mt-2 text-sm text-mute">{principle.why}</p> : null}
        </div>
        <span className="shrink-0 font-serif text-2xl leading-none tabular-nums">+{shown}</span>
      </div>
      {editable ? (
        <div className="mt-3 flex gap-5">
          <button type="button" onClick={() => setEditing((e) => !e)} className={btnLink}>
            {editing ? "Fermer" : "Modifier"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(async () => setMessage((await removePrinciple(principle.id)).message))}
            className={btnLink}
          >
            Retirer
          </button>
        </div>
      ) : null}
      {message ? <p className="mt-2 text-sm">{message}</p> : null}
      {editing ? (
        <div className="mt-5 border border-line bg-surface p-4">
          <PrincipleForm principle={principle} onDone={() => setEditing(false)} />
        </div>
      ) : null}
    </li>
  );
}

export function TemplateLibrary({ templates, disabled }: { templates: TemplateView[]; disabled: boolean }) {
  const [filter, setFilter] = useState<Pillar | "recommande">("recommande");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const shown = templates.filter((t) => (filter === "recommande" ? t.recommended : t.pillar === filter));

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={filter === "recommande"}
          onClick={() => setFilter("recommande")}
          className={`h-9 rounded-xs border px-3 text-sm ${filter === "recommande" ? "border-paper bg-paper text-ink" : "border-line text-mute"}`}
        >
          Pour toi
        </button>
        {PILLARS.map((p) => (
          <button
            key={p.value}
            type="button"
            aria-pressed={filter === p.value}
            onClick={() => setFilter(p.value)}
            className={`h-9 rounded-xs border px-3 text-sm ${filter === p.value ? "border-paper bg-paper text-ink" : "border-line text-mute"}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {message ? (
        <p role="status" className="mt-4 text-sm">
          {message}
        </p>
      ) : null}
      <ul className="mt-4 divide-y divide-line border-y border-line">
        {shown.map((t) => (
          <li key={t.code} className="py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-mute">{t.if_text.replace("{heure}", "…")},</p>
                <p className="mt-0.5 leading-snug">{t.then_text.replace("{minutes}", "50").replace("{reps}", "20")}.</p>
                <p className="mt-2 text-xs text-mute">
                  {PILLAR_LABEL[t.pillar]} · {PROOF_LABEL[t.proof_type]} · {daysLabel(t.days)}
                </p>
                <p className="mt-2 text-sm text-mute">
                  {t.why} <span className="italic">({t.source})</span>
                </p>
              </div>
              <button
                type="button"
                disabled={disabled || pending}
                onClick={() => startTransition(async () => setMessage((await addTemplate(t.code)).message))}
                className={btnSmall}
              >
                Ajouter
              </button>
            </div>
          </li>
        ))}
        {!shown.length ? <li className="py-4 text-sm text-mute">Rien ici pour l&apos;instant.</li> : null}
      </ul>
    </div>
  );
}
