"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { flushSync } from "react-dom";
import { trackEvent } from "@/lib/track";
import { ExitSurvey } from "@/components/ExitSurvey";
import { continueWithGoogle, continueWithPlan, previewArc } from "@/app/actions/onboarding";
import { ActivityRings, type RingTone } from "@/components/ActivityRings";
import { Aura, type AuraTone } from "@/components/Aura";
import { GoogleLabel, googleButtonClass } from "@/components/GoogleButton";
import { useI18n } from "@/components/I18nProvider";
import { Logo } from "@/components/Logo";
import { PlanPicker } from "@/components/PlanPicker";
import { ProofIcon } from "@/components/ProofIcon";
import { FormMessage } from "@/components/SubmitButton";
import { addDays, type ArcAnswers, BUSINESS_TYPES, COMMITMENT_KEYS, nextMonday, SCHOOLS } from "@/lib/answers";
import { fmt, formatDay, formatMoney, formatNumber, formatTime } from "@/lib/i18n/format";
import { bareThen } from "@/lib/i18n/labels";
import type { Category, GoalType, Interval, PlanId, Preview, ProofType, PublicPlans } from "@/lib/types";
import { btnLink, btnPrimary, btnSecondary, input, label } from "@/lib/ui";

export type CollectiveStart = { id: string; name: string; start_date: string; members: number; official: boolean; category: Category | null };

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
  templates: number;
  invitedBy: string | null;
  proofSlot: React.ReactNode;
  founderSlot: React.ReactNode;
  faqSlot: React.ReactNode;
};

type Stage = "intro" | "questions" | "building" | "result" | "account";
type Business = (typeof BUSINESS_TYPES)[number];
type School = (typeof SCHOOLS)[number];
type Sport = "oui" | "quelques" | "non";
type WeakPoint = ArcAnswers["weakPoints"][number];

const WAKE_TIMES = Array.from({ length: 25 }, (_, i) => {
  const minutes = 4 * 60 + i * 15;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});
const SITUATIONS: Category[] = ["etudes", "business", "mixte"];
const GOALS: GoalType[] = ["revenu", "clients", "lancement", "audience", "examens", "corps", "autre"];
const GOALS_STUDENT: GoalType[] = ["examens", "lancement", "audience", "revenu", "clients", "corps", "autre"];
const WEAK: WeakPoint[] = ["telephone", "procrastination", "vente", "dispersion", "reveil", "sport", "regularite"];
const FOCUS = [25, 50, 90] as const;
const SPORT: Sport[] = ["oui", "quelques", "non"];
const STATS = ["discipline", "focus", "business", "corps", "esprit", "energie"] as const;
const STAT_TONES: Record<(typeof STATS)[number], RingTone> = { discipline: "sky", focus: "blue", business: "mint", corps: "amber", esprit: "violet", energie: "rose" };
// Une teinte d'aura par question : elle glisse en fondu de l'une à l'autre.
const TONES: AuraTone[] = ["rose", "violet", "sky", "mint", "amber"];
// Barre de progression : largeurs écrites en entier pour Tailwind (pas de style en ligne, CSP stricte).
const PROGRESS = ["w-[5%]", "w-[10%]", "w-[15%]", "w-[20%]", "w-[25%]", "w-[30%]", "w-[35%]", "w-[40%]", "w-[45%]", "w-[50%]", "w-[55%]", "w-[60%]", "w-[65%]", "w-[70%]", "w-[75%]", "w-[80%]", "w-[85%]", "w-[90%]", "w-[95%]", "w-full"];
// Délais d'apparition en cascade (classes écrites en entier pour Tailwind).
const STAGGER = ["", "[animation-delay:40ms]", "[animation-delay:80ms]", "[animation-delay:120ms]", "[animation-delay:160ms]", "[animation-delay:200ms]", "[animation-delay:240ms]", "[animation-delay:280ms]", "[animation-delay:320ms]", "[animation-delay:360ms]"];
const INTRO_PROOFS: ProofType[] = ["session", "reps", "reveil", "photo", "lien"];
const INTRO_PILLARS = ["focus", "corps", "energie", "esprit", "business"] as const;

type Draft = {
  category: Category | null;
  businessTypes: Business[];
  businessOther: string;
  school: School | null;
  schoolOther: string;
  goalType: GoalType | null;
  goal: string;
  goalTarget: string;
  goalUnit: string;
  goalPublic: boolean;
  weakPoints: WeakPoint[];
  wakeTime: string;
  pushups: Sport | null;
  focusMinutes: 25 | 50 | 90;
  start: string;
  customDate: string;
  commitment: (typeof COMMITMENT_KEYS)[number] | null;
  pseudo: string;
  isPublic: boolean;
};

const hasBusiness = (c: Category | null) => c === "business" || c === "mixte";
const hasSchool = (c: Category | null) => c === "etudes" || c === "mixte";
/** Trading seul : pas de clients à prospecter. */
const tradingOnly = (types: Business[]) => types.length > 0 && types.every((t) => t === "trading");

type Doc = Document & { startViewTransition?: (update: () => void) => unknown };

/** Le navigateur sait animer le passage d'un écran à l'autre (View Transitions), et l'utilisateur garde les animations. */
const noSubscribe = () => () => {};

function canAnimateScreens(): boolean {
  return typeof document !== "undefined" && "startViewTransition" in document && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Changement d'écran animé : l'ancienne question glisse et s'efface pendant que la nouvelle arrive
 * (transform et opacité seulement, sur le GPU). Sans View Transitions, l'écran change directement.
 */
function withTransition(dir: "forward" | "back", update: () => void) {
  if (!canAnimateScreens()) {
    update();
    return;
  }
  document.documentElement.dataset.nav = dir;
  const vt = (document as Doc).startViewTransition!(() => flushSync(update)) as { ready?: Promise<unknown>; finished?: Promise<unknown> } | undefined;
  // Transition sautée (deux touchers très rapprochés) : l'écran change quand même, sans animation.
  vt?.ready?.catch(() => {});
  vt?.finished?.catch(() => {});
}

function toAnswers(d: Draft): ArcAnswers {
  const target = d.goalTarget.replace(/\s/g, "").replace(",", ".");
  const business = hasBusiness(d.category) ? d.businessTypes : [];
  const school = hasSchool(d.category) ? d.school : null;
  return {
    category: d.category ?? "business",
    goalType: d.goalType ?? "autre",
    goal: d.goal.trim(),
    goalTarget: target && Number(target) > 0 ? Number(target) : null,
    goalUnit: d.goalUnit.trim() || null,
    goalPublic: d.goalPublic,
    weakPoints: tradingOnly(business) ? d.weakPoints.filter((w) => w !== "vente") : d.weakPoints,
    businessTypes: business,
    businessOther: business.includes("autre") ? d.businessOther.trim() || null : null,
    school,
    schoolOther: school === "autre" ? d.schoolOther.trim() || null : null,
    wakeTime: d.wakeTime,
    pushups: d.pushups ?? "non",
    focusMinutes: d.focusMinutes,
    start: d.start === "date" ? `date:${d.customDate}` : d.start,
    commitment: d.commitment,
    pseudo: d.pseudo || null,
    isPublic: d.isPublic,
  };
}

const vibrate = () => {
  if (typeof navigator !== "undefined") navigator.vibrate?.(8);
};

function Check({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={`${className} animate-tick`} aria-hidden="true">
      <path d="M3 8.5 L6.5 12 L13 4.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Réponse en carte : verre au repos, pilule blanche une fois choisie (coche qui apparaît). */
function Choice({ selected, onClick, index = 0, multi = false, children }: { selected: boolean; onClick: () => void; index?: number; multi?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => {
        vibrate();
        onClick();
      }}
      aria-pressed={selected}
      className={`press flex w-full animate-in items-center justify-between gap-3 rounded-[1.25rem] px-4 py-4 text-left ${STAGGER[Math.min(index, STAGGER.length - 1)]} ${
        selected ? "pearl" : "bg-white/[0.05] text-paper shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)] hover:bg-white/[0.08]"
      }`}
    >
      <span className="min-w-0">{children}</span>
      <span aria-hidden="true" className={`grid size-6 shrink-0 place-items-center ${multi ? "rounded-lg" : "rounded-full"} ${selected ? "bg-black text-white" : "border border-white/20"}`}>
        {selected ? <Check /> : null}
      </span>
    </button>
  );
}

/** Choix compact sur deux colonnes (activités, écoles). */
function Chip({ selected, onClick, index = 0, title, hint }: { selected: boolean; onClick: () => void; index?: number; title: string; hint?: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        vibrate();
        onClick();
      }}
      aria-pressed={selected}
      className={`press flex min-h-16 animate-in flex-col justify-center rounded-[1.25rem] px-3.5 py-3 text-left ${STAGGER[Math.min(index, STAGGER.length - 1)]} ${
        selected ? "pearl" : "bg-white/[0.05] text-paper shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)] hover:bg-white/[0.08]"
      }`}
    >
      <span className="text-sm leading-tight font-semibold">{title}</span>
      {hint ? <span className={`mt-1 text-[11px] leading-snug ${selected ? "text-black/60" : "text-mute"}`}>{hint}</span> : null}
    </button>
  );
}

/** Titre d'une question, avec sa phrase d'accroche en dégradé. */
function Question({ title, hint }: { title: string; hint?: string }) {
  return (
    <>
      {hint ? <p className="animate-in bg-linear-to-r from-[#b79bff] to-[#8358e8] bg-clip-text text-[15px] font-semibold text-transparent">{hint}</p> : null}
      <h1 className="mt-2 animate-in font-display text-[34px] leading-[1.05] [animation-delay:40ms]">{title}</h1>
    </>
  );
}

/** Accueil : trois écrans qu'on fait défiler du doigt, puis on construit son arc. */
function Intro({ onStart, loggedIn }: { onStart: () => void; loggedIn: boolean }) {
  const { m } = useI18n();
  const t = m.quiz.intro;
  const track = useRef<HTMLDivElement>(null);
  const [slide, setSlide] = useState(0);

  function go(i: number) {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  const visuals = [
    <div key="rings" className="relative grid place-items-center">
      <div className="glow-rose absolute size-64 rounded-full opacity-60 blur-2xl" />
      <ActivityRings
        rings={[
          { value: 0.82, max: 1, tone: "rose" },
          { value: 0.64, max: 1, tone: "mint" },
          { value: 0.38, max: 1, tone: "sky" },
        ]}
        size={220}
        stroke={22}
        gap={5}
        label=""
        className="relative"
      />
    </div>,
    <ul key="proofs" className="w-full max-w-xs space-y-2.5">
      {INTRO_PROOFS.map((p, i) => (
        <li key={p} className={`liquid flex animate-in items-center gap-3 rounded-full py-2 pr-5 pl-2 ${STAGGER[i * 2]}`}>
          <ProofIcon proof={p} pillar={INTRO_PILLARS[i]} className="size-10" />
          <span className="text-[15px] font-medium">{m.game.proof.label[p]}</span>
        </li>
      ))}
    </ul>,
    <div key="card" className="w-full max-w-xs">
      <div className="glow-violet rounded-[2rem] p-5">
        <p className="text-[13px] font-medium text-paper/75">{t.cardLabel}</p>
        <p className="mt-2 font-display text-[22px] leading-snug">{m.quiz.science.examples.procrastination}</p>
      </div>
      <div className="mt-2.5 grid grid-cols-3 gap-2">
        {(["focus", "esprit", "energie"] as const).map((pillar, i) => (
          <span key={pillar} className={`card grid h-16 animate-in place-items-center ${STAGGER[i * 2 + 2]}`}>
            <ProofIcon proof={(["session", "declaratif", "reveil"] as const)[i]} pillar={pillar} className="size-9" />
          </span>
        ))}
      </div>
    </div>,
  ];

  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden">
      <Aura tone={TONES[(slide * 2) % TONES.length]} className="h-[34rem] opacity-60" />
      <div className="mx-auto flex w-full max-w-xl items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))]">
        <Link href="/" aria-label={m.common.homeAria}>
          <Logo size="sm" />
        </Link>
        {slide < 2 ? (
          <button type="button" onClick={onStart} className="press text-sm font-medium text-mute">
            {t.skip}
          </button>
        ) : null}
      </div>
      <div
        ref={track}
        onScroll={(e) => {
          const el = e.currentTarget;
          const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
          if (i !== slide) {
            setSlide(i);
            vibrate();
          }
        }}
        className="flex flex-1 snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {t.slides.map((s, i) => (
          <section key={i} className="flex w-full shrink-0 snap-center flex-col px-5" aria-roledescription="slide" aria-label={`${i + 1} / ${t.slides.length}`}>
            <div className="mx-auto flex w-full max-w-xl flex-1 flex-col">
              {/* Remontée quand l'écran arrive : ses animations rejouent. */}
              <div key={slide === i ? "on" : "off"} className="grid flex-1 place-items-center py-6">
                {visuals[i]}
              </div>
              <h1 className="font-display text-[38px] leading-[1.02]">{s.title}</h1>
              <p className="mt-3 text-[16px] leading-relaxed text-paper/75">{s.text}</p>
            </div>
          </section>
        ))}
      </div>
      <div className="mx-auto w-full max-w-xl px-5 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="mb-5 flex justify-center gap-1.5" aria-hidden="true">
          {t.slides.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i === slide ? "w-6 bg-paper" : "w-1.5 bg-white/25"}`} />
          ))}
        </div>
        {slide < t.slides.length - 1 ? (
          <button type="button" onClick={() => go(slide + 1)} className={btnPrimary}>
            {t.next}
          </button>
        ) : (
          <button type="button" onClick={onStart} className={btnPrimary}>
            {t.start}
          </button>
        )}
        {!loggedIn ? (
          <Link href="/login" className="mt-4 block text-center text-sm text-mute">
            {t.login}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/** Écran de construction : un vrai calcul (preview_principles) mis en scène, jamais plus long que nécessaire. */
function Building({ ready, steps, onDone }: { ready: boolean; steps: string[]; onDone: () => void }) {
  const { m } = useI18n();
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
        navigator.vibrate?.([10, 50, 10]);
        doneRef.current();
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const active = Math.min(steps.length - 1, Math.floor(pct / (100 / steps.length)));

  return (
    <div className="flex flex-1 flex-col justify-center py-8">
      <p className="animate-in bg-linear-to-r from-[#b79bff] to-[#8358e8] bg-clip-text text-center text-[15px] font-semibold text-transparent">{m.quiz.building.hand}</p>
      <div className="relative mx-auto mt-8 grid size-52 animate-pop place-items-center">
        <ActivityRings
          rings={[
            { value: Math.min(1, pct / 60), max: 1, tone: "rose" },
            { value: Math.max(0, Math.min(1, (pct - 20) / 60)), max: 1, tone: "mint" },
            { value: Math.max(0, Math.min(1, (pct - 40) / 60)), max: 1, tone: "sky" },
          ]}
          size={208}
          stroke={18}
          gap={4}
          label=""
          animate={false}
          className="absolute inset-0"
        />
        <p className="relative font-dot text-[44px] leading-none" aria-live="polite">
          {Math.round(pct)}
          <span className="sr-only"> {m.quiz.building.percent}</span>
        </p>
      </div>
      <ol className="mt-10 space-y-3.5">
        {steps.map((s, i) => (
          <li key={i} className={`flex items-center gap-3 text-[15px] transition-opacity duration-500 ${i <= active ? "opacity-100" : "opacity-25"}`}>
            <span className={`grid size-6 shrink-0 place-items-center rounded-full ${i < active || pct >= 100 ? "bg-ok text-black" : "bg-white/10"}`}>
              {i < active || pct >= 100 ? <Check className="size-3.5" /> : i === active ? <span className="size-1.5 animate-breathe rounded-full bg-paper" /> : null}
            </span>
            <span className={i === active && pct < 100 ? "shimmer-text" : ""}>{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Visiteur : un toucher sur Google. Les réponses partent dans un cookie et sont rangées en base au retour. */
function AccountStep({ answers, plan, interval, price, onBack }: { answers: string; plan: PlanId; interval: Interval; price: number; onBack: () => void }) {
  const { m, locale } = useI18n();
  const t = m.quiz.account;
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-1 flex-col justify-center py-10">
      <p className="animate-in bg-linear-to-r from-[#b79bff] to-[#8358e8] bg-clip-text text-[15px] font-semibold text-transparent">{t.hand}</p>
      <h1 className="mt-2 animate-in font-display text-[38px] leading-[1.02] [animation-delay:60ms]">{t.title}</h1>
      <p className="mt-4 animate-in text-paper/80 [animation-delay:120ms]">{t.text}</p>
      <div className="glow-violet mt-6 flex animate-in items-center justify-between rounded-[1.5rem] p-5 [animation-delay:180ms]">
        <span className="font-medium">{m.game.plans.name[plan]}</span>
        <span className="font-display text-[22px]">{fmt(m.game.plans.price[interval], { price: formatMoney(price, locale) })}</span>
      </div>
      <div className="mt-8 animate-in space-y-3 [animation-delay:240ms]">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await continueWithGoogle(answers, plan, interval);
              if (r?.error) setError(r.error);
            })
          }
          className={googleButtonClass}
        >
          {pending ? m.common.actions.redirecting : <GoogleLabel />}
        </button>
        <FormMessage message={error} />
        <p className="text-xs text-mute">{t.privacy}</p>
      </div>
      <button type="button" onClick={onBack} className={`${btnLink} mt-8 self-start`}>
        {t.backToPlans}
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
  templates,
  invitedBy,
  proofSlot,
  founderSlot,
  faqSlot,
}: Props) {
  const { m, locale } = useI18n();
  const q = m.quiz;
  // Premier arc d'un visiteur : l'accueil en trois écrans. Arc suivant : directement les questions.
  const [stage, setStage] = useState<Stage>(hasProfile || initialPlan ? "questions" : "intro");
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  // Rendu serveur sans View Transitions : activées seulement une fois dans le navigateur.
  const smooth = useSyncExternalStore(noSubscribe, canAnimateScreens, () => false);
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
    businessTypes: [],
    businessOther: "",
    school: null,
    schoolOther: "",
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

  // Les questions suivent le profil : activité pour les entrepreneurs, école pour les étudiants.
  // Ordre : qui tu es, ce que tu veux (et le jour 90 imaginé), ce qui te freine, comment on t'aide, ton rythme, ton départ.
  const steps = useMemo(
    () => [
      "situation",
      ...(hasBusiness(d.category) ? ["business"] : []),
      ...(hasSchool(d.category) ? ["ecole"] : []),
      "objectif",
      "phrase",
      "vision",
      "faiblesses",
      "science",
      "reveil",
      "focus",
      "sport",
      "depart",
      "engagement",
      ...(hasProfile ? [] : ["pseudo"]),
    ],
    [d.category, hasProfile],
  );

  // Dernières valeurs, pour les actions déclenchées après un court délai (choix unique).
  const latest = useRef({ d, steps });
  useEffect(() => {
    latest.current = { d, steps };
  });

  const step = steps[index];
  const answers = toAnswers(d);

  // Entonnoir du questionnaire dans Vercel Analytics : chaque écran vu (accueil, question, construction, résultat…).
  const screen = stage === "questions" ? `${index + 1}-${step}` : stage;
  useEffect(() => {
    trackEvent("questionnaire", { ecran: screen });
  }, [screen]);
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
  const onlyTrading = tradingOnly(d.businessTypes);
  const goals = (d.category === "etudes" ? GOALS_STUDENT : GOALS).filter((g) => !(onlyTrading && g === "clients"));
  const weakList = WEAK.filter((w) => !(onlyTrading && w === "vente"));

  // Bouton fixe en bas de l'écran des résultats, tant que les plans ne sont pas à l'écran.
  useEffect(() => {
    const el = plansRef.current;
    if (stage !== "result" || !el) return;
    const observer = new IntersectionObserver(([entry]) => setPlansVisible(Boolean(entry?.isIntersecting)), { threshold: 0.05 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [stage]);

  // Nouvelle question : on repart du haut (les longues listes défilent sur petit écran).
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [index, stage]);

  useEffect(
    () => () => {
      if (advance.current) window.clearTimeout(advance.current);
    },
    [],
  );

  function check(): string | null {
    if (step === "situation" && !d.category) return q.situation.error;
    if (step === "business") {
      if (!d.businessTypes.length) return q.business.error;
      if (d.businessTypes.includes("autre") && d.businessOther.trim().length < 2) return q.business.otherError;
    }
    if (step === "ecole") {
      if (!d.school) return q.school.error;
      if (d.school === "autre" && d.schoolOther.trim().length < 2) return q.school.otherError;
    }
    if (step === "objectif" && !d.goalType) return q.goal.error;
    if (step === "phrase") {
      if (d.goal.trim().length < 3) return q.phrase.error;
      if (d.goalTarget && !(Number(d.goalTarget.replace(",", ".")) > 0)) return q.phrase.targetError;
    }
    if (step === "sport" && !d.pushups) return q.sport.error;
    if (step === "depart" && d.start === "date" && (d.customDate < today || d.customDate > addDays(today, 120))) return q.start.error;
    if (step === "engagement" && !d.commitment) return q.commitment.error;
    if (step === "pseudo" && !/^[a-z0-9_]{3,20}$/.test(d.pseudo)) return q.pseudo.error;
    return null;
  }

  function build() {
    withTransition("forward", () => {
      setStage("building");
      setPreview(null);
      setBuildError(null);
    });
    previewArc(JSON.stringify(toAnswers(latest.current.d)))
      .then((r) => {
        if ("error" in r) setBuildError(r.error);
        else setPreview(r);
      })
      // Réseau coupé ou appli mise à jour pendant le calcul : on propose de réessayer au lieu de rester bloqué.
      .catch(() => setBuildError(m.common.errors.generic));
  }

  // Chaque écran est une entrée de l'historique : le geste « retour » du téléphone revient à la question précédente
  // au lieu de quitter le questionnaire.
  function remember(screen: string) {
    window.history.pushState({ ...window.history.state, nonanteQuiz: screen }, "");
  }

  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      if (advance.current) window.clearTimeout(advance.current);
      setError(null);
      const screen = (event.state as { nonanteQuiz?: string } | null)?.nonanteQuiz ?? "q0";
      withTransition("back", () => {
        setDirection("back");
        if (screen.startsWith("q")) {
          setStage("questions");
          setIndex(Math.min(Number(screen.slice(1)) || 0, latest.current.steps.length - 1));
        } else if (screen === "result") {
          setStage((s) => (s === "account" ? "result" : s));
        }
      });
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function go(to: number) {
    const dir = to > index ? "forward" : "back";
    withTransition(dir, () => {
      setDirection(dir);
      setIndex(to);
    });
    if (to > index) remember(`q${to}`);
  }

  function next() {
    const problem = check();
    setError(problem);
    if (problem) return;
    vibrate();
    if (index === steps.length - 1) build();
    else go(index + 1);
  }

  /** Choix unique : on montre la sélection un court instant, puis on avance. */
  function pick(update: () => void) {
    update();
    setError(null);
    if (advance.current) window.clearTimeout(advance.current);
    const at = index;
    advance.current = window.setTimeout(() => {
      if (at === latest.current.steps.length - 1) build();
      else {
        withTransition("forward", () => {
          setDirection("forward");
          setIndex(at + 1);
        });
        remember(`q${at + 1}`);
      }
    }, 240);
  }

  /** Flèche « retour » : même chemin que le geste du téléphone. */
  function back() {
    setError(null);
    if (advance.current) window.clearTimeout(advance.current);
    const screen = (window.history.state as { nonanteQuiz?: string } | null)?.nonanteQuiz;
    if (screen) window.history.back();
    else if (stage === "account") withTransition("back", () => setStage("result"));
    else if (index > 0) go(index - 1);
  }

  function choose(plan: PlanId, interval: Interval) {
    setChoice({ plan, interval });
    trackEvent("plan_choisi", { plan, interval, connecte: loggedIn });
    if (!loggedIn) {
      withTransition("forward", () => setStage("account"));
      remember("account");
      return;
    }
    startTransition(async () => {
      const r = await continueWithPlan(answersJson, plan, interval);
      if (r?.error) setError(r.error);
    });
  }

  function toggleBusiness(b: Business) {
    setError(null);
    setD((prev) => {
      const types = prev.businessTypes.includes(b) ? prev.businessTypes.filter((x) => x !== b) : [...prev.businessTypes, b];
      // Trading seul : l'objectif « signer des clients » n'a pas de sens.
      const goalType = tradingOnly(types) && prev.goalType === "clients" ? null : prev.goalType;
      return { ...prev, businessTypes: types, goalType };
    });
  }

  const priceOf = (plan: PlanId, interval: Interval): number =>
    plan === "arc" ? plans.arc.once : plan === "fondateur" ? plans.fondateur.lifetime : interval === "month" ? plans.pro.month : plans.pro.year;

  const weakLabels = answers.weakPoints.map((w) => m.game.weakPoints[w].toLowerCase());
  const businessLabels = answers.businessTypes.map((b) => (b === "autre" && answers.businessOther ? answers.businessOther : q.business.types[b].label.toLowerCase()));
  const schoolLabel = answers.school ? (answers.school === "autre" && answers.schoolOther ? answers.schoolOther : q.school.types[answers.school].toLowerCase()) : null;
  const shortGoal = answers.goal.length > 38 ? `${answers.goal.slice(0, 38)}…` : answers.goal;
  const buildSteps = [
    fmt(q.building.goal, { goal: shortGoal }),
    fmt(q.building.templates, { n: preview?.templates ?? templates }, locale),
    ...(businessLabels.length ? [fmt(q.building.business, { list: businessLabels.join(", ") })] : []),
    ...(schoolLabel ? [fmt(q.building.school, { school: schoolLabel })] : []),
    answers.weakPoints.length ? fmt(q.building.weak, { n: answers.weakPoints.length }, locale) : q.building.profile,
    q.building.difficulty,
    fmt(q.building.calendar, { start: formatDay(startDate, locale, { year: false }), end: formatDay(endDate, locale, { year: false }) }),
  ];

  // ---------------------------------------------------------------------------
  if (stage === "intro") {
    return (
      <Intro
        loggedIn={loggedIn}
        onStart={() => {
          vibrate();
          withTransition("forward", () => setStage("questions"));
        }}
      />
    );
  }

  if (stage === "building") {
    return (
      <div className="relative isolate min-h-dvh overflow-hidden">
        <Aura tone="violet" className="h-[36rem] opacity-60" />
        <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-14">
          <Logo size="sm" />
          {buildError ? (
            <div className="my-auto animate-in">
              <p role="alert">{buildError}</p>
              <button type="button" onClick={build} className={`${btnPrimary} mt-6`}>
                {m.common.actions.retry}
              </button>
              <button type="button" onClick={() => setStage("questions")} className={`${btnLink} mt-5`}>
                {q.building.backToQuestions}
              </button>
            </div>
          ) : (
            <Building
              ready={Boolean(preview)}
              steps={buildSteps}
              onDone={() => {
                withTransition("forward", () => setStage("result"));
                remember("result");
              }}
            />
          )}
        </div>
      </div>
    );
  }

  if (stage === "account") {
    return (
      <div className="relative isolate min-h-dvh overflow-hidden">
        <Aura tone="violet" className="h-[30rem]" />
        <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-14">
          <Logo size="sm" />
          <AccountStep answers={answersJson} plan={choice.plan} interval={choice.interval} price={priceOf(choice.plan, choice.interval)} onBack={back} />
        </div>
      </div>
    );
  }

  if (stage === "result" && preview) {
    const commitment = d.commitment ? m.game.commitments[d.commitment] : null;
    const stickyPlan: PlanId = initialPlan === "pro" ? "pro" : "arc";
    const t = q.result;
    return (
      <div className="relative isolate min-h-dvh overflow-x-clip">
        <Aura tone="violet" className="h-[34rem]" />
        <main className="mx-auto w-full max-w-xl px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-32 lg:max-w-5xl">
          <Logo size="sm" />
          {/* Demi-tour sur l'arc prêt : « Avant de partir… » (une fois par visite). */}
          <ExitSurvey place="resultat" />

          <div className="lg:grid lg:grid-cols-[1fr_1fr] lg:gap-16">
            <div>
              <section className="pt-10">
                <p className="animate-in bg-linear-to-r from-[#b79bff] to-[#8358e8] bg-clip-text text-[17px] font-semibold text-transparent">
                  {name ? fmt(t.hello, { name }) : t.helloAnon}
                </p>
                <h1 className="mt-2 animate-in font-display text-[44px] leading-[0.98] [animation-delay:100ms]">
                  {t.title} {t.titleEnd}
                </h1>
                {commitment ? <p className="mt-4 animate-in text-[17px] text-paper/80 [animation-delay:200ms]">{commitment.echo}</p> : null}
              </section>

              {/* L'arc : objectif, jour 1, jour 90. */}
              <section className="glow-violet mt-8 animate-in rounded-[2rem] p-6 [animation-delay:260ms]">
                <p className="text-[13px] font-medium text-paper/75">{fmt(t.arc, { n: arcNumber, goal: m.game.goals[answers.goalType].label })}</p>
                <p className="mt-2 font-display text-[26px] leading-tight">{answers.goal}</p>
                <div className="mt-6 flex items-center gap-3 text-sm">
                  <div>
                    <p className="text-[12px] text-paper/70">{t.day1}</p>
                    <p className="font-medium">{formatDay(startDate, locale, { weekday: true, year: false })}</p>
                  </div>
                  <span aria-hidden="true" className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-black/30">
                    <span className="absolute inset-y-0 left-0 w-1/4 animate-pulse rounded-full bg-white/70" />
                  </span>
                  <div className="text-right">
                    <p className="text-[12px] text-paper/70">{t.day90}</p>
                    <p className="font-medium">{formatDay(endDate, locale, { weekday: true, year: false })}</p>
                  </div>
                </div>
              </section>

              {/* Les stats à zéro : six anneaux vides à remplir. */}
              <section className="card mt-3 animate-in p-5 [animation-delay:320ms]">
                <p className="text-[15px] font-medium">{t.stats}</p>
                <div className="mt-4 grid grid-cols-6 gap-1.5">
                  {STATS.map((s) => (
                    <div key={s} className="flex flex-col items-center gap-1.5">
                      <ActivityRings rings={[{ value: 0, max: 1, tone: STAT_TONES[s] }]} size={44} stroke={6} label="" />
                      <span className="max-w-full truncate text-[10px] text-mute">{m.game.stats[s].short}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-sm text-mute">
                  {t.statsText} <span className="font-semibold text-paper">{t.statsHand}</span>.
                </p>
              </section>
            </div>

            <section className="mt-10 lg:mt-10">
              <div className="flex items-end justify-between gap-4">
                <h2 className="font-display text-[28px] leading-none">{fmt(t.principles, { n: preview.principles.length })}</h2>
                <p className="text-right text-xs text-mute">
                  {fmt(t.picked, { n: preview.templates })} {t.forYou}
                </p>
              </div>
              {businessLabels.length ? (
                <p className="mt-2 text-sm text-mute">{fmt(t.builtForBusiness, { list: businessLabels.join(", ") })}</p>
              ) : weakLabels.length ? (
                <p className="mt-2 text-sm text-mute">{fmt(t.builtFor, { list: weakLabels.join(", ") })}</p>
              ) : null}
              <ol className="mt-4 space-y-2.5">
                {preview.principles.map((p, i) => {
                  const title = bareThen(p.then_text);
                  return (
                    <li key={p.code} className={`card animate-in p-4 ${STAGGER[Math.min(i + 2, STAGGER.length - 1)]}`}>
                      <div className="flex items-center gap-3.5">
                        <ProofIcon proof={p.proof_type} pillar={p.pillar} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] leading-snug font-medium">{title.charAt(0).toUpperCase() + title.slice(1)}</p>
                          <p className="mt-0.5 text-[13px] text-mute">
                            {p.if_text} · {m.game.proof.label[p.proof_type]}
                          </p>
                        </div>
                        <span aria-label={fmt(t.difficulty, { n: p.difficulty })} className="flex shrink-0 gap-0.5">
                          {[1, 2, 3].map((n) => (
                            <span key={n} className={`size-1.5 rounded-full ${n <= p.difficulty ? "bg-paper" : "bg-white/15"}`} />
                          ))}
                        </span>
                      </div>
                      <details className="group mt-2 pl-[3.625rem]">
                        <summary className="cursor-pointer list-none text-[12px] text-mute underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden">{t.why}</summary>
                        <p className="mt-2 animate-in text-[13px] leading-relaxed text-paper/75">
                          {p.why} <span className="text-mute">({p.source})</span>
                        </p>
                      </details>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-3 px-1 text-sm text-mute">{t.editable}</p>
            </section>
          </div>

          <div className="lg:mx-auto lg:max-w-3xl">
            <section className="mt-12">{proofSlot}</section>
            <section className="mt-10">{founderSlot}</section>
          </div>

          <section ref={plansRef} id="plans" className="mt-12 scroll-mt-6">
            <div className="lg:max-w-2xl">
              <p className="bg-linear-to-r from-[#b79bff] to-[#8358e8] bg-clip-text text-[15px] font-semibold text-transparent">{t.oneStep}</p>
              <h2 className="mt-1 font-display text-[38px] leading-[1.02]">{t.launchTitle}</h2>
              <p className="mt-3 text-paper/80">{t.launchText}</p>
              {invitedBy ? (
                <p className="glow-mint mt-5 animate-in rounded-2xl p-4 text-sm">
                  <span className="font-semibold">{fmt(t.invited, { name: invitedBy })}</span>
                  {t.invitedText}
                </p>
              ) : null}
              {error ? (
                <p role="alert" className="mt-4 text-sm">
                  {error}
                </p>
              ) : null}
            </div>
            <div className={`mt-6 transition-opacity ${pending ? "pointer-events-none opacity-60" : ""}`}>
              <PlanPicker plans={plans} current={currentPlan} mode={{ kind: "choose", onChoose: choose }} />
            </div>
            <ul className="grouped mt-4 text-sm">
              {[t.secure, t.once, t.withdrawal].map((line) => (
                <li key={line} className="flex items-start gap-3 px-4 py-3">
                  <span aria-hidden="true" className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-ok/20 text-ok">
                    <Check className="size-3" />
                  </span>
                  <span className="text-paper/85">{line}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-12 lg:mx-auto lg:max-w-3xl">
            <h2 className="font-display text-[26px]">{t.questions}</h2>
            <div className="mt-4">{faqSlot}</div>
          </section>

          <button type="button" onClick={() => setStage("questions")} className={`${btnSecondary} mt-10`}>
            {t.edit}
          </button>
        </main>

        {currentPlan !== "pro" && currentPlan !== "fondateur" ? (
          <div
            className={`glass fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-20 rounded-[1.75rem] p-2.5 pl-5 transition-transform duration-500 ease-[cubic-bezier(0.3,1.2,0.4,1)] lg:hidden ${plansVisible ? "translate-y-[150%]" : "translate-y-0"}`}
          >
            <div className="mx-auto flex max-w-xl items-center gap-4">
              <div className="min-w-0 flex-1 text-xs text-mute">
                <span className="block text-sm font-semibold text-paper">{m.game.plans.name[stickyPlan]}</span>
                {stickyPlan === "arc"
                  ? fmt(t.sticky, { price: formatMoney(plans.arc.once, locale), perDay: formatMoney(Math.round(plans.arc.once / 90), locale) })
                  : fmt(m.game.plans.price.year, { price: formatMoney(plans.pro.year, locale) })}
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => choose(stickyPlan, stickyPlan === "arc" ? "once" : "year")}
                className="pearl press inline-flex h-12 shrink-0 items-center justify-center rounded-full px-5 text-[15px] font-semibold disabled:opacity-50"
              >
                {t.launch}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Questions
  const single =
    ["situation", "objectif", "focus", "sport", "engagement"].includes(step) || (step === "depart" && d.start !== "date") || (step === "ecole" && d.school !== "autre");
  const muted = (on: boolean) => (on ? "text-black/60" : "text-mute");
  // Parties ouvertes : celles de la catégorie du joueur (et celles ouvertes à tous).
  const parties = collectiveStarts.filter((c) => !c.category || c.category === d.category);
  const progress = PROGRESS[Math.min(PROGRESS.length - 1, Math.max(0, Math.round(((index + 1) / steps.length) * PROGRESS.length) - 1))];

  return (
    <div className="relative isolate min-h-dvh overflow-hidden">
      <Aura tone={TONES[index % TONES.length]} className="h-[30rem] opacity-55" />
      <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-3">
          {index > 0 ? (
            <button type="button" onClick={back} aria-label={q.previous} className="liquid press grid size-10 shrink-0 place-items-center rounded-full">
              <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
                <path d="M10 3 L5 8 L10 13" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : (
            <Link href="/" aria-label={m.common.homeAria} className="shrink-0">
              <Logo size="sm" />
            </Link>
          )}
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={index + 1} aria-label={q.progress}>
            <div className={`h-full rounded-full bg-linear-to-r from-[#b79bff] to-[#8358e8] transition-[width] duration-700 ease-[cubic-bezier(0.3,1.1,0.4,1)] ${progress}`} />
          </div>
          <span className="w-10 shrink-0 text-right text-[12px] text-mute tabular-nums">
            {index + 1}/{steps.length}
          </span>
        </div>

        <div
          key={step}
          data-quiz-step
          className={`my-auto py-8 ${smooth ? "[view-transition-name:quiz-step]" : direction === "forward" ? "animate-step" : "animate-step-back"}`}
        >
          {step === "situation" ? (
            <>
              <Question title={q.situation.title} hint={arcNumber > 1 ? fmt(q.situation.handNext, { n: arcNumber }) : q.situation.handFirst} />
              <div className="mt-7 space-y-2.5">
                {SITUATIONS.map((s, i) => (
                  <Choice key={s} index={i + 1} selected={d.category === s} onClick={() => pick(() => set("category", s))}>
                    <span className="block text-[16px] font-semibold">{m.game.situations[s].label}</span>
                    <span className={`mt-0.5 block text-sm ${muted(d.category === s)}`}>{m.game.situations[s].hint}</span>
                  </Choice>
                ))}
              </div>
            </>
          ) : null}

          {step === "business" ? (
            <>
              <Question title={q.business.title} hint={q.business.hand} />
              <div className="mt-7 grid grid-cols-2 gap-2">
                {BUSINESS_TYPES.map((b, i) => (
                  <Chip key={b} index={i} selected={d.businessTypes.includes(b)} onClick={() => toggleBusiness(b)} title={q.business.types[b].label} hint={q.business.types[b].hint} />
                ))}
              </div>
              {d.businessTypes.includes("autre") ? (
                <input
                  value={d.businessOther}
                  onChange={(e) => set("businessOther", e.target.value.slice(0, 60))}
                  autoFocus
                  placeholder={q.business.otherPlaceholder}
                  aria-label={q.business.otherPlaceholder}
                  className={`${input} mt-3 animate-in`}
                />
              ) : null}
            </>
          ) : null}

          {step === "ecole" ? (
            <>
              <Question title={q.school.title} hint={q.school.hand} />
              <div className="mt-7 grid grid-cols-2 gap-2">
                {SCHOOLS.map((s, i) => (
                  <Chip
                    key={s}
                    index={i}
                    selected={d.school === s}
                    title={q.school.types[s]}
                    onClick={() => {
                      if (s === "autre") {
                        if (advance.current) window.clearTimeout(advance.current);
                        setError(null);
                        set("school", "autre");
                      } else pick(() => set("school", s));
                    }}
                  />
                ))}
              </div>
              {d.school === "autre" ? (
                <input
                  value={d.schoolOther}
                  onChange={(e) => set("schoolOther", e.target.value.slice(0, 60))}
                  autoFocus
                  placeholder={q.school.otherPlaceholder}
                  aria-label={q.school.otherPlaceholder}
                  className={`${input} mt-3 animate-in`}
                />
              ) : null}
            </>
          ) : null}

          {step === "objectif" ? (
            <>
              <Question title={q.goal.title} hint={q.goal.hand} />
              <div className="mt-7 space-y-2">
                {goals.map((g, i) => (
                  <Choice
                    key={g}
                    index={i + 1}
                    selected={d.goalType === g}
                    onClick={() =>
                      pick(() =>
                        setD((prev) => {
                          const units = GOALS.map((x) => m.game.goals[x].unit);
                          const unit = m.game.goals[g].unit;
                          return { ...prev, goalType: g, goalUnit: !prev.goalUnit || units.includes(prev.goalUnit) ? unit : prev.goalUnit };
                        }),
                      )
                    }
                  >
                    <span className="text-[15px] font-medium">{m.game.goals[g].label}</span>
                  </Choice>
                ))}
              </div>
            </>
          ) : null}

          {step === "phrase" ? (
            <>
              <Question title={q.phrase.title} hint={q.phrase.hand} />
              <div className="mt-7 space-y-4">
                <label className="block">
                  <span className={label}>{q.phrase.label}</span>
                  <textarea
                    value={d.goal}
                    onChange={(e) => set("goal", e.target.value.slice(0, 120))}
                    rows={2}
                    autoFocus
                    placeholder={d.goalType ? m.game.goals[d.goalType].example : undefined}
                    className={`${input} mt-2 h-auto py-3 text-[17px]`}
                  />
                </label>
                <div className="grid grid-cols-[1fr_7rem] gap-3">
                  <label className="block">
                    <span className={label}>{q.phrase.target}</span>
                    <input
                      value={d.goalTarget}
                      onChange={(e) => set("goalTarget", e.target.value.replace(/[^\d,.]/g, "").slice(0, 12))}
                      inputMode="decimal"
                      placeholder={d.goalType === "revenu" ? "3000" : "10"}
                      className={`${input} mt-2`}
                    />
                  </label>
                  <label className="block">
                    <span className={label}>{q.phrase.unit}</span>
                    <input value={d.goalUnit} onChange={(e) => set("goalUnit", e.target.value.slice(0, 20))} placeholder={q.phrase.unitPlaceholder} className={`${input} mt-2`} />
                  </label>
                </div>
                <label className="flex items-start gap-3 text-sm text-paper/85">
                  <input type="checkbox" checked={d.goalPublic} onChange={(e) => set("goalPublic", e.target.checked)} className="mt-0.5 size-5 accent-white" />
                  {q.phrase.public}
                </label>
              </div>
            </>
          ) : null}

          {step === "vision" ? (
            <>
              <Question title={fmt(q.vision.title, { date: formatDay(endDate, locale, { weekday: true, year: false }) })} hint={q.vision.hand} />
              <div className="glow-rose mt-7 animate-in rounded-[2rem] p-6 [animation-delay:120ms]">
                <p className="text-[13px] font-medium text-paper/75">{q.vision.day}</p>
                <p className="mt-2 font-display text-[28px] leading-tight">{answers.goal || m.game.goals[answers.goalType].example}</p>
                {answers.goalTarget ? (
                  <p className="mt-4 font-dot text-[44px] leading-none">
                    {formatNumber(answers.goalTarget, locale)}
                    <span className="ml-2 font-display text-[22px] font-semibold">{answers.goalUnit}</span>
                  </p>
                ) : null}
              </div>
              <p className="mt-5 animate-in text-[16px] leading-relaxed text-paper/80 [animation-delay:200ms]">{q.vision.text}</p>
            </>
          ) : null}

          {step === "faiblesses" ? (
            <>
              <Question title={q.weak.title} hint={q.weak.hand} />
              <div className="mt-7 space-y-2">
                {weakList.map((w, i) => (
                  <Choice
                    key={w}
                    index={i + 1}
                    multi
                    selected={d.weakPoints.includes(w)}
                    onClick={() => set("weakPoints", d.weakPoints.includes(w) ? d.weakPoints.filter((x) => x !== w) : [...d.weakPoints, w])}
                  >
                    <span className="text-[15px] font-medium">{m.game.weakPoints[w]}</span>
                  </Choice>
                ))}
              </div>
            </>
          ) : null}

          {step === "science" ? (
            <>
              <Question title={q.science.title} hint={q.science.hand} />
              <p className="mt-4 animate-in text-[17px] leading-relaxed text-paper/80 [animation-delay:80ms]">{answers.weakPoints.length ? q.science.textWeak : q.science.text}</p>
              <blockquote className="glow-violet mt-6 animate-in rounded-[1.75rem] p-5 font-display text-[22px] leading-snug [animation-delay:160ms]">
                {q.science.examples[answers.weakPoints[0] ?? "procrastination"]}
              </blockquote>
              <div className="card mt-3 grid animate-in grid-cols-[4.5rem_1fr] items-center gap-4 p-5 [animation-delay:240ms]">
                <p className="font-dot text-[48px] leading-none">{q.science.figure}</p>
                <div>
                  <p className="text-sm text-paper/90">{q.science.figureText}</p>
                  <p className="mt-1.5 text-[11px] text-mute">{q.science.source}</p>
                </div>
              </div>
            </>
          ) : null}

          {step === "reveil" ? (
            <>
              <Question title={q.wake.title} hint={q.wake.hand} />
              <div className="mt-7 grid grid-cols-4 gap-2">
                {WAKE_TIMES.filter((t) => t >= "05:00" && t <= "09:00").map((t, i) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={d.wakeTime === t}
                    onClick={() => {
                      vibrate();
                      set("wakeTime", t);
                    }}
                    className={`press h-12 animate-in rounded-2xl text-[15px] font-medium tabular-nums ${STAGGER[Math.min(i, STAGGER.length - 1)]} ${
                      d.wakeTime === t ? "pearl" : "bg-white/[0.05] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)] hover:bg-white/[0.08]"
                    }`}
                  >
                    {formatTime(t, locale)}
                  </button>
                ))}
              </div>
              <label className="mt-4 block text-xs text-mute">
                {q.wake.other}{" "}
                <select value={d.wakeTime} onChange={(e) => set("wakeTime", e.target.value)} className="ml-1 rounded-lg bg-white/[0.06] px-2 py-1 text-paper">
                  {WAKE_TIMES.map((t) => (
                    <option key={t} value={t} className="bg-ink">
                      {formatTime(t, locale)}
                    </option>
                  ))}
                </select>
              </label>
              <p className="mt-5 text-sm text-mute">{q.wake.note}</p>
            </>
          ) : null}

          {step === "focus" ? (
            <>
              <Question title={q.focus.title} hint={q.focus.hand} />
              <div className="mt-7 space-y-2">
                {FOCUS.map((f, i) => (
                  <Choice key={f} index={i + 1} selected={d.focusMinutes === f} onClick={() => pick(() => set("focusMinutes", f))}>
                    <span className="block text-[15px] font-semibold">{q.focus.options[f].label}</span>
                    <span className={`mt-0.5 block text-[13px] ${muted(d.focusMinutes === f)}`}>{q.focus.options[f].hint}</span>
                  </Choice>
                ))}
              </div>
            </>
          ) : null}

          {step === "sport" ? (
            <>
              <Question title={q.sport.title} hint={q.sport.hand} />
              <div className="mt-7 space-y-2">
                {SPORT.map((s, i) => (
                  <Choice key={s} index={i + 1} selected={d.pushups === s} onClick={() => pick(() => set("pushups", s))}>
                    <span className="block text-[15px] font-semibold">{q.sport.options[s].label}</span>
                    <span className={`mt-0.5 block text-[13px] ${muted(d.pushups === s)}`}>{q.sport.options[s].hint}</span>
                  </Choice>
                ))}
              </div>
            </>
          ) : null}

          {step === "depart" ? (
            <>
              <Question title={q.start.title} hint={q.start.hand} />
              <div className="mt-7 space-y-2">
                <Choice index={1} selected={d.start === "today"} onClick={() => pick(() => set("start", "today"))}>
                  <span className="text-[15px] font-medium">{q.start.today}</span>
                </Choice>
                <Choice index={2} selected={d.start === "tomorrow"} onClick={() => pick(() => set("start", "tomorrow"))}>
                  <span className="text-[15px] font-medium">{q.start.tomorrow}</span>
                </Choice>
                <Choice index={3} selected={d.start === "monday"} onClick={() => pick(() => set("start", "monday"))}>
                  <span className="block text-[15px] font-medium">{fmt(q.start.monday, { date: formatDay(nextMonday(today), locale, { year: false }) })}</span>
                  <span className={`mt-0.5 block text-[12px] ${muted(d.start === "monday")}`}>{q.start.mondayHint}</span>
                </Choice>
                {parties.map((c, i) => (
                  <Choice key={c.id} index={4 + i} selected={d.start === `squad:${c.id}`} onClick={() => pick(() => set("start", `squad:${c.id}`))}>
                    <span className="block text-[15px] font-medium">
                      {fmt(q.start.party, { name: c.official && c.category ? q.start.parties[c.category] : c.name, date: formatDay(c.start_date, locale, { weekday: true, year: false }) })}
                    </span>
                    <span className={`mt-0.5 block text-[12px] ${muted(d.start === `squad:${c.id}`)}`}>
                      {q.start.partyHint}
                      {c.members >= 3 ? ` · ${fmt(q.start.members, { n: formatNumber(c.members, locale) })}` : ""}
                    </span>
                  </Choice>
                ))}
                <Choice index={4 + parties.length} selected={d.start === "date"} onClick={() => set("start", "date")}>
                  <span className="text-[15px] font-medium">{q.start.other}</span>
                </Choice>
                {d.start === "date" ? (
                  <input type="date" value={d.customDate} min={today} max={addDays(today, 120)} onChange={(e) => set("customDate", e.target.value)} className={`${input} mt-2 animate-in`} />
                ) : null}
              </div>
            </>
          ) : null}

          {step === "engagement" ? (
            <>
              <Question title={q.commitment.title} hint={q.commitment.hand} />
              <div className="mt-7 space-y-2">
                {COMMITMENT_KEYS.map((c, i) => (
                  <Choice key={c} index={i + 1} selected={d.commitment === c} onClick={() => pick(() => set("commitment", c))}>
                    <span className="text-[15px] font-medium">{m.game.commitments[c].label}</span>
                  </Choice>
                ))}
              </div>
            </>
          ) : null}

          {step === "pseudo" ? (
            <>
              <Question title={q.pseudo.title} hint={q.pseudo.hand} />
              <div className="mt-7 space-y-5">
                <input
                  value={d.pseudo}
                  onChange={(e) => set("pseudo", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20))}
                  autoComplete="username"
                  autoCapitalize="none"
                  autoFocus
                  placeholder={q.pseudo.placeholder}
                  aria-label={q.pseudo.title}
                  className={`${input} h-14 font-display text-2xl`}
                />
                <label className="flex items-start gap-3 text-sm text-paper/85">
                  <input type="checkbox" checked={d.isPublic} onChange={(e) => set("isPublic", e.target.checked)} className="mt-0.5 size-5 accent-white" />
                  {q.pseudo.public}
                </label>
              </div>
            </>
          ) : null}

          {error ? (
            <p role="alert" className="mt-5 animate-in rounded-2xl bg-ko/12 px-4 py-3 text-sm text-[#ff8a80]">
              {error}
            </p>
          ) : null}
        </div>

        {single ? (
          <p className="text-center text-xs text-mute">{q.tapToContinue}</p>
        ) : (
          <button type="button" onClick={next} className={btnPrimary}>
            {index === steps.length - 1 ? q.build : step === "science" ? q.understood : step === "vision" ? q.vision.cta : q.continue}
          </button>
        )}
      </div>
    </div>
  );
}
