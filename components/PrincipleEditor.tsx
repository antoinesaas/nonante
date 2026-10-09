"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { addTemplate, removePrinciple, savePrinciple } from "@/app/actions/principles";
import { useI18n } from "@/components/I18nProvider";
import { Sheet } from "@/components/Sheet";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";
import { idle } from "@/lib/errors";
import { fmt, formatTime } from "@/lib/i18n/format";
import { daysLabel, targetHint } from "@/lib/i18n/labels";
import { isStrong, LINK_DOMAINS } from "@/lib/proofs";
import type { EditablePrinciple, Pillar, ProofType, TemplateView } from "@/lib/types";
import { btnLink, btnPrimary, btnSecondary, btnSmall, input, label } from "@/lib/ui";

const PILLARS: Pillar[] = ["focus", "business", "corps", "esprit", "energie"];
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

/** « Si je m'assois… » → « je m'assois… » (le serveur remet le « si » dans la langue du joueur). */
function stripIf(text: string) {
  return text
    .replace(/^(s'il |s'|si |if |wenn |cuando )/i, (m) => (m.toLowerCase() === "s'il " ? "il " : ""))
    .replace(/,$/, "");
}

function stripThen(text: string) {
  return text.replace(/^(alors |then |dann |entonces )/i, "").replace(/\.$/, "");
}

const MINUTE_WORDS = "minutes|minute|min|Minuten|minutos";
const REP_WORDS = "pompes|squats|push-ups|Liegestütze|Kniebeugen|flexiones|sentadillas";

/** Le texte « alors… » suit la cible : « 25 minutes » devient « 50 minutes », « 10 pompes » devient « 20 pompes ». */
function syncNumber(text: string, words: string, value: number): string {
  return text.replace(new RegExp(`\\b\\d+(?=\\s?(${words})\\b)`), String(value));
}

function chip(on: boolean) {
  return `h-10 rounded-full border px-3.5 text-sm transition-[background-color,border-color,color,transform] duration-150 active:scale-95 ${on ? "border-paper bg-paper text-ink" : "border-line text-mute hover:text-paper"}`;
}

/** Formulaire d'un principe, dans une feuille : les champs défilent, la barre Annuler / Enregistrer reste dessous, toujours visible. */
export function PrincipleForm({ principle, onDone, onCancel }: { principle?: EditablePrinciple; onDone?: () => void; onCancel?: () => void }) {
  const { m, locale } = useI18n();
  const t = m.app.principles;
  const [state, formAction] = useActionState(savePrinciple, idle);
  const [pillar, setPillar] = useState<Pillar>(principle?.pillar ?? "focus");
  const [proof, setProof] = useState<ProofType>(principle?.proof_type ?? "declaratif");
  const [days, setDays] = useState<number[]>(principle?.days ?? [1, 2, 3, 4, 5, 6, 7]);
  const [minutes, setMinutes] = useState(principle?.target.minutes ?? 50);
  const [reps, setReps] = useState(principle?.target.reps ?? 20);
  const [exercise, setExercise] = useState(principle?.target.exercise ?? "pushup");
  const [wake, setWake] = useState(principle?.target.before && principle.proof_type === "reveil" ? principle.target.before : "07:00");
  const [difficulty, setDifficulty] = useState(principle && !isStrong(principle.proof_type) ? principle.difficulty : 1);
  const [thenText, setThenText] = useState(principle ? stripThen(principle.then_text) : "");
  const est = estimate(proof, minutes, reps, exercise, wake, difficulty);
  const time = (v: string) => formatTime(v, locale);

  useEffect(() => {
    if (state.ok) onDone?.();
  }, [state, onDone]);

  return (
    <form action={formAction} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 pt-4 pb-6">
        {principle ? <input type="hidden" name="id" value={principle.id} /> : null}
        <input type="hidden" name="pillar" value={pillar} />
        <input type="hidden" name="proofType" value={proof} />
        <input type="hidden" name="difficulty" value={difficulty} />
        {days.map((d) => (
          <input key={d} type="hidden" name="days" value={d} />
        ))}

        <label className="block">
          <span className={label}>{t.if}</span>
          <input name="ifText" defaultValue={principle ? stripIf(principle.if_text) : ""} placeholder={t.ifPlaceholder} maxLength={110} className={`${input} mt-2`} />
        </label>
        <label className="block">
          <span className={label}>{t.then}</span>
          <input name="thenText" value={thenText} onChange={(e) => setThenText(e.target.value)} placeholder={t.thenPlaceholder} maxLength={150} className={`${input} mt-2`} />
        </label>

        <div>
          <p className={label}>{t.pillar}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {PILLARS.map((p) => (
              <button key={p} type="button" aria-pressed={pillar === p} onClick={() => setPillar(p)} className={chip(pillar === p)}>
                {m.game.pillar[p]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className={label}>{t.proof}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {PROOFS.map((p) => (
              <button key={p} type="button" aria-pressed={proof === p} onClick={() => setProof(p)} className={chip(proof === p)}>
                {m.game.proof.label[p]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-mute">{m.game.proof.help[proof]}</p>
        </div>

        {proof === "session" ? (
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={label}>{t.duration}</span>
              <select
                name="minutes"
                value={minutes}
                onChange={(e) => {
                  setMinutes(Number(e.target.value));
                  setThenText((x) => syncNumber(x, MINUTE_WORDS, Number(e.target.value)));
                }}
                className={`${input} mt-2`}
              >
                {[25, 50, 90].map((n) => (
                  <option key={n} value={n}>
                    {fmt(m.game.target.minutes, { n })}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={label}>{t.finishedBefore}</span>
              <select name="before" defaultValue={principle?.target.before ?? ""} className={`${input} mt-2`}>
                <option value="">{t.noLimit}</option>
                {TIMES.filter((x) => x >= "06:00").map((x) => (
                  <option key={x} value={x}>
                    {time(x)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        {proof === "reps" ? (
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={label}>{t.exercise}</span>
              <select name="exercise" value={exercise} onChange={(e) => setExercise(e.target.value as "pushup" | "squat")} className={`${input} mt-2`}>
                <option value="pushup">{t.pushups}</option>
                <option value="squat">{t.squats}</option>
              </select>
            </label>
            <label className="block">
              <span className={label}>{t.reps}</span>
              <input
                name="reps"
                type="number"
                inputMode="numeric"
                min={5}
                max={300}
                value={reps}
                onChange={(e) => {
                  setReps(Number(e.target.value));
                  if (Number(e.target.value) > 0) setThenText((x) => syncNumber(x, REP_WORDS, Number(e.target.value)));
                }}
                className={`${input} mt-2`}
              />
            </label>
          </div>
        ) : null}

        {proof === "reveil" ? (
          <label className="block">
            <span className={label}>{t.wakeBefore}</span>
            <select name="wake" value={wake} onChange={(e) => setWake(e.target.value)} className={`${input} mt-2`}>
              {TIMES.filter((x) => x >= "04:00" && x <= "10:00").map((x) => (
                <option key={x} value={x}>
                  {time(x)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {proof === "photo" ? (
          <label className="block">
            <span className={label}>{t.after}</span>
            <select name="after" defaultValue={principle?.target.after ?? ""} className={`${input} mt-2`}>
              <option value="">{t.anytime}</option>
              {TIMES.map((x) => (
                <option key={x} value={x}>
                  {time(x)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {proof === "lien" ? (
          <fieldset>
            <legend className={label}>{t.domains}</legend>
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
              <span className={label}>{t.count2}</span>
              <input name="count" inputMode="numeric" defaultValue={principle?.target.count ?? ""} placeholder="20" className={`${input} mt-2`} />
            </label>
            <label className="block">
              <span className={label}>{t.unit}</span>
              <input name="unit" defaultValue={principle?.target.unit ?? ""} placeholder={t.unitPlaceholder} maxLength={20} className={`${input} mt-2`} />
            </label>
          </div>
        ) : null}

        {!isStrong(proof) ? (
          <div>
            <p className={label}>{t.difficulty}</p>
            <div className="mt-2 flex gap-2">
              {[1, 2].map((d) => (
                <button key={d} type="button" aria-pressed={difficulty === d} onClick={() => setDifficulty(d)} className={chip(difficulty === d)}>
                  {d === 1 ? t.normal : t.hard}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div>
          <p className={label}>{t.days}</p>
          <div className="mt-2 grid grid-cols-7 gap-1.5">
            {m.game.days.short.map((d, i) => {
              const day = i + 1;
              const on = days.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={on}
                  aria-label={m.game.days.names[i]}
                  onClick={() => setDays((list) => (on ? list.filter((x) => x !== day) : [...list, day].sort()))}
                  className={`h-10 rounded-full border text-sm transition-[background-color,border-color,color,transform] active:scale-90 ${on ? "border-paper bg-paper text-ink" : "border-line text-mute"}`}
                >
                  {d}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-mute">{days.length ? daysLabel(days, m) : m.game.days.none}</p>
        </div>

      </div>
      {/* Hors de la zone qui défile : toujours visible, même au bas d'un long formulaire. */}
      <div className="shrink-0 border-t border-line bg-surface px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <p className="mb-3 text-xs text-mute">{fmt(t.estimate, { d: est.difficulty, points: est.points, loss: 10 * est.difficulty })}</p>
        <div className="flex gap-3">
          {onCancel ? (
            <button type="button" onClick={onCancel} className={`${btnSecondary} h-14 flex-1`}>
              {m.common.actions.cancel}
            </button>
          ) : null}
          <SubmitButton className={`${btnPrimary} flex-[2]`} pendingLabel={m.common.actions.saving}>
            {principle ? t.save : t.addThis}
          </SubmitButton>
        </div>
        <FormMessage message={state.message} ok={state.ok} />
      </div>
    </form>
  );
}

/** Bouton « Créer un principe » : le formulaire s'ouvre dans une feuille. */
export function NewPrinciple() {
  const { m } = useI18n();
  const t = m.app.principles;
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={btnPrimary}>
        <span aria-hidden="true" className="mr-2 text-xl leading-none">
          +
        </span>
        {t.createButton}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t.create} bare>
        {open ? <PrincipleForm onDone={() => setOpen(false)} onCancel={() => setOpen(false)} /> : null}
      </Sheet>
    </>
  );
}

export function PrincipleRow({ principle, editable }: { principle: EditablePrinciple; editable: boolean }) {
  const { m, locale } = useI18n();
  const t = m.app.principles;
  const [editing, setEditing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const hint = targetHint(principle.proof_type, principle.target, m, locale);
  const shown = isStrong(principle.proof_type) ? principle.value : Math.round(principle.value / 2);

  return (
    <li className={`py-5 transition-opacity ${pending ? "opacity-50" : ""}`}>
      <button type="button" disabled={!editable} onClick={() => setEditing(true)} className="flex w-full items-start justify-between gap-4 text-left disabled:cursor-default">
        <div className="min-w-0">
          <p className="text-[10px] tracking-[0.2em] text-mute uppercase">
            {m.game.pillar[principle.pillar]}
            {principle.pending ? t.fromTomorrow : ""}
          </p>
          <p className="mt-1.5 text-mute">{principle.if_text},</p>
          <p className="mt-0.5 text-lg leading-snug">{principle.then_text}</p>
          <p className="mt-2 text-xs text-mute">
            {m.game.proof.label[principle.proof_type]}
            {hint ? ` · ${hint}` : ""} · {daysLabel(principle.days, m)}
          </p>
        </div>
        <span className="shrink-0 font-serif text-2xl leading-none tabular-nums">+{shown}</span>
      </button>
      {editable ? (
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => setEditing(true)} className={btnSmall}>
            {t.edit}
          </button>
          <button type="button" disabled={pending} onClick={() => setConfirmRemove(true)} className={`${btnLink} px-3`}>
            {t.remove}
          </button>
        </div>
      ) : null}
      {message ? <p className="mt-2 animate-rise text-sm">{message}</p> : null}

      <Sheet open={editing} onClose={() => setEditing(false)} title={t.editTitle} bare>
        {editing ? <PrincipleForm principle={principle} onDone={() => setEditing(false)} onCancel={() => setEditing(false)} /> : null}
      </Sheet>
      <Sheet open={confirmRemove} onClose={() => setConfirmRemove(false)} title={t.removeTitle}>
        <p className="mt-2 text-sm text-mute">{t.removeText}</p>
        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={() => {
              setConfirmRemove(false);
              startTransition(async () => setMessage((await removePrinciple(principle.id)).message));
            }}
            className={btnPrimary}
          >
            {t.removeConfirm}
          </button>
          <button type="button" onClick={() => setConfirmRemove(false)} className={`${btnSecondary} w-full`}>
            {m.common.actions.cancel}
          </button>
        </div>
      </Sheet>
    </li>
  );
}

/** Sans accents ni majuscules, pour chercher « reveil » comme « Réveil ». */
function plain(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * Bibliothèque : déjà triée par pertinence pour le joueur (métier, école, objectif, points faibles).
 * « Pour toi » : les 3 meilleurs ; chaque catégorie : ses 3 meilleurs ; la recherche parcourt tout.
 */
export function TemplateLibrary({ templates, disabled }: { templates: TemplateView[]; disabled: boolean }) {
  const { m } = useI18n();
  const t = m.app.principles;
  const [filter, setFilter] = useState<Pillar | "recommande">("recommande");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState<string | null>(null);
  const words = plain(query).split(/\s+/).filter((w) => w.length > 1);
  const fresh = templates.filter((x) => !x.added);
  const shown = words.length
    ? templates.filter((x) => words.every((w) => plain(`${x.if_text} ${x.then_text} ${x.why} ${x.source} ${m.game.pillar[x.pillar]}`).includes(w))).slice(0, 20)
    : filter === "recommande"
      ? fresh.filter((x) => x.score > 0).slice(0, 3)
      : fresh.filter((x) => x.pillar === filter).slice(0, 3);

  return (
    <div>
      <label className="block">
        <span className="sr-only">{t.search}</span>
        <span className="relative block">
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-mute" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6.25" />
            <path d="M15.25 15.25 L20 20" />
          </svg>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.searchPlaceholder} className={`${input} pl-12`} />
        </span>
      </label>
      {words.length ? null : (
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" aria-pressed={filter === "recommande"} onClick={() => setFilter("recommande")} className={chip(filter === "recommande")}>
            {t.forYou}
          </button>
          {PILLARS.map((p) => (
            <button key={p} type="button" aria-pressed={filter === p} onClick={() => setFilter(p)} className={chip(filter === p)}>
              {m.game.pillar[p]}
            </button>
          ))}
        </div>
      )}
      {message ? (
        <p role="status" className="mt-4 animate-rise text-sm">
          {message}
        </p>
      ) : null}
      <ul key={words.length ? "recherche" : filter} className="mt-4 animate-fade divide-y divide-line border-y border-line">
        {shown.map((x) => (
          <li key={x.code} className="py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                {x.for_business || x.for_school ? (
                  <p className="mb-1.5 text-[10px] tracking-[0.2em] text-paper uppercase">{x.for_business ? t.forBusiness : t.forSchool}</p>
                ) : null}
                <p className="text-mute">{x.if_text.replace("{heure}", "…")},</p>
                <p className="mt-0.5 leading-snug">{x.then_text.replace("{minutes}", "50").replace("{reps}", "20")}.</p>
                <p className="mt-2 text-xs text-mute">
                  {m.game.pillar[x.pillar]} · {m.game.proof.label[x.proof_type]} · {daysLabel(x.days, m)}
                </p>
                <p className="mt-2 text-sm text-mute">
                  {x.why} <span className="italic">({x.source})</span>
                </p>
              </div>
              {x.added ? (
                <span className="shrink-0 pt-2 text-xs text-mute">{t.added}</span>
              ) : (
                <button
                  type="button"
                  disabled={disabled || pending}
                  onClick={() => {
                    setAdding(x.code);
                    startTransition(async () => {
                      setMessage((await addTemplate(x.code)).message);
                      setAdding(null);
                    });
                  }}
                  className={btnSmall}
                >
                  {adding === x.code ? "…" : t.add}
                </button>
              )}
            </div>
          </li>
        ))}
        {!shown.length ? <li className="py-4 text-sm text-mute">{words.length ? t.noResult : t.nothingHere}</li> : null}
      </ul>
    </div>
  );
}
