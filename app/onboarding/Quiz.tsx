"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { type AccountState, continueWithPlan, previewArc, sendAccountCode, verifyAccountCode } from "@/app/actions/onboarding";
import { Hand, HandArrow } from "@/components/Hand";
import { Logo } from "@/components/Logo";
import { PlanPicker } from "@/components/PlanPicker";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";
import { addDays, type ArcAnswers, COMMITMENTS, nextMonday } from "@/lib/answers";
import { type Artwork, creditLine } from "@/lib/art";
import { formatDayFr } from "@/lib/dates";
import { formatEuros } from "@/lib/money";
import { perDay, PLAN_NAME, priceLabel } from "@/lib/plans";
import { GOAL_LABEL, GOAL_TYPES, PILLAR_LABEL, PROOF_LABEL, SITUATIONS, timeFr, WEAK_POINTS } from "@/lib/proofs";
import type { Category, GoalType, Interval, PlanId, Preview, PublicPlans } from "@/lib/types";
import { btnLink, btnPrimary, input, label } from "@/lib/ui";

export type CollectiveStart = { id: string; name: string; start_date: string; members: number };

type Props = {
  loggedIn: boolean;
  hasProfile: boolean;
  pseudo: string | null;
  today: string;
  collectiveStarts: CollectiveStart[];
  arcNumber: number;
  plans: PublicPlans;
  currentPlan: PlanId | null;
  initialPlan: PlanId | null;
  arts: (Artwork | null)[];
  templates: number;
  proofSlot: React.ReactNode;
  faqSlot: React.ReactNode;
};

type Stage = "questions" | "building" | "result" | "account";

const WAKE_TIMES = Array.from({ length: 25 }, (_, i) => {
  const minutes = 4 * 60 + i * 15;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

const PUSHUPS = [
  { value: "oui", label: "Oui, 20 sans problème", hint: "On partira sur 20." },
  { value: "quelques", label: "Quelques-unes", hint: "On partira sur 10, ça montera." },
  { value: "non", label: "Pas encore", hint: "On commence par des squats." },
] as const;

const FOCUS = [
  { value: 25, label: "25 minutes", hint: "Pour reprendre l'habitude." },
  { value: 50, label: "50 minutes", hint: "Le bon rythme pour la plupart." },
  { value: 90, label: "90 minutes", hint: "Travail profond, sans pause." },
] as const;

/** Exemple de principe « si… alors… » pour le premier point faible choisi. */
const IF_THEN_EXAMPLE: Record<string, string> = {
  telephone: "Si je m'assois à mon bureau, alors mon téléphone part dans une autre pièce.",
  procrastination: "Si j'ouvre mon ordinateur, alors je commence par la tâche que je repousse.",
  vente: "S'il est 11 h, alors j'envoie 10 messages de prospection.",
  dispersion: "Si je commence ma journée, alors j'écris la seule tâche qui compte.",
  reveil: "S'il est 7 h, alors je suis debout, week-end compris.",
  sport: "Si je sors du lit, alors 20 pompes.",
  regularite: "Si je rate un jour, alors je ne rate jamais le suivant.",
};

// Délais d'apparition en cascade (classes écrites en entier pour Tailwind).
const STAGGER = ["", "[animation-delay:60ms]", "[animation-delay:120ms]", "[animation-delay:180ms]", "[animation-delay:240ms]", "[animation-delay:300ms]", "[animation-delay:360ms]", "[animation-delay:420ms]"];

type Draft = {
  category: Category | null;
  goalType: GoalType | null;
  goal: string;
  goalTarget: string;
  goalUnit: string;
  goalPublic: boolean;
  weakPoints: string[];
  wakeTime: string;
  pushups: "oui" | "quelques" | "non" | null;
  focusMinutes: 25 | 50 | 90;
  start: string;
  customDate: string;
  commitment: "essayer" | "decide" | "tout" | null;
  pseudo: string;
  isPublic: boolean;
};

function toAnswers(d: Draft): ArcAnswers {
  const target = d.goalTarget.replace(/\s/g, "").replace(",", ".");
  return {
    category: d.category ?? "business",
    goalType: d.goalType ?? "autre",
    goal: d.goal.trim(),
    goalTarget: target && Number(target) > 0 ? Number(target) : null,
    goalUnit: d.goalUnit.trim() || null,
    goalPublic: d.goalPublic,
    weakPoints: d.weakPoints as ArcAnswers["weakPoints"],
    wakeTime: d.wakeTime,
    pushups: d.pushups ?? "oui",
    focusMinutes: d.focusMinutes,
    start: d.start === "date" ? `date:${d.customDate}` : d.start,
    commitment: d.commitment,
    pseudo: d.pseudo || null,
    isPublic: d.isPublic,
  };
}

function Choice({ selected, onClick, index = 0, children }: { selected: boolean; onClick: () => void; index?: number; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex w-full animate-rise items-center justify-between gap-3 rounded-xs border px-4 py-3.5 text-left transition-[background-color,border-color,color,transform] duration-200 active:scale-[0.99] ${STAGGER[index] ?? ""} ${
        selected ? "border-paper bg-paper text-ink" : "border-line bg-ink/60 text-paper hover:border-mute"
      }`}
    >
      <span className="min-w-0">{children}</span>
      <span aria-hidden="true" className={`grid size-5 shrink-0 place-items-center rounded-full border ${selected ? "border-ink" : "border-line"}`}>
        {selected ? <span className="size-2.5 animate-tick rounded-full bg-ink" /> : null}
      </span>
    </button>
  );
}

function Backdrop({ art }: { art: Artwork | null }) {
  if (!art) return null;
  return (
    <>
      <Image
        key={art.slug}
        src={`/art/${art.slug}-nb.jpg`}
        alt=""
        width={art.width}
        height={art.height}
        priority
        sizes="100vw"
        className="absolute inset-0 h-full w-full animate-fade object-cover"
      />
      <div className="absolute inset-0 bg-linear-to-b from-ink/70 via-ink/85 to-ink" />
      <p className="absolute right-4 bottom-2 z-10 text-right text-[10px] text-mute">{creditLine(art)}</p>
    </>
  );
}

/** Écran de construction : un vrai calcul (preview_principles) mis en scène, jamais plus long que nécessaire. */
function Building({ ready, steps, onDone }: { ready: boolean; steps: string[]; onDone: () => void }) {
  const [pct, setPct] = useState(0);
  const readyRef = useRef(ready);
  const doneRef = useRef(onDone);
  useEffect(() => {
    readyRef.current = ready;
    doneRef.current = onDone;
  });

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduced ? 1200 : 5200;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      let p = (1 - Math.pow(1 - t, 2)) * 100;
      if (!readyRef.current) p = Math.min(p, 92);
      setPct(p);
      if (p >= 100) {
        doneRef.current();
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const C = 2 * Math.PI * 54;
  const active = Math.min(steps.length - 1, Math.floor(pct / (100 / steps.length)));

  return (
    <div className="flex flex-1 flex-col justify-center py-10">
      <Hand className="animate-rise text-3xl text-mute">on construit ton arc…</Hand>
      <div className="relative mx-auto mt-10 size-44 animate-pop">
        <svg viewBox="0 0 120 120" className="size-44 -rotate-90" aria-hidden="true">
          <circle cx="60" cy="60" r="54" fill="none" stroke="var(--color-line)" strokeWidth="2" />
          <circle cx="60" cy="60" r="54" fill="none" stroke="var(--color-paper)" strokeWidth="2" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} />
        </svg>
        <p className="absolute inset-0 grid place-items-center font-serif text-5xl tabular-nums" aria-live="polite">
          {Math.round(pct)}
          <span className="sr-only"> pour cent</span>
        </p>
      </div>
      <ol className="mt-12 space-y-4">
        {steps.map((s, i) => (
          <li key={i} className={`flex items-center gap-3 text-sm transition-opacity duration-500 ${i <= active ? "opacity-100" : "opacity-25"}`}>
            <span className="grid size-5 shrink-0 place-items-center rounded-full border border-line">
              {i < active || pct >= 100 ? (
                <svg viewBox="0 0 16 16" className="size-3 animate-tick text-ok" aria-hidden="true">
                  <path d="M3 8.5 L6.5 12 L13 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : i === active ? (
                <span className="size-1.5 animate-breathe rounded-full bg-paper" />
              ) : null}
            </span>
            <span className={i === active && pct < 100 ? "shimmer-text" : ""}>{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

const accountInitial: AccountState = { step: "email", email: "", message: null };

/** Visiteur : email puis code, sur le même écran. Les réponses partent avec l'email. */
function AccountStep({ answers, plan, interval, price, onBack }: { answers: string; plan: PlanId; interval: Interval; price: number; onBack: () => void }) {
  const [sent, sendAction] = useActionState(sendAccountCode, accountInitial);
  const [checked, verifyAction] = useActionState(verifyAccountCode, accountInitial);
  const [dismissed, setDismissed] = useState<AccountState | null>(null);
  const codeStep = sent.step === "code" && sent !== dismissed;

  return (
    <div className="flex flex-1 flex-col justify-center py-10">
      <Hand underline className="animate-rise text-3xl">
        dernière ligne droite
      </Hand>
      <h1 className="mt-6 animate-rise font-serif text-5xl leading-[0.95] [animation-delay:80ms]">Sauvegarde ton arc.</h1>
      <p className="mt-5 animate-rise text-paper/85 [animation-delay:140ms]">
        Ton email suffit, sans mot de passe : on t&apos;envoie un code pour retrouver ton arc sur tous tes appareils.
      </p>
      <div className="mt-6 flex animate-rise items-baseline justify-between border-y border-line py-4 text-sm [animation-delay:200ms]">
        <span>{PLAN_NAME[plan]}</span>
        <span className="font-serif text-2xl">{priceLabel(price, interval)}</span>
      </div>

      {!codeStep ? (
        <form action={sendAction} className="mt-8 animate-rise space-y-4 [animation-delay:260ms]">
          <input type="hidden" name="answers" value={answers} />
          <input type="hidden" name="plan" value={plan} />
          <input type="hidden" name="interval" value={interval} />
          <label className="block">
            <span className="text-sm text-mute">Ton email</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              defaultValue={sent.email}
              placeholder="ton@email.fr"
              className={`${input} mt-2`}
            />
          </label>
          <SubmitButton className={btnPrimary} pendingLabel="Envoi…">
            Recevoir mon code
          </SubmitButton>
          <FormMessage message={sent.message} />
        </form>
      ) : (
        <form action={verifyAction} className="mt-8 animate-rise space-y-4">
          <input type="hidden" name="email" value={sent.email} />
          <p className="text-sm text-mute">
            Email envoyé à <span className="text-paper">{sent.email}</span>. Entre le code reçu, ou clique sur le lien de
            l&apos;email : ton arc t&apos;attendra.
          </p>
          <label className="block">
            <span className="text-sm text-mute">Code à 6 chiffres</span>
            <input
              name="token"
              required
              autoFocus
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9 ]{6,12}"
              maxLength={12}
              placeholder="123456"
              className={`${input} mt-2 font-serif text-3xl tracking-[0.3em]`}
            />
          </label>
          <SubmitButton className={btnPrimary} pendingLabel="Vérification…">
            Continuer
          </SubmitButton>
          <FormMessage message={checked.message} />
          <button type="button" onClick={() => setDismissed(sent)} className={btnLink}>
            Changer d&apos;adresse ou renvoyer l&apos;email
          </button>
        </form>
      )}
      <button type="button" onClick={onBack} className={`${btnLink} mt-8 self-start`}>
        Revenir aux plans
      </button>
    </div>
  );
}

export function Quiz({
  loggedIn,
  hasProfile,
  pseudo: profilePseudo,
  today,
  collectiveStarts,
  arcNumber,
  plans,
  currentPlan,
  initialPlan,
  arts,
  templates,
  proofSlot,
  faqSlot,
}: Props) {
  const steps = useMemo(
    () =>
      [
        "situation",
        "objectif",
        "phrase",
        "faiblesses",
        "science",
        "reveil",
        "focus",
        "pompes",
        "depart",
        "engagement",
        ...(hasProfile ? [] : ["pseudo"]),
      ] as const,
    [hasProfile],
  );
  const [stage, setStage] = useState<Stage>("questions");
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [choice, setChoice] = useState<{ plan: PlanId; interval: Interval }>({ plan: initialPlan === "pro" ? "pro" : "arc", interval: initialPlan === "pro" ? "year" : "once" });
  const [pending, startTransition] = useTransition();
  const [plansVisible, setPlansVisible] = useState(false);
  const plansRef = useRef<HTMLDivElement>(null);
  const advance = useRef<number | null>(null);

  const [d, setD] = useState<Draft>({
    category: null,
    goalType: null,
    goal: "",
    goalTarget: "",
    goalUnit: "",
    goalPublic: true,
    weakPoints: [],
    wakeTime: "07:00",
    pushups: null,
    focusMinutes: 50,
    start: "today",
    customDate: addDays(today, 1),
    commitment: null,
    pseudo: "",
    isPublic: true,
  });
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setD((prev) => ({ ...prev, [key]: value }));
  // Dernières réponses, pour les actions déclenchées après un court délai (choix unique).
  const latest = useRef(d);
  useEffect(() => {
    latest.current = d;
  });

  const step = steps[index];
  const goalInfo = GOAL_TYPES.find((g) => g.value === d.goalType);
  const answers = toAnswers(d);
  const answersJson = JSON.stringify(answers);
  const startDate =
    answers.start === "today"
      ? today
      : answers.start === "tomorrow"
        ? addDays(today, 1)
        : answers.start === "monday"
          ? nextMonday(today)
          : answers.start.startsWith("squad:")
            ? (collectiveStarts.find((c) => `squad:${c.id}` === answers.start)?.start_date ?? today)
            : d.customDate;
  const endDate = addDays(startDate, 89);
  const name = profilePseudo ?? (d.pseudo || null);

  // Bouton fixe en bas de l'écran des résultats, tant que les plans ne sont pas à l'écran.
  useEffect(() => {
    const el = plansRef.current;
    if (stage !== "result" || !el) return;
    const observer = new IntersectionObserver(([entry]) => setPlansVisible(Boolean(entry?.isIntersecting)), { threshold: 0.05 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [stage]);

  useEffect(() => () => {
    if (advance.current) window.clearTimeout(advance.current);
  }, []);

  function check(): string | null {
    if (step === "situation" && !d.category) return "Choisis ce qui te ressemble le plus.";
    if (step === "objectif" && !d.goalType) return "Choisis ton objectif.";
    if (step === "phrase") {
      if (d.goal.trim().length < 3) return "Écris ton objectif en une phrase.";
      if (d.goalTarget && !(Number(d.goalTarget.replace(",", ".")) > 0)) return "Le chiffre de ton objectif doit être positif.";
    }
    if (step === "pompes" && !d.pushups) return "Réponds à la question.";
    if (step === "depart" && d.start === "date" && (d.customDate < today || d.customDate > addDays(today, 120))) {
      return "Choisis une date dans les 4 prochains mois.";
    }
    if (step === "engagement" && !d.commitment) return "Choisis une réponse.";
    if (step === "pseudo" && !/^[a-z0-9_]{3,20}$/.test(d.pseudo)) return "Pseudo : 3 à 20 caractères, en minuscules, chiffres ou _.";
    return null;
  }

  function build() {
    setStage("building");
    setPreview(null);
    setBuildError(null);
    window.scrollTo({ top: 0 });
    void previewArc(JSON.stringify(toAnswers(latest.current))).then((r) => {
      if ("error" in r) setBuildError(r.error);
      else setPreview(r);
    });
  }

  function next() {
    const problem = check();
    setError(problem);
    if (problem) return;
    if (index === steps.length - 1) build();
    else setIndex(index + 1);
  }

  /** Choix unique : on montre la sélection un court instant, puis on avance. */
  function pick(update: () => void) {
    update();
    setError(null);
    if (advance.current) window.clearTimeout(advance.current);
    const at = index;
    advance.current = window.setTimeout(() => {
      if (at === steps.length - 1) build();
      else setIndex(at + 1);
    }, 260);
  }

  function back() {
    setError(null);
    if (stage === "account") setStage("result");
    else if (index > 0) setIndex(index - 1);
  }

  function choose(plan: PlanId, interval: Interval) {
    setChoice({ plan, interval });
    if (!loggedIn) {
      setStage("account");
      window.scrollTo({ top: 0 });
      return;
    }
    startTransition(async () => {
      const r = await continueWithPlan(answersJson, plan, interval);
      if (r?.error) setError(r.error);
    });
  }

  const priceOf = (plan: PlanId, interval: Interval): number =>
    plan === "arc" ? plans.arc.once : plan === "fondateur" ? plans.fondateur.lifetime : interval === "month" ? plans.pro.month : plans.pro.year;

  const weakLabels = d.weakPoints.map((w) => WEAK_POINTS.find((x) => x.value === w)?.label.toLowerCase()).filter(Boolean);
  const buildSteps = [
    `Lecture de ton objectif : « ${answers.goal.length > 38 ? `${answers.goal.slice(0, 38)}…` : answers.goal} »`,
    `${preview?.templates ?? templates} principes passés au crible`,
    d.weakPoints.length ? `Ciblage de tes ${d.weakPoints.length > 1 ? `${d.weakPoints.length} points faibles` : "point faible"}` : "Ciblage de ton profil",
    "Difficulté calculée pour chaque principe",
    `Calendrier : du ${formatDayFr(startDate, { year: false })} au ${formatDayFr(endDate, { year: false })}`,
  ];

  // ---------------------------------------------------------------------------
  if (stage === "building") {
    return (
      <div className="min-h-dvh grain">
        <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pt-6 pb-14">
          <Logo size="sm" />
          {buildError ? (
            <div className="my-auto">
              <p role="alert">{buildError}</p>
              <button type="button" onClick={build} className={`${btnPrimary} mt-6`}>
                Réessayer
              </button>
              <button type="button" onClick={() => setStage("questions")} className={`${btnLink} mt-5`}>
                Revenir aux questions
              </button>
            </div>
          ) : (
            <Building ready={Boolean(preview)} steps={buildSteps} onDone={() => setStage("result")} />
          )}
        </div>
      </div>
    );
  }

  if (stage === "account") {
    return (
      <div className="min-h-dvh grain">
        <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pt-6 pb-14">
          <Logo size="sm" />
          <AccountStep answers={answersJson} plan={choice.plan} interval={choice.interval} price={priceOf(choice.plan, choice.interval)} onBack={back} />
        </div>
      </div>
    );
  }

  if (stage === "result" && preview) {
    const commitment = COMMITMENTS.find((c) => c.value === d.commitment);
    const stickyPlan: PlanId = initialPlan === "pro" ? "pro" : "arc";
    return (
      <div className="min-h-dvh">
        <main className="mx-auto w-full max-w-xl px-5 pt-6 pb-32">
          <Logo size="sm" />

          <section className="pt-12">
            <p className="animate-rise">
              <Hand className="text-4xl">{name ? `${name},` : "Voilà,"}</Hand>
            </p>
            <h1 className="mt-3 animate-rise font-serif text-6xl leading-[0.9] [animation-delay:120ms]">
              ton arc est{" "}
              <span className="relative inline-block">
                prêt.
                <svg aria-hidden="true" viewBox="0 0 200 12" preserveAspectRatio="none" className="absolute -bottom-2 left-0 h-3 w-full">
                  <path d="M2 8 C 40 3, 90 2, 130 5 S 185 9, 198 4" pathLength="1" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="stroke-draw [animation-delay:700ms]" />
                </svg>
              </span>
            </h1>
            {commitment ? <p className="mt-6 animate-rise text-lg text-paper/85 [animation-delay:240ms]">{commitment.echo}</p> : null}
          </section>

          <section className="mt-10 animate-rise border border-line bg-surface p-5 grain [animation-delay:300ms]">
            <p className={label}>
              Arc n° {arcNumber} · {GOAL_LABEL[answers.goalType]}
            </p>
            <p className="mt-3 font-serif text-3xl leading-tight">{answers.goal}</p>
            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4 text-sm">
              <div>
                <p className="text-xs text-mute">Jour 1</p>
                <p className="mt-1">{formatDayFr(startDate, { weekday: true, year: false })}</p>
              </div>
              <div>
                <p className="text-xs text-mute">Jour 90</p>
                <p className="mt-1">{formatDayFr(endDate, { weekday: true })}</p>
              </div>
            </div>
          </section>

          <section className="mt-12">
            <div className="flex items-end justify-between gap-4">
              <h2 className="font-serif text-4xl leading-none">Tes {preview.principles.length} principes</h2>
              <p className="text-right text-xs text-mute">
                choisis parmi {preview.templates}
                <br />
                pour toi
              </p>
            </div>
            {weakLabels.length ? (
              <p className="mt-3 text-sm text-mute">Construits pour ton objectif et pour ce qui te fait décrocher : {weakLabels.join(", ")}.</p>
            ) : null}
            <ol className="mt-6 space-y-3">
              {preview.principles.map((p, i) => (
                <li key={p.code} className={`animate-rise border border-line p-4 ${STAGGER[i + 2] ?? ""}`}>
                  <div className="flex items-center justify-between gap-3 text-[11px] tracking-[0.15em] text-mute uppercase">
                    <span>{PILLAR_LABEL[p.pillar]}</span>
                    <span className="flex items-center gap-2 normal-case tracking-normal">
                      {PROOF_LABEL[p.proof_type]}
                      <span aria-label={`difficulté ${p.difficulty} sur 3`} className="flex gap-0.5">
                        {[1, 2, 3].map((n) => (
                          <span key={n} className={`size-1.5 rounded-full ${n <= p.difficulty ? "bg-paper" : "bg-line"}`} />
                        ))}
                      </span>
                    </span>
                  </div>
                  <p className="mt-2 leading-snug">
                    <span className="text-mute">{p.if_text},</span> {p.then_text}
                  </p>
                  <details className="group mt-2">
                    <summary className="cursor-pointer list-none text-xs text-mute underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden">
                      Pourquoi ça marche
                    </summary>
                    <p className="mt-2 animate-rise text-xs leading-relaxed text-paper/75">
                      {p.why} <span className="text-mute">({p.source})</span>
                    </p>
                  </details>
                </li>
              ))}
            </ol>
            <p className="mt-5 flex items-center gap-2 text-mute">
              <HandArrow className="-scale-y-100 rotate-180" />
              <Hand className="text-2xl">tout reste modifiable, même après le départ</Hand>
            </p>
          </section>

          <section className="mt-14 animate-rise">
            <p className={label}>Tes stats au jour 1</p>
            <div className="mt-4 grid grid-cols-3 gap-x-5 gap-y-4">
              {["Discipline", "Focus", "Business", "Corps", "Esprit", "Énergie"].map((s) => (
                <div key={s}>
                  <p className="text-[10px] tracking-[0.12em] text-mute uppercase">{s}</p>
                  <p className="mt-0.5 font-serif text-2xl leading-none">0</p>
                  <span className="mt-1.5 block h-1 w-full bg-line" />
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-mute">
              Chaque preuve les fait monter. Au jour 90, <Hand className="text-xl text-paper">à toi de les maxer</Hand>.
            </p>
          </section>

          <section className="mt-16">{proofSlot}</section>

          <section ref={plansRef} id="plans" className="mt-16 scroll-mt-6">
            <Hand className="text-3xl text-mute">plus qu&apos;une étape</Hand>
            <h2 className="mt-2 font-serif text-5xl leading-[0.95]">Lance ton arc.</h2>
            <p className="mt-4 text-paper/85">
              Ton arc est construit. Payer, c&apos;est le premier engagement : un arc gratuit se lâche au premier soir difficile.
            </p>
            {error ? (
              <p role="alert" className="mt-4 text-sm">
                {error}
              </p>
            ) : null}
            <div className={`mt-8 ${pending ? "pointer-events-none opacity-60" : ""}`}>
              <PlanPicker plans={plans} current={currentPlan} mode={{ kind: "choose", onChoose: choose }} />
            </div>
            <ul className="mt-6 space-y-2 text-xs text-mute">
              <li>Paiement sécurisé par Stripe. Nonante ne voit jamais ta carte.</li>
              <li>Arc 90 jours : un seul paiement, rien ne se renouvelle tout seul.</li>
              <li>14 jours pour te rétracter (au prorata des jours utilisés).</li>
            </ul>
          </section>

          <section className="mt-16">
            <h2 className="font-serif text-3xl">Tes questions</h2>
            <div className="mt-5">{faqSlot}</div>
          </section>

          <button type="button" onClick={() => setStage("questions")} className={`${btnLink} mt-10`}>
            Modifier mes réponses
          </button>
        </main>

        {currentPlan !== "pro" && currentPlan !== "fondateur" ? (
          <div
            className={`fixed inset-x-0 bottom-0 z-20 border-t border-line bg-ink/95 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur transition-transform duration-300 ${plansVisible ? "translate-y-full" : "translate-y-0"}`}
          >
            <div className="mx-auto flex max-w-xl items-center gap-4">
              <div className="min-w-0 flex-1 text-xs text-mute">
                <span className="block text-sm text-paper">{PLAN_NAME[stickyPlan]}</span>
                {stickyPlan === "arc" ? `${formatEuros(plans.arc.once)} une fois · ${perDay(plans.arc.once)} par jour` : priceLabel(plans.pro.year, "year")}
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => choose(stickyPlan, stickyPlan === "arc" ? "once" : "year")}
                className="inline-flex h-12 shrink-0 items-center justify-center rounded-xs bg-paper px-5 text-sm font-medium text-ink transition-transform active:scale-[0.97] disabled:opacity-50"
              >
                Lancer mon arc
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Questions
  const art = arts[Math.min(Math.floor(index / 2), arts.length - 1)] ?? null;
  const single = ["situation", "objectif", "focus", "pompes", "engagement"].includes(step) || (step === "depart" && d.start !== "date");

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <Backdrop art={art} />
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pt-6 pb-12">
        <div className="flex items-center gap-4">
          {index > 0 ? (
            <button type="button" onClick={back} aria-label="Question précédente" className="-ml-2 grid size-9 place-items-center text-mute hover:text-paper">
              <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
                <path d="M10 3 L5 8 L10 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : (
            <Link href="/" aria-label="Nonante, accueil">
              <Logo size="sm" />
            </Link>
          )}
          <div className="flex flex-1 gap-1" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={index + 1} aria-label="Progression">
            {steps.map((s, i) => (
              <span key={s} className={`h-0.5 flex-1 transition-colors duration-500 ${i <= index ? "bg-paper" : "bg-line"}`} />
            ))}
          </div>
        </div>

        <div key={step} className="my-auto py-10">
          {step === "situation" ? (
            <>
              <Hand className="animate-rise text-2xl text-mute">{arcNumber > 1 ? `arc n° ${arcNumber}, on y va` : "2 minutes, promis"}</Hand>
              <h1 className="mt-3 animate-rise font-serif text-5xl leading-[0.95] [animation-delay:60ms]">Tu es…</h1>
              <div className="mt-8 space-y-3">
                {SITUATIONS.map((s, i) => (
                  <Choice key={s.value} index={i + 1} selected={d.category === s.value} onClick={() => pick(() => set("category", s.value))}>
                    <span className="block font-medium">{s.label}</span>
                    <span className={`mt-1 block text-sm ${d.category === s.value ? "text-ink/70" : "text-mute"}`}>{s.hint}</span>
                  </Choice>
                ))}
              </div>
            </>
          ) : null}

          {step === "objectif" ? (
            <>
              <h1 className="animate-rise font-serif text-5xl leading-[0.95]">
                Dans 90 jours, tu veux…
              </h1>
              <Hand className="mt-3 animate-rise text-2xl text-mute [animation-delay:80ms]">un seul objectif, celui qui compte</Hand>
              <div className="mt-8 space-y-2">
                {GOAL_TYPES.map((g, i) => (
                  <Choice
                    key={g.value}
                    index={i + 1}
                    selected={d.goalType === g.value}
                    onClick={() =>
                      pick(() =>
                        setD((prev) => ({
                          ...prev,
                          goalType: g.value,
                          goalUnit: !prev.goalUnit || GOAL_TYPES.some((x) => x.unit === prev.goalUnit) ? (g.unit ?? "") : prev.goalUnit,
                        })),
                      )
                    }
                  >
                    <span className="text-sm">{g.label}</span>
                  </Choice>
                ))}
              </div>
            </>
          ) : null}

          {step === "phrase" ? (
            <>
              <h1 className="animate-rise font-serif text-5xl leading-[0.95]">Écris-le.</h1>
              <Hand className="mt-3 animate-rise text-2xl text-mute [animation-delay:80ms]">un chiffre, une date : impossible à ignorer</Hand>
              <div className="mt-8 animate-rise space-y-4 [animation-delay:140ms]">
                <label className="block">
                  <span className={label}>Ton objectif en une phrase</span>
                  <textarea
                    value={d.goal}
                    onChange={(e) => set("goal", e.target.value.slice(0, 120))}
                    rows={2}
                    autoFocus
                    placeholder={goalInfo?.example}
                    className={`${input} mt-2 h-auto py-3`}
                  />
                </label>
                <div className="grid grid-cols-[1fr_7rem] gap-3">
                  <label className="block">
                    <span className={label}>Chiffre (facultatif)</span>
                    <input
                      value={d.goalTarget}
                      onChange={(e) => set("goalTarget", e.target.value.replace(/[^\d,.]/g, "").slice(0, 12))}
                      inputMode="decimal"
                      placeholder={d.goalType === "revenu" ? "3000" : "10"}
                      className={`${input} mt-2`}
                    />
                  </label>
                  <label className="block">
                    <span className={label}>Unité</span>
                    <input value={d.goalUnit} onChange={(e) => set("goalUnit", e.target.value.slice(0, 20))} placeholder="€" className={`${input} mt-2`} />
                  </label>
                </div>
                <label className="flex items-start gap-3 text-sm">
                  <input type="checkbox" checked={d.goalPublic} onChange={(e) => set("goalPublic", e.target.checked)} className="mt-0.5 size-5 accent-paper" />
                  Afficher mon objectif sur mon profil. Le dire, c&apos;est déjà s&apos;engager.
                </label>
              </div>
            </>
          ) : null}

          {step === "faiblesses" ? (
            <>
              <h1 className="animate-rise font-serif text-5xl leading-[0.95]">Où est-ce que tu décroches ?</h1>
              <Hand className="mt-3 animate-rise text-2xl text-mute [animation-delay:80ms]">sois honnête, personne ne regarde</Hand>
              <div className="mt-8 space-y-2">
                {WEAK_POINTS.map((w, i) => (
                  <Choice
                    key={w.value}
                    index={i + 1}
                    selected={d.weakPoints.includes(w.value)}
                    onClick={() => set("weakPoints", d.weakPoints.includes(w.value) ? d.weakPoints.filter((x) => x !== w.value) : [...d.weakPoints, w.value])}
                  >
                    <span className="text-sm">{w.label}</span>
                  </Choice>
                ))}
              </div>
            </>
          ) : null}

          {step === "science" ? (
            <>
              <Hand underline className="animate-rise text-3xl">
                bonne nouvelle
              </Hand>
              <h1 className="mt-5 animate-rise font-serif text-5xl leading-[0.95] [animation-delay:80ms]">Ça se travaille.</h1>
              <p className="mt-5 animate-rise text-lg leading-relaxed text-paper/85 [animation-delay:160ms]">
                {d.weakPoints.length
                  ? "Tout le monde décroche quelque part. Ce qui marche le mieux : décider à l'avance quoi faire dans la situation qui te fait lâcher."
                  : "Ce qui marche le mieux pour tenir un objectif : décider à l'avance quoi faire, dans quelle situation."}
              </p>
              <blockquote className="mt-8 animate-rise border-l-2 border-paper pl-4 font-serif text-2xl leading-snug [animation-delay:240ms]">
                {IF_THEN_EXAMPLE[d.weakPoints[0] ?? "procrastination"]}
              </blockquote>
              <div className="mt-10 grid animate-rise grid-cols-[5rem_1fr] items-start gap-4 border-t border-line pt-6 [animation-delay:320ms]">
                <p className="font-serif text-6xl leading-none">94</p>
                <div>
                  <p className="text-sm text-paper/90">
                    études le montrent : les plans « si… alors… » augmentent nettement les chances d&apos;atteindre un objectif. Tous
                    tes principes seront écrits comme ça.
                  </p>
                  <p className="mt-1.5 text-[11px] text-mute">Gollwitzer et Sheeran, 2006</p>
                </div>
              </div>
            </>
          ) : null}

          {step === "reveil" ? (
            <>
              <h1 className="animate-rise font-serif text-5xl leading-[0.95]">Tu te lèves à quelle heure ?</h1>
              <Hand className="mt-3 animate-rise text-2xl text-mute [animation-delay:80ms]">tous les jours, week-end compris</Hand>
              <div className="mt-8 grid animate-rise grid-cols-4 gap-2 [animation-delay:140ms]">
                {WAKE_TIMES.filter((t) => t >= "05:00" && t <= "09:00").map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={d.wakeTime === t}
                    onClick={() => set("wakeTime", t)}
                    className={`h-11 rounded-xs border text-sm tabular-nums transition-colors ${d.wakeTime === t ? "border-paper bg-paper text-ink" : "border-line bg-ink/60 hover:border-mute"}`}
                  >
                    {timeFr(t)}
                  </button>
                ))}
              </div>
              <label className="mt-4 block text-xs text-mute">
                Autre heure :{" "}
                <select value={d.wakeTime} onChange={(e) => set("wakeTime", e.target.value)} className="ml-1 border-b border-line bg-transparent text-paper">
                  {WAKE_TIMES.map((t) => (
                    <option key={t} value={t} className="bg-ink">
                      {timeFr(t)}
                    </option>
                  ))}
                </select>
              </label>
              <p className="mt-6 text-sm text-mute">Tu le prouveras avec un code à recopier au réveil. Impossible de tricher depuis ton lit.</p>
            </>
          ) : null}

          {step === "focus" ? (
            <>
              <h1 className="animate-rise font-serif text-5xl leading-[0.95]">Concentré, sans téléphone, tu tiens…</h1>
              <Hand className="mt-3 animate-rise text-2xl text-mute [animation-delay:80ms]">sois réaliste, ça montera</Hand>
              <div className="mt-8 space-y-2">
                {FOCUS.map((f, i) => (
                  <Choice key={f.value} index={i + 1} selected={d.focusMinutes === f.value} onClick={() => pick(() => set("focusMinutes", f.value))}>
                    <span className="block text-sm font-medium">{f.label}</span>
                    <span className={`mt-0.5 block text-xs ${d.focusMinutes === f.value ? "text-ink/60" : "text-mute"}`}>{f.hint}</span>
                  </Choice>
                ))}
              </div>
            </>
          ) : null}

          {step === "pompes" ? (
            <>
              <h1 className="animate-rise font-serif text-5xl leading-[0.95]">Des pompes, tu en fais ?</h1>
              <Hand className="mt-3 animate-rise text-2xl text-mute [animation-delay:80ms]">la caméra les comptera pour toi</Hand>
              <div className="mt-8 space-y-2">
                {PUSHUPS.map((p, i) => (
                  <Choice key={p.value} index={i + 1} selected={d.pushups === p.value} onClick={() => pick(() => set("pushups", p.value))}>
                    <span className="block text-sm font-medium">{p.label}</span>
                    <span className={`mt-0.5 block text-xs ${d.pushups === p.value ? "text-ink/60" : "text-mute"}`}>{p.hint}</span>
                  </Choice>
                ))}
              </div>
            </>
          ) : null}

          {step === "depart" ? (
            <>
              <h1 className="animate-rise font-serif text-5xl leading-[0.95]">Ton jour 1.</h1>
              <Hand className="mt-3 animate-rise text-2xl text-mute [animation-delay:80ms]">le plus tôt est le mieux</Hand>
              <div className="mt-8 space-y-2">
                <Choice index={1} selected={d.start === "today"} onClick={() => pick(() => set("start", "today"))}>
                  <span className="text-sm">Aujourd&apos;hui</span>
                </Choice>
                <Choice index={2} selected={d.start === "tomorrow"} onClick={() => pick(() => set("start", "tomorrow"))}>
                  <span className="text-sm">Demain</span>
                </Choice>
                <Choice index={3} selected={d.start === "monday"} onClick={() => pick(() => set("start", "monday"))}>
                  <span className="block text-sm">Lundi prochain · {formatDayFr(nextMonday(today), { year: false })}</span>
                  <span className={`mt-0.5 block text-xs ${d.start === "monday" ? "text-ink/60" : "text-mute"}`}>
                    Un nouveau départ aide à s&apos;y mettre (Dai, Milkman et Riis, 2014).
                  </span>
                </Choice>
                {collectiveStarts.map((c, i) => (
                  <Choice key={c.id} index={4 + i} selected={d.start === `squad:${c.id}`} onClick={() => pick(() => set("start", `squad:${c.id}`))}>
                    <span className="block text-sm">Départ collectif · {formatDayFr(c.start_date)}</span>
                    <span className={`mt-0.5 block text-xs ${d.start === `squad:${c.id}` ? "text-ink/60" : "text-mute"}`}>
                      {c.name}
                      {c.members >= 10 ? ` · ${c.members.toLocaleString("fr-FR")} inscrits` : ""}
                    </span>
                  </Choice>
                ))}
                <Choice index={5 + collectiveStarts.length} selected={d.start === "date"} onClick={() => set("start", "date")}>
                  <span className="text-sm">Une autre date</span>
                </Choice>
                {d.start === "date" ? (
                  <input
                    type="date"
                    value={d.customDate}
                    min={today}
                    max={addDays(today, 120)}
                    onChange={(e) => set("customDate", e.target.value)}
                    className={`${input} mt-2 animate-rise`}
                  />
                ) : null}
              </div>
            </>
          ) : null}

          {step === "engagement" ? (
            <>
              <h1 className="animate-rise font-serif text-5xl leading-[0.95]">Et toi, tu en es où ?</h1>
              <Hand className="mt-3 animate-rise text-2xl text-mute [animation-delay:80ms]">pas de mauvaise réponse</Hand>
              <div className="mt-8 space-y-2">
                {COMMITMENTS.map((c, i) => (
                  <Choice key={c.value} index={i + 1} selected={d.commitment === c.value} onClick={() => pick(() => set("commitment", c.value))}>
                    <span className="text-sm">{c.label}</span>
                  </Choice>
                ))}
              </div>
            </>
          ) : null}

          {step === "pseudo" ? (
            <>
              <h1 className="animate-rise font-serif text-5xl leading-[0.95]">Ton nom de joueur.</h1>
              <Hand className="mt-3 animate-rise text-2xl text-mute [animation-delay:80ms]">il sera sur ta carte et au classement</Hand>
              <div className="mt-8 animate-rise space-y-5 [animation-delay:140ms]">
                <input
                  value={d.pseudo}
                  onChange={(e) => set("pseudo", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20))}
                  autoComplete="username"
                  autoCapitalize="none"
                  autoFocus
                  placeholder="antoine_h"
                  className={`${input} font-serif text-2xl`}
                />
                <label className="flex items-start gap-3 text-sm">
                  <input type="checkbox" checked={d.isPublic} onChange={(e) => set("isPublic", e.target.checked)} className="mt-0.5 size-5 accent-paper" />
                  Apparaître au classement avec mon pseudo (sinon : « Anonyme »).
                </label>
              </div>
            </>
          ) : null}

          {error ? (
            <p role="alert" className="mt-6 animate-rise text-sm">
              {error}
            </p>
          ) : null}
        </div>

        {single ? (
          <p className="text-center text-xs text-mute">Touche une réponse pour continuer.</p>
        ) : (
          <button type="button" onClick={next} className={btnPrimary}>
            {index === steps.length - 1 ? "Construire mon arc" : step === "science" ? "Compris, on continue" : "Continuer"}
          </button>
        )}
      </div>
    </div>
  );
}
