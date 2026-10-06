"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import { buildArc, type OnboardingState } from "@/app/actions/onboarding";
import { Logo } from "@/components/Logo";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";
import { type Artwork, creditLine } from "@/lib/art";
import { formatDayFr } from "@/lib/dates";
import { GOAL_TYPES, SITUATIONS, timeFr, WEAK_POINTS } from "@/lib/proofs";
import type { Category, GoalType } from "@/lib/types";
import { btnLink, btnPrimary, input, label } from "@/lib/ui";

export type OnboardingPrefill = {
  category: Category;
  goalType: GoalType;
  goal: string;
  goalTarget: number | null;
  goalUnit: string | null;
  goalPublic: boolean;
  weakPoints: string[];
  wakeTime: string;
  pushups: "oui" | "quelques" | "non";
  focusMinutes: 25 | 50 | 90;
  startDate: string;
};

export type CollectiveStart = { id: string; name: string; start_date: string; members: number };

type Props = {
  hasProfile: boolean;
  prefill: OnboardingPrefill | null;
  arts: (Artwork | null)[];
  currentYear: number;
  today: string;
  collectiveStarts: CollectiveStart[];
  arcNumber: number;
};

const WAKE_TIMES = Array.from({ length: 25 }, (_, i) => {
  const minutes = 4 * 60 + i * 15;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

const PUSHUPS = [
  { value: "oui", label: "Oui, 20 sans problème" },
  { value: "quelques", label: "Quelques-unes" },
  { value: "non", label: "Pas encore" },
] as const;

const FOCUS = [
  { value: 25, label: "25 minutes", hint: "Pour reprendre l'habitude." },
  { value: 50, label: "50 minutes", hint: "Le bon rythme pour la plupart." },
  { value: 90, label: "90 minutes", hint: "Travail profond, sans pause." },
] as const;

const initial: OnboardingState = { message: null };

function Backdrop({ art }: { art: Artwork | null }) {
  if (!art) return null;
  return (
    <>
      <Image
        src={`/art/${art.slug}-nb.jpg`}
        alt=""
        width={art.width}
        height={art.height}
        priority
        sizes="100vw"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-ink/80" />
      <p className="absolute right-4 bottom-2 z-10 text-right text-[10px] text-mute">{creditLine(art)}</p>
    </>
  );
}

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`w-full rounded-xs border px-4 py-3.5 text-left transition-colors ${
        selected ? "border-paper bg-paper text-ink" : "border-line bg-ink/60 text-paper hover:border-mute"
      }`}
    >
      {children}
    </button>
  );
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function nextMonday(today: string): string {
  const isodow = ((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
  return addDays(today, 8 - isodow);
}

export function OnboardingFlow({ hasProfile, prefill, arts, currentYear, today, collectiveStarts, arcNumber }: Props) {
  const steps = ["intro", ...(hasProfile ? [] : ["profil"]), "situation", "objectif", "faiblesses", "rythme", "depart", "fin"] as const;
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [state, formAction] = useActionState(buildArc, initial);

  const [pseudo, setPseudo] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [adult, setAdult] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [category, setCategory] = useState<Category | null>(prefill?.category ?? null);
  const [goalType, setGoalType] = useState<GoalType | null>(prefill?.goalType ?? null);
  const [goal, setGoal] = useState(prefill?.goal ?? "");
  const [goalTarget, setGoalTarget] = useState(prefill?.goalTarget ? String(prefill.goalTarget) : "");
  const [goalUnit, setGoalUnit] = useState(prefill?.goalUnit ?? "");
  const [goalPublic, setGoalPublic] = useState(prefill?.goalPublic ?? true);
  const [weak, setWeak] = useState<string[]>(prefill?.weakPoints ?? []);
  const [wakeTime, setWakeTime] = useState(prefill?.wakeTime ?? "07:00");
  const [pushups, setPushups] = useState<"oui" | "quelques" | "non" | null>(prefill?.pushups ?? null);
  const [focus, setFocus] = useState<25 | 50 | 90>(prefill?.focusMinutes ?? 50);
  const initialStart = prefill?.startDate && prefill.startDate > today ? `date:${prefill.startDate}` : "today";
  const [start, setStart] = useState(initialStart);
  const [customDate, setCustomDate] = useState(prefill?.startDate && prefill.startDate > today ? prefill.startDate : addDays(today, 1));

  const step = steps[index];
  const questionCount = steps.length - 2;
  const goalInfo = GOAL_TYPES.find((g) => g.value === goalType);

  function check(): string | null {
    if (step === "profil") {
      if (!/^[a-z0-9_]{3,20}$/.test(pseudo)) return "Pseudo : 3 à 20 caractères, en minuscules, chiffres ou _.";
      const year = Number(birthYear);
      if (!year || year < 1900 || currentYear - year < 18 || !adult) return "Nonante est réservé aux personnes majeures.";
    }
    if (step === "situation" && !category) return "Choisis ton profil.";
    if (step === "objectif") {
      if (!goalType) return "Choisis le type de ton objectif.";
      if (goal.trim().length < 3) return "Écris ton objectif en une phrase.";
      if (goalTarget && !(Number(goalTarget.replace(",", ".")) > 0)) return "Le chiffre de ton objectif doit être positif.";
    }
    if (step === "rythme" && !pushups) return "Réponds à la question sur les pompes.";
    if (step === "depart" && start.startsWith("date:") && (customDate < today || customDate > addDays(today, 120))) {
      return "Choisis une date dans les 4 prochains mois.";
    }
    return null;
  }

  function next() {
    const problem = check();
    setError(problem);
    if (!problem) setIndex((i) => Math.min(i + 1, steps.length - 1));
  }

  const startValue = start === "date" || start.startsWith("date:") ? `date:${customDate}` : start;
  const startLabel = (() => {
    if (startValue === "today") return `aujourd'hui, ${formatDayFr(today, { weekday: true, year: false })}`;
    if (startValue === "tomorrow") return `demain, ${formatDayFr(addDays(today, 1), { weekday: true, year: false })}`;
    if (startValue === "monday") return `lundi ${formatDayFr(nextMonday(today), { year: false })}`;
    if (startValue.startsWith("squad:")) {
      const s = collectiveStarts.find((c) => `squad:${c.id}` === startValue);
      return s ? `${formatDayFr(s.start_date, { weekday: true })}, avec l'escouade « ${s.name} »` : "";
    }
    return formatDayFr(customDate, { weekday: true });
  })();

  const art = arts[Math.min(index, arts.length - 1)] ?? null;

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <Backdrop art={art} />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pt-6 pb-14">
        <div className="flex items-center justify-between">
          <Logo size="sm" />
          {step !== "intro" && step !== "fin" ? (
            <span className="text-sm text-mute tabular-nums">
              {index} / {questionCount}
            </span>
          ) : null}
        </div>

        <div className="my-auto py-10">
          {step === "intro" ? (
            <>
              <p className={label}>{arcNumber > 1 ? `Arc n° ${arcNumber}` : "Ton premier arc"}</p>
              <h1 className="mt-5 font-serif text-5xl leading-[0.95]">Le jeu de la vraie vie commence ici.</h1>
              <p className="mt-6 text-lg leading-relaxed text-paper/85">
                Deux minutes pour construire ton arc : ton objectif, tes points faibles, ton rythme. Nonante en tire des
                principes qui marchent, que tu ajustes ensuite comme tu veux.
              </p>
            </>
          ) : null}

          {step === "profil" ? (
            <>
              <h1 className="font-serif text-4xl leading-none">Ton nom de joueur.</h1>
              <p className="mt-3 text-mute">Il apparaît au classement et sur ta carte.</p>
              <div className="mt-8 space-y-6">
                <label className="block">
                  <span className={label}>Pseudo</span>
                  <input
                    value={pseudo}
                    onChange={(e) => setPseudo(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20))}
                    autoComplete="username"
                    autoCapitalize="none"
                    placeholder="antoine_h"
                    className={`${input} mt-2`}
                  />
                </label>
                <label className="block">
                  <span className={label}>Année de naissance</span>
                  <input
                    value={birthYear}
                    onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    inputMode="numeric"
                    placeholder="2004"
                    className={`${input} mt-2`}
                  />
                </label>
                <label className="flex items-start gap-3 text-sm">
                  <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} className="mt-0.5 size-5 accent-paper" />
                  J&apos;ai 18 ans ou plus.
                </label>
                <div>
                  <p className={label}>Profil</p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Choice selected={isPublic} onClick={() => setIsPublic(true)}>
                      Public
                    </Choice>
                    <Choice selected={!isPublic} onClick={() => setIsPublic(false)}>
                      Privé
                    </Choice>
                  </div>
                  <p className="mt-2 text-xs text-mute">
                    Public : ton pseudo et ta carte au classement. Privé : tu apparais en « Anonyme ».
                  </p>
                </div>
              </div>
            </>
          ) : null}

          {step === "situation" ? (
            <>
              <h1 className="font-serif text-4xl leading-none">Tu es…</h1>
              <div className="mt-8 space-y-3">
                {SITUATIONS.map((s) => (
                  <Choice key={s.value} selected={category === s.value} onClick={() => setCategory(s.value)}>
                    <span className="block font-medium">{s.label}</span>
                    <span className={`mt-1 block text-sm ${category === s.value ? "text-ink/70" : "text-mute"}`}>{s.hint}</span>
                  </Choice>
                ))}
              </div>
            </>
          ) : null}

          {step === "objectif" ? (
            <>
              <h1 className="font-serif text-4xl leading-none">Dans 90 jours, tu veux…</h1>
              <div className="mt-6 grid grid-cols-2 gap-2">
                {GOAL_TYPES.map((g) => (
                  <Choice
                    key={g.value}
                    selected={goalType === g.value}
                    onClick={() => {
                      setGoalType(g.value);
                      if (!goalUnit || GOAL_TYPES.some((x) => x.unit === goalUnit)) setGoalUnit(g.unit ?? "");
                    }}
                  >
                    <span className="text-sm">{g.label}</span>
                  </Choice>
                ))}
              </div>
              {goalType ? (
                <div className="mt-6 space-y-4">
                  <label className="block">
                    <span className={label}>Ton objectif en une phrase</span>
                    <textarea
                      value={goal}
                      onChange={(e) => setGoal(e.target.value.slice(0, 120))}
                      rows={2}
                      placeholder={goalInfo?.example}
                      className={`${input} mt-2 h-auto py-3`}
                    />
                  </label>
                  <div className="grid grid-cols-[1fr_7rem] gap-3">
                    <label className="block">
                      <span className={label}>Chiffre (facultatif)</span>
                      <input
                        value={goalTarget}
                        onChange={(e) => setGoalTarget(e.target.value.replace(/[^\d,.]/g, "").slice(0, 12))}
                        inputMode="decimal"
                        placeholder={goalType === "revenu" ? "3000" : "10"}
                        className={`${input} mt-2`}
                      />
                    </label>
                    <label className="block">
                      <span className={label}>Unité</span>
                      <input value={goalUnit} onChange={(e) => setGoalUnit(e.target.value.slice(0, 20))} placeholder="€" className={`${input} mt-2`} />
                    </label>
                  </div>
                  <label className="flex items-start gap-3 text-sm">
                    <input type="checkbox" checked={goalPublic} onChange={(e) => setGoalPublic(e.target.checked)} className="mt-0.5 size-5 accent-paper" />
                    Afficher mon objectif sur mon profil public. Le dire, c&apos;est déjà s&apos;engager.
                  </label>
                </div>
              ) : null}
            </>
          ) : null}

          {step === "faiblesses" ? (
            <>
              <h1 className="font-serif text-4xl leading-none">Où est-ce que tu décroches ?</h1>
              <p className="mt-3 text-mute">Sois honnête : tes principes viseront exactement ça. Plusieurs choix possibles.</p>
              <div className="mt-8 space-y-2">
                {WEAK_POINTS.map((w) => (
                  <Choice
                    key={w.value}
                    selected={weak.includes(w.value)}
                    onClick={() => setWeak((list) => (list.includes(w.value) ? list.filter((x) => x !== w.value) : [...list, w.value]))}
                  >
                    <span className="text-sm">{w.label}</span>
                  </Choice>
                ))}
              </div>
            </>
          ) : null}

          {step === "rythme" ? (
            <>
              <h1 className="font-serif text-4xl leading-none">Ton rythme.</h1>
              <div className="mt-8 space-y-8">
                <label className="block">
                  <span className={label}>Tu te lèves à</span>
                  <select value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} className={`${input} mt-2`}>
                    {WAKE_TIMES.map((t) => (
                      <option key={t} value={t}>
                        {timeFr(t)}
                      </option>
                    ))}
                  </select>
                  <span className="mt-2 block text-xs text-mute">Même heure tous les jours, week-end compris. Tu le prouveras avec un code.</span>
                </label>
                <div>
                  <p className={label}>Concentré d&apos;affilée, tu tiens</p>
                  <div className="mt-3 space-y-2">
                    {FOCUS.map((f) => (
                      <Choice key={f.value} selected={focus === f.value} onClick={() => setFocus(f.value)}>
                        <span className="text-sm">
                          {f.label} <span className={focus === f.value ? "text-ink/60" : "text-mute"}>· {f.hint}</span>
                        </span>
                      </Choice>
                    ))}
                  </div>
                </div>
                <div>
                  <p className={label}>Tu peux faire des pompes ?</p>
                  <div className="mt-3 space-y-2">
                    {PUSHUPS.map((p) => (
                      <Choice key={p.value} selected={pushups === p.value} onClick={() => setPushups(p.value)}>
                        <span className="text-sm">{p.label}</span>
                      </Choice>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : null}

          {step === "depart" ? (
            <>
              <h1 className="font-serif text-4xl leading-none">Ton jour 1.</h1>
              <p className="mt-3 text-mute">Ton arc dure 90 jours à partir de cette date. Le plus tôt est le mieux.</p>
              <div className="mt-8 space-y-2">
                <Choice selected={start === "today"} onClick={() => setStart("today")}>
                  <span className="text-sm">Aujourd&apos;hui</span>
                </Choice>
                <Choice selected={start === "tomorrow"} onClick={() => setStart("tomorrow")}>
                  <span className="text-sm">Demain</span>
                </Choice>
                <Choice selected={start === "monday"} onClick={() => setStart("monday")}>
                  <span className="text-sm">Lundi prochain · {formatDayFr(nextMonday(today), { year: false })}</span>
                </Choice>
                {collectiveStarts.map((c) => (
                  <Choice key={c.id} selected={start === `squad:${c.id}`} onClick={() => setStart(`squad:${c.id}`)}>
                    <span className="block text-sm">Départ collectif · {formatDayFr(c.start_date)}</span>
                    <span className={`mt-1 block text-xs ${start === `squad:${c.id}` ? "text-ink/60" : "text-mute"}`}>
                      {c.name} · {c.members.toLocaleString("fr-FR")} {c.members > 1 ? "inscrits" : "inscrit"}
                    </span>
                  </Choice>
                ))}
                <Choice selected={start.startsWith("date")} onClick={() => setStart(`date:${customDate}`)}>
                  <span className="text-sm">Une autre date</span>
                </Choice>
                {start.startsWith("date") ? (
                  <input
                    type="date"
                    value={customDate}
                    min={today}
                    max={addDays(today, 120)}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className={`${input} mt-2`}
                  />
                ) : null}
              </div>
            </>
          ) : null}

          {step === "fin" ? (
            <>
              <h1 className="font-serif text-5xl leading-[0.95]">Ton arc est prêt à être construit.</h1>
              <dl className="mt-8 space-y-3 text-sm">
                <div>
                  <dt className={label}>Objectif</dt>
                  <dd className="mt-1 text-lg">{goal.trim()}</dd>
                </div>
                <div>
                  <dt className={label}>Jour 1</dt>
                  <dd className="mt-1 text-lg">{startLabel}</dd>
                </div>
              </dl>
              <p className="mt-6 text-paper/80">
                Nonante te propose maintenant tes principes. Tu peux tous les modifier avant de lancer ton arc.
              </p>
            </>
          ) : null}

          {error ? (
            <p role="alert" className="mt-6 text-sm">
              {error}
            </p>
          ) : null}
        </div>

        {step === "fin" ? (
          <form action={formAction}>
            {!hasProfile ? (
              <>
                <input type="hidden" name="pseudo" value={pseudo} />
                <input type="hidden" name="birthYear" value={birthYear} />
                <input type="hidden" name="isPublic" value={isPublic ? "oui" : "non"} />
                {adult ? <input type="hidden" name="adult" value="on" /> : null}
              </>
            ) : null}
            <input type="hidden" name="category" value={category ?? ""} />
            <input type="hidden" name="goalType" value={goalType ?? ""} />
            <input type="hidden" name="goal" value={goal} />
            <input type="hidden" name="goalTarget" value={goalTarget} />
            <input type="hidden" name="goalUnit" value={goalUnit} />
            <input type="hidden" name="goalPublic" value={goalPublic ? "oui" : "non"} />
            {weak.map((w) => (
              <input key={w} type="hidden" name="weakPoints" value={w} />
            ))}
            <input type="hidden" name="wakeTime" value={wakeTime} />
            <input type="hidden" name="pushups" value={pushups ?? ""} />
            <input type="hidden" name="focusMinutes" value={focus} />
            <input type="hidden" name="start" value={startValue} />
            <SubmitButton className={btnPrimary} pendingLabel="Construction…">
              Voir mes principes
            </SubmitButton>
            <FormMessage message={state.message} />
            <button type="button" onClick={() => setIndex(index - 1)} className={`${btnLink} mt-5`}>
              Revenir
            </button>
          </form>
        ) : (
          <div>
            <button type="button" onClick={next} className={btnPrimary}>
              {step === "intro" ? "Commencer" : "Continuer"}
            </button>
            {index > 0 ? (
              <button type="button" onClick={() => setIndex(index - 1)} className={`${btnLink} mt-5`}>
                Revenir
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
