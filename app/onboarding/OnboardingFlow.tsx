"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import { createEnrollment, type OnboardingState } from "@/app/actions/onboarding";
import { Logo } from "@/components/Logo";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";
import type { Artwork } from "@/lib/art";
import type { PublicCohort } from "@/lib/cohorts";
import { formatDayFr } from "@/lib/dates";
import { WEAK_MOMENTS } from "@/lib/proofs";
import type { Category } from "@/lib/types";
import { btnLink, btnPrimary, input } from "@/lib/ui";

export type OnboardingPrefill = {
  category: Category;
  goal: string;
  goalPublic: boolean;
  weakMoments: string[];
  wakeTime: string;
  pushups: "oui" | "quelques" | "non";
};

type Props = {
  cohort: PublicCohort;
  profile: { pseudo: string; is_public: boolean } | null;
  prefill: OnboardingPrefill | null;
  firstArt: Artwork | null;
  lastArt: Artwork | null;
  currentYear: number;
};

const WAKE_TIMES = Array.from({ length: 13 }, (_, i) => {
  const minutes = 4 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${minutes % 60 ? "30" : "00"}`;
});

const CATEGORIES: { value: Category; label: string; detail: string }[] = [
  { value: "etudes", label: "Études", detail: "Partiels, concours, grandes écoles." },
  { value: "business", label: "Business", detail: "Ton projet, tes clients, tes premiers euros." },
  { value: "mixte", label: "Les deux", detail: "Les études et le business, de front." },
];

const PUSHUPS = [
  { value: "oui", label: "Oui, 20 sans problème" },
  { value: "quelques", label: "Quelques-unes" },
  { value: "non", label: "Pas encore" },
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
      <div className="absolute inset-0 bg-ink/70" />
      <p className="absolute right-4 bottom-3 left-4 z-10 text-right text-[11px] text-mute">
        {art.artist}, <span className="italic">{art.title}</span>, {art.year}. Domaine public.
      </p>
    </>
  );
}

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`w-full rounded-xs border px-4 py-4 text-left transition-colors ${
        selected ? "border-paper bg-paper text-ink" : "border-line text-paper hover:border-mute"
      }`}
    >
      {children}
    </button>
  );
}

export function OnboardingFlow({ cohort, profile, prefill, firstArt, lastArt, currentYear }: Props) {
  const steps = ["intro", ...(profile ? [] : ["profil"]), "categorie", "objectif", "moments", "rythme", "fin"] as const;
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [state, formAction] = useActionState(createEnrollment, initial);

  const [pseudo, setPseudo] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [adult, setAdult] = useState(false);
  const [isPublic, setIsPublic] = useState(profile?.is_public ?? true);
  const [category, setCategory] = useState<Category | null>(prefill?.category ?? null);
  const [goal, setGoal] = useState(prefill?.goal ?? "");
  const [goalPublic, setGoalPublic] = useState(prefill?.goalPublic ?? false);
  const [moments, setMoments] = useState<string[]>(prefill?.weakMoments ?? []);
  const [wakeTime, setWakeTime] = useState(prefill?.wakeTime ?? "07:00");
  const [pushups, setPushups] = useState<"oui" | "quelques" | "non" | null>(prefill?.pushups ?? null);

  const step = steps[index];
  const questionCount = steps.length - 2;

  function check(): string | null {
    if (step === "profil") {
      if (!/^[a-z0-9_]{3,20}$/.test(pseudo)) return "Pseudo : 3 à 20 caractères, en minuscules, chiffres ou _.";
      const year = Number(birthYear);
      if (!year || year < 1900 || currentYear - year < 18 || !adult) return "Nonante est réservé aux personnes majeures.";
    }
    if (step === "categorie" && !category) return "Choisis une catégorie.";
    if (step === "objectif" && goal.trim().length < 3) return "Écris ton objectif en une phrase.";
    if (step === "rythme" && !pushups) return "Réponds à la question sur les pompes.";
    return null;
  }

  function next() {
    const problem = check();
    setError(problem);
    if (!problem) setIndex((i) => Math.min(i + 1, steps.length - 1));
  }

  const withArt = step === "intro" || step === "fin";

  return (
    <div className="relative min-h-dvh overflow-hidden">
      {step === "intro" ? <Backdrop art={firstArt} /> : null}
      {step === "fin" ? <Backdrop art={lastArt} /> : null}

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pt-6 pb-14">
        <div className="flex items-center justify-between">
          <Logo size="sm" />
          {!withArt ? (
            <span className="text-sm text-mute tabular-nums">
              {index} / {questionCount}
            </span>
          ) : null}
        </div>

        <div className="my-auto py-12">
          {step === "intro" ? (
            <>
              <p className="text-xs tracking-[0.2em] text-mute uppercase">{cohort.name}</p>
              <h1 className="mt-5 font-serif text-5xl leading-[0.95]">90 jours. Un objectif. Des preuves.</h1>
              <p className="mt-6 text-lg leading-relaxed text-paper/80">
                Six questions. L&apos;app te donnera ensuite tes principes : tu ne les choisis pas, tu les tiens.
              </p>
            </>
          ) : null}

          {step === "profil" ? (
            <div className="space-y-6">
              <h1 className="font-serif text-4xl leading-tight">Qui es-tu ?</h1>
              <label className="block">
                <span className="text-sm text-mute">Pseudo</span>
                <input
                  value={pseudo}
                  onChange={(e) => setPseudo(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20))}
                  autoComplete="username"
                  autoCapitalize="none"
                  placeholder="ton_pseudo"
                  className={`${input} mt-2`}
                />
              </label>
              <label className="block">
                <span className="text-sm text-mute">Année de naissance</span>
                <input
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  inputMode="numeric"
                  autoComplete="bday-year"
                  placeholder="2004"
                  className={`${input} mt-2`}
                />
              </label>
              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} className="size-5 accent-paper" />
                J&apos;ai 18 ans ou plus.
              </label>
              <div className="space-y-3">
                <Choice selected={isPublic} onClick={() => setIsPublic(true)}>
                  Profil public <span className="block text-sm opacity-70">Ton pseudo apparaît au classement.</span>
                </Choice>
                <Choice selected={!isPublic} onClick={() => setIsPublic(false)}>
                  Profil privé <span className="block text-sm opacity-70">Tu apparais comme « Anonyme ».</span>
                </Choice>
              </div>
            </div>
          ) : null}

          {step === "categorie" ? (
            <div className="space-y-6">
              <h1 className="font-serif text-4xl leading-tight">Tu mènes quoi de front ?</h1>
              <div className="space-y-3">
                {CATEGORIES.map((c) => (
                  <Choice key={c.value} selected={category === c.value} onClick={() => setCategory(c.value)}>
                    {c.label} <span className="block text-sm opacity-70">{c.detail}</span>
                  </Choice>
                ))}
              </div>
            </div>
          ) : null}

          {step === "objectif" ? (
            <div className="space-y-6">
              <h1 className="font-serif text-4xl leading-tight">Ton objectif, en une phrase.</h1>
              <textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value.slice(0, 120))}
                rows={3}
                placeholder="Valider mon partiel de droit des obligations."
                className={`${input} h-auto py-3`}
              />
              <p className="text-right text-xs text-mute tabular-nums">{goal.length} / 120</p>
              <div className="space-y-3">
                <Choice selected={goalPublic} onClick={() => setGoalPublic(true)}>
                  Objectif public <span className="block text-sm opacity-70">Visible au classement et sur ton profil.</span>
                </Choice>
                <Choice selected={!goalPublic} onClick={() => setGoalPublic(false)}>
                  Objectif privé <span className="block text-sm opacity-70">Tu es le seul à le voir.</span>
                </Choice>
              </div>
            </div>
          ) : null}

          {step === "moments" ? (
            <div className="space-y-6">
              <h1 className="font-serif text-4xl leading-tight">Quand est-ce que tu décroches ?</h1>
              <p className="text-mute">Plusieurs réponses possibles.</p>
              <div className="space-y-3">
                {WEAK_MOMENTS.map((m) => (
                  <Choice
                    key={m.value}
                    selected={moments.includes(m.value)}
                    onClick={() =>
                      setMoments((all) => (all.includes(m.value) ? all.filter((v) => v !== m.value) : [...all, m.value]))
                    }
                  >
                    {m.label}
                  </Choice>
                ))}
              </div>
            </div>
          ) : null}

          {step === "rythme" ? (
            <div className="space-y-8">
              <div>
                <h1 className="font-serif text-4xl leading-tight">À quelle heure tu te lèves ?</h1>
                <select value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} className={`${input} mt-5`}>
                  {WAKE_TIMES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(":", " h ").replace(" h 00", " h")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <h2 className="font-serif text-3xl leading-tight">Tu peux faire des pompes ?</h2>
                <div className="mt-5 space-y-3">
                  {PUSHUPS.map((p) => (
                    <Choice key={p.value} selected={pushups === p.value} onClick={() => setPushups(p.value)}>
                      {p.label}
                    </Choice>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {step === "fin" ? (
            <>
              <p className="text-xs tracking-[0.2em] text-mute uppercase">{cohort.name}</p>
              <h1 className="mt-5 font-serif text-5xl leading-[0.95]">Tes principes sont prêts.</h1>
              <p className="mt-6 text-lg leading-relaxed text-paper/80">
                Du {formatDayFr(cohort.start_date, { year: false })} au {formatDayFr(cohort.end_date)}. Cinq principes,
                chacun avec sa difficulté et sa preuve. Rien ne se valide sans preuve.
              </p>
            </>
          ) : null}

          {error ? (
            <p role="alert" className="mt-6 text-sm">
              {error}
            </p>
          ) : null}
        </div>

        <div className="space-y-4">
          {step === "fin" ? (
            <form action={formAction}>
              {/* Profil déjà créé : pseudo et année ne sont plus lus par le serveur. */}
              <input type="hidden" name="pseudo" value={profile?.pseudo ?? pseudo} />
              <input type="hidden" name="birthYear" value={profile ? "1990" : birthYear} />
              <input type="hidden" name="adult" value={profile || adult ? "on" : ""} />
              <input type="hidden" name="isPublic" value={isPublic ? "oui" : "non"} />
              <input type="hidden" name="category" value={category ?? ""} />
              <input type="hidden" name="goal" value={goal} />
              <input type="hidden" name="goalPublic" value={goalPublic ? "oui" : "non"} />
              {moments.map((m) => (
                <input key={m} type="hidden" name="weakMoments" value={m} />
              ))}
              <input type="hidden" name="wakeTime" value={wakeTime} />
              <input type="hidden" name="pushups" value={pushups ?? ""} />
              <input type="hidden" name="cohortId" value={cohort.id} />
              <SubmitButton className={btnPrimary} pendingLabel="Génération…">
                Voir mes principes
              </SubmitButton>
              <FormMessage message={state.message} />
            </form>
          ) : (
            <button type="button" onClick={next} className={btnPrimary}>
              {step === "intro" ? "Commencer" : "Continuer"}
            </button>
          )}
          {index > 0 ? (
            <button type="button" onClick={() => setIndex((i) => i - 1)} className={btnLink}>
              Retour
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
