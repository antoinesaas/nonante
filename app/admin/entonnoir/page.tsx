import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { formatDayFr } from "@/lib/dates";
import { getMessages } from "@/lib/i18n/messages";

// L'administration reste en français.
const PLAN_NAME: Record<string, string> = getMessages("fr").game.plans.name;

type Funnel = {
  from: string;
  days: { day: string; visits: number }[];
  quiz: { screen: string; visits: number; mobile: number }[];
  plans: { plan: string; interval: string; visits: number }[];
  checkout: number;
  sessions: Record<string, number>;
  math: { quizzes: number; avg_right: number | null; avg_level: number | null };
};

// Écrans du questionnaire (identifiants de app/onboarding/Quiz.tsx).
const SCREEN: Record<string, string> = {
  intro: "Écrans d'accueil",
  situation: "Profil (études, business…)",
  business: "Activité",
  ecole: "École",
  objectif: "Objectif",
  phrase: "Objectif en une phrase",
  vision: "Jour 90 imaginé",
  faiblesses: "Points faibles",
  science: "Écran « si… alors… »",
  reveil: "Réveil",
  focus: "Concentration",
  sport: "Sport",
  depart: "Jour 1",
  engagement: "Engagement",
  pseudo: "Pseudo",
  building: "Construction de l'arc",
  result: "Résultat et plans",
  account: "Connexion Google",
};
const PERIODS = [7, 30, 90] as const;
const SESSION_STATE: Record<string, string> = { lancee: "lancées", tenue: "tenues", cassee: "cassées", arretee: "arrêtées" };

function label(screen: string): string {
  const m = screen.match(/^(\d+)-(.+)$/);
  return m ? `${m[1]}. ${SCREEN[m[2]] ?? m[2]}` : (SCREEN[screen] ?? screen);
}

function pct(a: number, b: number): string {
  return b ? `${Math.round((100 * a) / b)} %` : "—";
}

/** Barre proportionnelle en SVG (pas de style en ligne : CSP stricte). */
function Bar({ value, max }: { value: number; max: number }) {
  const w = max ? Math.max(1, (100 * value) / max) : 0;
  return (
    <svg viewBox="0 0 100 4" preserveAspectRatio="none" className="mt-1.5 block h-1.5 w-full" aria-hidden="true">
      <rect width="100" height="4" rx="2" className="fill-white/10" />
      <rect width={w} height="4" rx="2" className="fill-[#9b6bff]" />
    </svg>
  );
}

/**
 * Entonnoir du questionnaire et usage des preuves, mesurés chez Nonante (table analytics_events, v16) : visites
 * distinctes par écran, abandon d'un écran à l'autre, plans choisis, paiements lancés, minuteur, calcul mental.
 */
export default async function FunnelPage({ searchParams }: PageProps<"/admin/entonnoir">) {
  const { supabase } = await requireAdmin();
  const asked = Number((await searchParams).jours);
  const days = (PERIODS as readonly number[]).includes(asked) ? asked : 30;
  const { data, error } = await supabase.rpc("admin_funnel", { p_days: days });
  if (error) return <p role="alert">{error.message}</p>;
  const f = data as Funnel;
  const top = f.quiz[0]?.visits ?? 0;
  const max = Math.max(1, ...f.quiz.map((q) => q.visits));
  const chosen = f.plans.reduce((n, p) => n + p.visits, 0);

  return (
    <div className="space-y-14">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">Entonnoir</h1>
          <p className="mt-1 text-sm text-mute">Depuis le {formatDayFr(f.from)}. Visites anonymes, comptées une fois par écran.</p>
        </div>
        <nav className="flex gap-2 text-sm">
          {PERIODS.map((p) => (
            <Link key={p} href={`/admin/entonnoir?jours=${p}`} aria-current={p === days ? "page" : undefined} className={`border px-3 py-1.5 ${p === days ? "border-paper" : "border-line text-mute"}`}>
              {p} jours
            </Link>
          ))}
        </nav>
      </header>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          ["Ont commencé le questionnaire", String(top)],
          ["Ont vu les plans", String(f.quiz.find((q) => q.screen === "result")?.visits ?? 0)],
          ["Ont choisi un plan", String(chosen)],
          ["Sont partis payer (Stripe)", String(f.checkout)],
        ].map(([k, v]) => (
          <div key={k} className="border border-line p-4">
            <p className="font-display text-3xl tabular-nums">{v}</p>
            <p className="mt-1 text-xs text-mute">{k}</p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="font-display text-3xl">Questionnaire, écran par écran</h2>
        {f.quiz.length ? (
          <ol className="mt-4 divide-y divide-line border-y border-line text-sm">
            {f.quiz.map((q, i) => {
              const prev = i ? f.quiz[i - 1].visits : q.visits;
              const lost = prev - q.visits;
              return (
                <li key={q.screen} className="py-2.5">
                  <div className="flex items-baseline justify-between gap-4">
                    <span>{label(q.screen)}</span>
                    <span className="shrink-0 tabular-nums">
                      {q.visits} <span className="text-mute">· {pct(q.visits, top)} du départ</span>
                      {i && lost > 0 ? <span className="text-ko"> · −{pct(lost, prev)}</span> : null}
                    </span>
                  </div>
                  <Bar value={q.visits} max={max} />
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="mt-4 text-sm text-mute">Pas encore de données sur cette période.</p>
        )}
        <p className="mt-2 text-xs text-mute">En rouge : part des visiteurs de l&apos;écran précédent qui s&apos;arrêtent là.</p>
      </section>

      <section>
        <h2 className="font-display text-3xl">Plans choisis</h2>
        <ul className="mt-4 divide-y divide-line border-y border-line text-sm">
          {f.plans.length ? (
            f.plans.map((p) => (
              <li key={`${p.plan}-${p.interval}`} className="flex justify-between py-2">
                <span>
                  {PLAN_NAME[p.plan] ?? p.plan} · {p.interval}
                </span>
                <span className="tabular-nums">{p.visits}</span>
              </li>
            ))
          ) : (
            <li className="py-2 text-mute">Aucun.</li>
          )}
        </ul>
      </section>

      <section className="grid gap-10 sm:grid-cols-2">
        <div>
          <h2 className="font-display text-3xl">Minuteur</h2>
          <ul className="mt-4 divide-y divide-line border-y border-line text-sm">
            {Object.entries(SESSION_STATE).map(([k, v]) => (
              <li key={k} className="flex justify-between py-2">
                <span>Sessions {v}</span>
                <span className="tabular-nums">{f.sessions[k] ?? 0}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-mute">Tenues sur lancées : {pct(f.sessions.tenue ?? 0, f.sessions.lancee ?? 0)}.</p>
        </div>
        <div>
          <h2 className="font-display text-3xl">Calcul mental</h2>
          <ul className="mt-4 divide-y divide-line border-y border-line text-sm">
            <li className="flex justify-between py-2">
              <span>Calculs faits</span>
              <span className="tabular-nums">{f.math.quizzes}</span>
            </li>
            <li className="flex justify-between py-2">
              <span>Bonnes réponses en moyenne (sur 5)</span>
              <span className="tabular-nums">{f.math.avg_right ?? "—"}</span>
            </li>
            <li className="flex justify-between py-2">
              <span>Niveau moyen (sur 10)</span>
              <span className="tabular-nums">{f.math.avg_level ?? "—"}</span>
            </li>
          </ul>
        </div>
      </section>

      <section>
        <h2 className="font-display text-3xl">Questionnaires commencés par jour</h2>
        <ul className="mt-4 divide-y divide-line border-y border-line text-sm">
          {f.days.length ? (
            f.days.map((d) => (
              <li key={d.day} className="flex justify-between py-2">
                <span>{formatDayFr(d.day)}</span>
                <span className="tabular-nums">{d.visits}</span>
              </li>
            ))
          ) : (
            <li className="py-2 text-mute">Aucun.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
