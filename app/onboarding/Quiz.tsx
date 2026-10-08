"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { flushSync } from "react-dom";
import { type AccountState, continueWithPlan, continueWithProvider, previewArc, sendAccountCode, verifyAccountCode } from "@/app/actions/onboarding";
import { Hand, HandArrow } from "@/components/Hand";
import { useI18n } from "@/components/I18nProvider";
import { Logo } from "@/components/Logo";
import { OAUTH_PROVIDERS, type OAuthProvider, oauthButtonClass, OrDivider, ProviderLabel } from "@/components/OAuthButtons";
import { PlanPicker } from "@/components/PlanPicker";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";
import { addDays, type ArcAnswers, BUSINESS_TYPES, COMMITMENT_KEYS, nextMonday, SCHOOLS } from "@/lib/answers";
import type { Artwork } from "@/lib/art";
import { fmt, formatDay, formatMoney, formatNumber, formatTime } from "@/lib/i18n/format";
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
  invitedBy: string | null;
  proofSlot: React.ReactNode;
  founderSlot: React.ReactNode;
  faqSlot: React.ReactNode;
};

type Stage = "questions" | "building" | "result" | "account";
type Business = (typeof BUSINESS_TYPES)[number];
type School = (typeof SCHOOLS)[number];
type Sport = "oui" | "quelques" | "non";
type WeakPoint = ArcAnswers["weakPoints"][number];

const WAKE_TIMES = Array.from({ length: 25 }, (_, i) => {
  const minutes = 4 * 60 + i * 15;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});
const SITUATIONS: Category[] = ["mixte", "business", "etudes"];
const GOALS: GoalType[] = ["revenu", "clients", "lancement", "audience", "examens", "corps", "autre"];
const GOALS_STUDENT: GoalType[] = ["examens", "lancement", "audience", "revenu", "clients", "corps", "autre"];
const WEAK: WeakPoint[] = ["telephone", "procrastination", "vente", "dispersion", "reveil", "sport", "regularite"];
const FOCUS = [25, 50, 90] as const;
const SPORT: Sport[] = ["oui", "quelques", "non"];
const STATS = ["discipline", "focus", "business", "corps", "esprit", "energie"] as const;

// Délais d'apparition en cascade (classes écrites en entier pour Tailwind).
const STAGGER = ["", "[animation-delay:40ms]", "[animation-delay:80ms]", "[animation-delay:120ms]", "[animation-delay:160ms]", "[animation-delay:200ms]", "[animation-delay:240ms]", "[animation-delay:280ms]"];

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
  (document as Doc).startViewTransition!(() => flushSync(update));
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

function Choice({ selected, onClick, index = 0, multi = false, children }: { selected: boolean; onClick: () => void; index?: number; multi?: boolean; children: React.ReactNode }) {
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
      <span aria-hidden="true" className={`grid size-5 shrink-0 place-items-center border ${multi ? "rounded-[3px]" : "rounded-full"} ${selected ? "border-ink" : "border-line"}`}>
        {selected ? (
          multi ? (
            <svg viewBox="0 0 16 16" className="size-3.5 animate-tick">
              <path d="M3 8.5 L6.5 12 L13 4.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <span className="size-2.5 animate-tick rounded-full bg-ink" />
          )
        ) : null}
      </span>
    </button>
  );
}

/** Choix compact sur deux colonnes (activités, écoles). */
function Chip({ selected, onClick, index = 0, title, hint }: { selected: boolean; onClick: () => void; index?: number; title: string; hint?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex min-h-16 animate-rise flex-col justify-center rounded-xs border px-3.5 py-3 text-left transition-[background-color,border-color,color,transform] duration-200 active:scale-[0.98] ${STAGGER[Math.min(index, STAGGER.length - 1)]} ${
        selected ? "border-paper bg-paper text-ink" : "border-line bg-ink/60 text-paper hover:border-mute"
      }`}
    >
      <span className="text-sm leading-tight font-medium">{title}</span>
      {hint ? <span className={`mt-1 text-[11px] leading-snug ${selected ? "text-ink/65" : "text-mute"}`}>{hint}</span> : null}
    </button>
  );
}

/**
 * Photos de fond : l'active et la suivante (préchargée) restent montées, celles déjà vues aussi.
 * On ne fait varier que l'opacité : pas de rechargement, pas de masque, fondu fluide.
 */
function Backdrop({ arts, active }: { arts: (Artwork | null)[]; active: number }) {
  const shown = arts.slice(0, Math.min(arts.length, active + 2));
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[70dvh] overflow-hidden">
      {shown.map((art, i) =>
        art ? (
          <Image
            key={art.slug}
            src={`/art/${art.slug}-nb.jpg`}
            alt=""
            width={art.width}
            height={art.height}
            priority={i === 0}
            sizes="100vw"
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-out ${i === active ? "opacity-100" : "opacity-0"}`}
          />
        ) : null,
      )}
      <div className="absolute inset-0 bg-linear-to-b from-ink/75 via-ink/75 to-ink" />
      <div className="vignette absolute inset-0" />
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
      <Hand className="animate-rise text-3xl text-mute">{m.quiz.building.hand}</Hand>
      <div className="relative mx-auto mt-10 size-44 animate-pop">
        <svg viewBox="0 0 120 120" className="size-44 -rotate-90" aria-hidden="true">
          <circle cx="60" cy="60" r="54" fill="none" stroke="var(--color-line)" strokeWidth="2" />
          <circle cx="60" cy="60" r="54" fill="none" stroke="var(--color-paper)" strokeWidth="2" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} />
        </svg>
        <p className="absolute inset-0 grid place-items-center font-serif text-5xl tabular-nums" aria-live="polite">
          {Math.round(pct)}
          <span className="sr-only"> {m.quiz.building.percent}</span>
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
  const { m, locale } = useI18n();
  const t = m.quiz.account;
  const [sent, sendAction] = useActionState(sendAccountCode, accountInitial);
  const [checked, verifyAction] = useActionState(verifyAccountCode, accountInitial);
  const [dismissed, setDismissed] = useState<AccountState | null>(null);
  const [oauthPending, startOauth] = useTransition();
  const [oauthChoice, setOauthChoice] = useState<OAuthProvider | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const codeStep = sent.step === "code" && sent !== dismissed;

  return (
    <div className="flex flex-1 flex-col justify-center py-10">
      <Hand underline className="animate-rise text-3xl">
        {t.hand}
      </Hand>
      <h1 className="mt-6 animate-rise font-serif text-5xl leading-[0.95] [animation-delay:80ms]">{t.title}</h1>
      <p className="mt-5 animate-rise text-paper/85 [animation-delay:140ms]">{t.text}</p>
      <div className="mt-6 flex animate-rise items-baseline justify-between border-y border-line py-4 text-sm [animation-delay:200ms]">
        <span>{m.game.plans.name[plan]}</span>
        <span className="font-serif text-2xl">{fmt(m.game.plans.price[interval], { price: formatMoney(price, locale) })}</span>
      </div>

      {!codeStep && OAUTH_PROVIDERS.length ? (
        <div className="mt-8 animate-rise space-y-3 [animation-delay:260ms]">
          {OAUTH_PROVIDERS.map((provider) => (
            <button
              key={provider}
              type="button"
              disabled={oauthPending}
              onClick={() => {
                setOauthChoice(provider);
                startOauth(async () => {
                  const r = await continueWithProvider(provider, answers, plan, interval);
                  if (r?.error) setOauthError(r.error);
                });
              }}
              className={oauthButtonClass(provider)}
            >
              {oauthPending && oauthChoice === provider ? m.common.actions.redirecting : <ProviderLabel provider={provider} />}
            </button>
          ))}
          <FormMessage message={oauthError} />
          <div className="pt-3">
            <OrDivider />
          </div>
        </div>
      ) : null}
      {!codeStep ? (
        <form action={sendAction} className="mt-8 animate-rise space-y-4 [animation-delay:260ms]">
          <input type="hidden" name="answers" value={answers} />
          <input type="hidden" name="plan" value={plan} />
          <input type="hidden" name="interval" value={interval} />
          <label className="block">
            <span className="text-sm text-mute">{t.email}</span>
            <input name="email" type="email" required autoComplete="email" inputMode="email" defaultValue={sent.email} placeholder={t.emailPlaceholder} className={`${input} mt-2`} />
          </label>
          <SubmitButton className={btnPrimary} pendingLabel={m.common.actions.sending}>
            {t.sendCode}
          </SubmitButton>
          <FormMessage message={sent.message} />
        </form>
      ) : (
        <form action={verifyAction} className="mt-8 animate-step space-y-4">
          <input type="hidden" name="email" value={sent.email} />
          <p className="text-sm text-mute">{fmt(t.sent, { email: sent.email })}</p>
          <label className="block">
            <span className="text-sm text-mute">{t.code}</span>
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
          <SubmitButton className={btnPrimary} pendingLabel={t.verifying}>
            {m.common.actions.continue}
          </SubmitButton>
          <FormMessage message={checked.message} />
          <p className="text-xs text-mute">{t.spam}</p>
          <button type="button" onClick={() => setDismissed(sent)} className={btnLink}>
            {t.change}
          </button>
        </form>
      )}
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
  arts,
  templates,
  invitedBy,
  proofSlot,
  founderSlot,
  faqSlot,
}: Props) {
  const { m, locale } = useI18n();
  const q = m.quiz;
  const [stage, setStage] = useState<Stage>("questions");
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
  const steps = useMemo(
    () => [
      "situation",
      ...(hasBusiness(d.category) ? ["business"] : []),
      ...(hasSchool(d.category) ? ["ecole"] : []),
      "objectif",
      "phrase",
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
    void previewArc(JSON.stringify(toAnswers(latest.current.d))).then((r) => {
      if ("error" in r) setBuildError(r.error);
      else setPreview(r);
    });
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
    }, 220);
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
  if (stage === "building") {
    return (
      <div className="min-h-dvh grain">
        <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pt-6 pb-14">
          <Logo size="sm" />
          {buildError ? (
            <div className="my-auto animate-step">
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
      <div className="min-h-dvh grain">
        <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pt-6 pb-14">
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
      <div className="min-h-dvh">
        <main className="mx-auto w-full max-w-xl px-5 pt-6 pb-32 lg:max-w-5xl">
          <Logo size="sm" />

          <div className="lg:grid lg:grid-cols-[1fr_1fr] lg:gap-16">
            <div>
              <section className="pt-12">
                <p className="animate-rise">
                  <Hand className="text-4xl">{name ? fmt(t.hello, { name }) : t.helloAnon}</Hand>
                </p>
                <h1 className="mt-3 animate-rise font-serif text-6xl leading-[0.9] [animation-delay:120ms]">
                  {t.title}{" "}
                  <span className="relative inline-block">
                    {t.titleEnd}
                    <svg aria-hidden="true" viewBox="0 0 200 12" preserveAspectRatio="none" className="absolute -bottom-2 left-0 h-3 w-full">
                      <path d="M2 8 C 40 3, 90 2, 130 5 S 185 9, 198 4" pathLength="1" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="stroke-draw [animation-delay:700ms]" />
                    </svg>
                  </span>
                </h1>
                {commitment ? <p className="mt-6 animate-rise text-lg text-paper/85 [animation-delay:240ms]">{commitment.echo}</p> : null}
              </section>

              <section className="mt-10 animate-rise border border-line bg-surface p-5 grain [animation-delay:300ms]">
                <p className={label}>{fmt(t.arc, { n: arcNumber, goal: m.game.goals[answers.goalType].label })}</p>
                <p className="mt-3 font-serif text-3xl leading-tight">{answers.goal}</p>
                <div className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4 text-sm">
                  <div>
                    <p className="text-xs text-mute">{t.day1}</p>
                    <p className="mt-1">{formatDay(startDate, locale, { weekday: true, year: false })}</p>
                  </div>
                  <div>
                    <p className="text-xs text-mute">{t.day90}</p>
                    <p className="mt-1">{formatDay(endDate, locale, { weekday: true })}</p>
                  </div>
                </div>
              </section>


            </div>

            <section className="mt-12 lg:mt-12">
              <div className="flex items-end justify-between gap-4">
                <h2 className="font-serif text-4xl leading-none">{fmt(t.principles, { n: preview.principles.length })}</h2>
                <p className="text-right text-xs text-mute">
                  {fmt(t.picked, { n: preview.templates })}
                  <br />
                  {t.forYou}
                </p>
              </div>
              {businessLabels.length ? (
                <p className="mt-3 text-sm text-mute">{fmt(t.builtForBusiness, { list: businessLabels.join(", ") })}</p>
              ) : weakLabels.length ? (
                <p className="mt-3 text-sm text-mute">{fmt(t.builtFor, { list: weakLabels.join(", ") })}</p>
              ) : null}
              <ol className="mt-6 space-y-3">
                {preview.principles.map((p, i) => (
                  <li key={p.code} className={`animate-rise border border-line p-4 ${STAGGER[Math.min(i + 2, STAGGER.length - 1)]}`}>
                    <div className="flex items-center justify-between gap-3 text-[11px] tracking-[0.15em] text-mute uppercase">
                      <span>{m.game.pillar[p.pillar]}</span>
                      <span className="flex items-center gap-2 normal-case tracking-normal">
                        {m.game.proof.label[p.proof_type]}
                        <span aria-label={fmt(t.difficulty, { n: p.difficulty })} className="flex gap-0.5">
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
                      <summary className="cursor-pointer list-none text-xs text-mute underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden">{t.why}</summary>
                      <p className="mt-2 animate-rise text-xs leading-relaxed text-paper/75">
                        {p.why} <span className="text-mute">({p.source})</span>
                      </p>
                    </details>
                  </li>
                ))}
              </ol>
              <p className="mt-5 flex items-center gap-2 text-mute">
                <HandArrow className="-scale-y-100 rotate-180" />
                <Hand className="text-2xl">{t.editable}</Hand>
              </p>
            </section>
          </div>

          <section className="mt-14 animate-rise lg:mx-auto lg:max-w-3xl">
            <p className={label}>{t.stats}</p>
            <div className="mt-4 grid grid-cols-3 gap-x-5 gap-y-4">
              {STATS.map((s) => (
                <div key={s}>
                  <p className="text-[10px] tracking-[0.12em] text-mute uppercase">{m.game.stats[s].label}</p>
                  <p className="mt-0.5 font-serif text-2xl leading-none">0</p>
                  <span className="mt-1.5 block h-1 w-full bg-line" />
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-mute">
              {t.statsText} <Hand className="text-xl text-paper">{t.statsHand}</Hand>.
            </p>
          </section>

          <div className="lg:mx-auto lg:max-w-3xl">
            <section className="mt-16">{proofSlot}</section>

            <section className="mt-14">{founderSlot}</section>
          </div>

          <section ref={plansRef} id="plans" className="mt-16 scroll-mt-6">
            <div className="lg:max-w-2xl">
              <Hand className="text-3xl text-mute">{t.oneStep}</Hand>
              <h2 className="mt-2 font-serif text-5xl leading-[0.95]">{t.launchTitle}</h2>
              <p className="mt-4 text-paper/85">{t.launchText}</p>
              {invitedBy ? (
                <p className="mt-6 animate-rise border border-paper p-4 text-sm">
                  <Hand className="mr-1 text-2xl">{fmt(t.invited, { name: invitedBy })}</Hand>
                  {t.invitedText}
                </p>
              ) : null}
              {error ? (
                <p role="alert" className="mt-4 text-sm">
                  {error}
                </p>
              ) : null}
            </div>
            <div className={`mt-8 transition-opacity ${pending ? "pointer-events-none opacity-60" : ""}`}>
              <PlanPicker plans={plans} current={currentPlan} mode={{ kind: "choose", onChoose: choose }} />
            </div>
            <ul className="mt-6 space-y-2 text-xs text-mute">
              <li>{t.secure}</li>
              <li>{t.once}</li>
              <li>{t.withdrawal}</li>
            </ul>
          </section>

          <section className="mt-16 lg:mx-auto lg:max-w-3xl">
            <h2 className="font-serif text-3xl">{t.questions}</h2>
            <div className="mt-5">{faqSlot}</div>
          </section>

          <button type="button" onClick={() => setStage("questions")} className={`${btnLink} mt-10`}>
            {t.edit}
          </button>
        </main>

        {currentPlan !== "pro" && currentPlan !== "fondateur" ? (
          <div
            className={`fixed inset-x-0 bottom-0 z-20 border-t border-line bg-ink/95 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-transform duration-300 ease-out lg:hidden ${plansVisible ? "translate-y-full" : "translate-y-0"}`}
          >
            <div className="mx-auto flex max-w-xl items-center gap-4">
              <div className="min-w-0 flex-1 text-xs text-mute">
                <span className="block text-sm text-paper">{m.game.plans.name[stickyPlan]}</span>
                {stickyPlan === "arc"
                  ? fmt(t.sticky, { price: formatMoney(plans.arc.once, locale), perDay: formatMoney(Math.round(plans.arc.once / 90), locale) })
                  : fmt(m.game.plans.price.year, { price: formatMoney(plans.pro.year, locale) })}
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => choose(stickyPlan, stickyPlan === "arc" ? "once" : "year")}
                className="inline-flex h-12 shrink-0 items-center justify-center rounded-xs bg-paper px-5 text-sm font-medium text-ink transition-transform active:scale-[0.97] disabled:opacity-50"
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
  const artIndex = Math.min(Math.floor(index / 2), arts.length - 1);
  const single =
    ["situation", "objectif", "focus", "sport", "engagement"].includes(step) || (step === "depart" && d.start !== "date") || (step === "ecole" && d.school !== "autre");
  const muted = (on: boolean) => (on ? "text-ink/65" : "text-mute");

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <Backdrop arts={arts} active={artIndex} />
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pt-6 pb-12">
        <div className="flex items-center gap-4">
          {index > 0 ? (
            <button type="button" onClick={back} aria-label={q.previous} className="-ml-2 grid size-10 place-items-center text-mute transition-colors hover:text-paper active:scale-95">
              <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
                <path d="M10 3 L5 8 L10 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : (
            <Link href="/" aria-label={m.common.homeAria}>
              <Logo size="sm" />
            </Link>
          )}
          <div className="flex flex-1 gap-1" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={index + 1} aria-label={q.progress}>
            {steps.map((s, i) => (
              <span key={s} className={`h-0.5 flex-1 transition-colors duration-500 ${i <= index ? "bg-paper" : "bg-line"}`} />
            ))}
          </div>
        </div>

        <div
          key={step}
          data-quiz-step
          className={`my-auto py-10 ${smooth ? "[view-transition-name:quiz-step]" : direction === "forward" ? "animate-step" : "animate-step-back"}`}
        >
          {step === "situation" ? (
            <>
              <Hand className="text-2xl text-mute">{arcNumber > 1 ? fmt(q.situation.handNext, { n: arcNumber }) : q.situation.handFirst}</Hand>
              <h1 className="mt-3 font-serif text-5xl leading-[0.95]">{q.situation.title}</h1>
              <div className="mt-8 space-y-3">
                {SITUATIONS.map((s, i) => (
                  <Choice key={s} index={i + 1} selected={d.category === s} onClick={() => pick(() => set("category", s))}>
                    <span className="block font-medium">{m.game.situations[s].label}</span>
                    <span className={`mt-1 block text-sm ${muted(d.category === s)}`}>{m.game.situations[s].hint}</span>
                  </Choice>
                ))}
              </div>
            </>
          ) : null}

          {step === "business" ? (
            <>
              <h1 className="font-serif text-5xl leading-[0.95]">{q.business.title}</h1>
              <Hand className="mt-3 text-2xl text-mute">{q.business.hand}</Hand>
              <div className="mt-8 grid grid-cols-2 gap-2">
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
                  className={`${input} mt-3 animate-rise`}
                />
              ) : null}
            </>
          ) : null}

          {step === "ecole" ? (
            <>
              <h1 className="font-serif text-5xl leading-[0.95]">{q.school.title}</h1>
              <Hand className="mt-3 text-2xl text-mute">{q.school.hand}</Hand>
              <div className="mt-8 grid grid-cols-2 gap-2">
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
                  className={`${input} mt-3 animate-rise`}
                />
              ) : null}
            </>
          ) : null}

          {step === "objectif" ? (
            <>
              <h1 className="font-serif text-5xl leading-[0.95]">{q.goal.title}</h1>
              <Hand className="mt-3 text-2xl text-mute">{q.goal.hand}</Hand>
              <div className="mt-8 space-y-2">
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
                    <span className="text-sm">{m.game.goals[g].label}</span>
                  </Choice>
                ))}
              </div>
            </>
          ) : null}

          {step === "phrase" ? (
            <>
              <h1 className="font-serif text-5xl leading-[0.95]">{q.phrase.title}</h1>
              <Hand className="mt-3 text-2xl text-mute">{q.phrase.hand}</Hand>
              <div className="mt-8 space-y-4">
                <label className="block">
                  <span className={label}>{q.phrase.label}</span>
                  <textarea
                    value={d.goal}
                    onChange={(e) => set("goal", e.target.value.slice(0, 120))}
                    rows={2}
                    autoFocus
                    placeholder={d.goalType ? m.game.goals[d.goalType].example : undefined}
                    className={`${input} mt-2 h-auto py-3`}
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
                <label className="flex items-start gap-3 text-sm">
                  <input type="checkbox" checked={d.goalPublic} onChange={(e) => set("goalPublic", e.target.checked)} className="mt-0.5 size-5 accent-paper" />
                  {q.phrase.public}
                </label>
              </div>
            </>
          ) : null}

          {step === "faiblesses" ? (
            <>
              <h1 className="font-serif text-5xl leading-[0.95]">{q.weak.title}</h1>
              <Hand className="mt-3 text-2xl text-mute">{q.weak.hand}</Hand>
              <div className="mt-8 space-y-2">
                {weakList.map((w, i) => (
                  <Choice
                    key={w}
                    index={i + 1}
                    multi
                    selected={d.weakPoints.includes(w)}
                    onClick={() => set("weakPoints", d.weakPoints.includes(w) ? d.weakPoints.filter((x) => x !== w) : [...d.weakPoints, w])}
                  >
                    <span className="text-sm">{m.game.weakPoints[w]}</span>
                  </Choice>
                ))}
              </div>
            </>
          ) : null}

          {step === "science" ? (
            <>
              <Hand underline className="text-3xl">
                {q.science.hand}
              </Hand>
              <h1 className="mt-5 font-serif text-5xl leading-[0.95]">{q.science.title}</h1>
              <p className="mt-5 animate-rise text-lg leading-relaxed text-paper/85 [animation-delay:80ms]">{answers.weakPoints.length ? q.science.textWeak : q.science.text}</p>
              <blockquote className="mt-8 animate-rise border-l-2 border-paper pl-4 font-serif text-2xl leading-snug [animation-delay:160ms]">
                {q.science.examples[answers.weakPoints[0] ?? "procrastination"]}
              </blockquote>
              <div className="mt-10 grid animate-rise grid-cols-[5rem_1fr] items-start gap-4 border-t border-line pt-6 [animation-delay:240ms]">
                <p className="font-serif text-6xl leading-none">{q.science.figure}</p>
                <div>
                  <p className="text-sm text-paper/90">{q.science.figureText}</p>
                  <p className="mt-1.5 text-[11px] text-mute">{q.science.source}</p>
                </div>
              </div>
            </>
          ) : null}

          {step === "reveil" ? (
            <>
              <h1 className="font-serif text-5xl leading-[0.95]">{q.wake.title}</h1>
              <Hand className="mt-3 text-2xl text-mute">{q.wake.hand}</Hand>
              <div className="mt-8 grid grid-cols-4 gap-2">
                {WAKE_TIMES.filter((t) => t >= "05:00" && t <= "09:00").map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={d.wakeTime === t}
                    onClick={() => set("wakeTime", t)}
                    className={`h-11 rounded-xs border text-sm tabular-nums transition-[background-color,border-color,color,transform] duration-200 active:scale-95 ${d.wakeTime === t ? "border-paper bg-paper text-ink" : "border-line bg-ink/60 hover:border-mute"}`}
                  >
                    {formatTime(t, locale)}
                  </button>
                ))}
              </div>
              <label className="mt-4 block text-xs text-mute">
                {q.wake.other}{" "}
                <select value={d.wakeTime} onChange={(e) => set("wakeTime", e.target.value)} className="ml-1 border-b border-line bg-transparent text-paper">
                  {WAKE_TIMES.map((t) => (
                    <option key={t} value={t} className="bg-ink">
                      {formatTime(t, locale)}
                    </option>
                  ))}
                </select>
              </label>
              <p className="mt-6 text-sm text-mute">{q.wake.note}</p>
            </>
          ) : null}

          {step === "focus" ? (
            <>
              <h1 className="font-serif text-5xl leading-[0.95]">{q.focus.title}</h1>
              <Hand className="mt-3 text-2xl text-mute">{q.focus.hand}</Hand>
              <div className="mt-8 space-y-2">
                {FOCUS.map((f, i) => (
                  <Choice key={f} index={i + 1} selected={d.focusMinutes === f} onClick={() => pick(() => set("focusMinutes", f))}>
                    <span className="block text-sm font-medium">{q.focus.options[f].label}</span>
                    <span className={`mt-0.5 block text-xs ${muted(d.focusMinutes === f)}`}>{q.focus.options[f].hint}</span>
                  </Choice>
                ))}
              </div>
            </>
          ) : null}

          {step === "sport" ? (
            <>
              <h1 className="font-serif text-5xl leading-[0.95]">{q.sport.title}</h1>
              <Hand className="mt-3 text-2xl text-mute">{q.sport.hand}</Hand>
              <div className="mt-8 space-y-2">
                {SPORT.map((s, i) => (
                  <Choice key={s} index={i + 1} selected={d.pushups === s} onClick={() => pick(() => set("pushups", s))}>
                    <span className="block text-sm font-medium">{q.sport.options[s].label}</span>
                    <span className={`mt-0.5 block text-xs ${muted(d.pushups === s)}`}>{q.sport.options[s].hint}</span>
                  </Choice>
                ))}
              </div>
            </>
          ) : null}

          {step === "depart" ? (
            <>
              <h1 className="font-serif text-5xl leading-[0.95]">{q.start.title}</h1>
              <Hand className="mt-3 text-2xl text-mute">{q.start.hand}</Hand>
              <div className="mt-8 space-y-2">
                <Choice index={1} selected={d.start === "today"} onClick={() => pick(() => set("start", "today"))}>
                  <span className="text-sm">{q.start.today}</span>
                </Choice>
                <Choice index={2} selected={d.start === "tomorrow"} onClick={() => pick(() => set("start", "tomorrow"))}>
                  <span className="text-sm">{q.start.tomorrow}</span>
                </Choice>
                <Choice index={3} selected={d.start === "monday"} onClick={() => pick(() => set("start", "monday"))}>
                  <span className="block text-sm">{fmt(q.start.monday, { date: formatDay(nextMonday(today), locale, { year: false }) })}</span>
                  <span className={`mt-0.5 block text-xs ${muted(d.start === "monday")}`}>{q.start.mondayHint}</span>
                </Choice>
                {collectiveStarts.map((c, i) => (
                  <Choice key={c.id} index={4 + i} selected={d.start === `squad:${c.id}`} onClick={() => pick(() => set("start", `squad:${c.id}`))}>
                    <span className="block text-sm">{fmt(q.start.collective, { date: formatDay(c.start_date, locale) })}</span>
                    <span className={`mt-0.5 block text-xs ${muted(d.start === `squad:${c.id}`)}`}>
                      {c.name}
                      {c.members >= 10 ? ` · ${fmt(q.start.members, { n: formatNumber(c.members, locale) })}` : ""}
                    </span>
                  </Choice>
                ))}
                <Choice index={5 + collectiveStarts.length} selected={d.start === "date"} onClick={() => set("start", "date")}>
                  <span className="text-sm">{q.start.other}</span>
                </Choice>
                {d.start === "date" ? (
                  <input type="date" value={d.customDate} min={today} max={addDays(today, 120)} onChange={(e) => set("customDate", e.target.value)} className={`${input} mt-2 animate-rise`} />
                ) : null}
              </div>
            </>
          ) : null}

          {step === "engagement" ? (
            <>
              <h1 className="font-serif text-5xl leading-[0.95]">{q.commitment.title}</h1>
              <Hand className="mt-3 text-2xl text-mute">{q.commitment.hand}</Hand>
              <div className="mt-8 space-y-2">
                {COMMITMENT_KEYS.map((c, i) => (
                  <Choice key={c} index={i + 1} selected={d.commitment === c} onClick={() => pick(() => set("commitment", c))}>
                    <span className="text-sm">{m.game.commitments[c].label}</span>
                  </Choice>
                ))}
              </div>
            </>
          ) : null}

          {step === "pseudo" ? (
            <>
              <h1 className="font-serif text-5xl leading-[0.95]">{q.pseudo.title}</h1>
              <Hand className="mt-3 text-2xl text-mute">{q.pseudo.hand}</Hand>
              <div className="mt-8 space-y-5">
                <input
                  value={d.pseudo}
                  onChange={(e) => set("pseudo", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20))}
                  autoComplete="username"
                  autoCapitalize="none"
                  autoFocus
                  placeholder={q.pseudo.placeholder}
                  aria-label={q.pseudo.title}
                  className={`${input} font-serif text-2xl`}
                />
                <label className="flex items-start gap-3 text-sm">
                  <input type="checkbox" checked={d.isPublic} onChange={(e) => set("isPublic", e.target.checked)} className="mt-0.5 size-5 accent-paper" />
                  {q.pseudo.public}
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
          <p className="text-center text-xs text-mute">{q.tapToContinue}</p>
        ) : (
          <button type="button" onClick={next} className={btnPrimary}>
            {index === steps.length - 1 ? q.build : step === "science" ? q.understood : q.continue}
          </button>
        )}
      </div>
    </div>
  );
}
