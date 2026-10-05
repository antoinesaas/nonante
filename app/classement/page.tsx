import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { BottomNav } from "@/components/BottomNav";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { getUser } from "@/lib/auth";
import { todayParis } from "@/lib/dates";
import { CATEGORY_LABEL, plural } from "@/lib/proofs";
import type { Category } from "@/lib/types";
import { label } from "@/lib/ui";

export const metadata: Metadata = {
  title: "Classement",
  description: "Le classement de l'arc en cours : des points, rien d'autre. Chiffres exacts, lus en base.",
};

type Row = {
  rank: number;
  pseudo: string;
  category: string;
  points: number;
  green_days: number;
  level: number;
  goal_title: string | null;
  is_me: boolean;
  is_public: boolean;
};

const CATEGORIES: (Category | "toutes")[] = ["toutes", "etudes", "business", "mixte"];

function href(params: { periode: string; categorie: string; cohorte?: string }) {
  const q = new URLSearchParams({ periode: params.periode, categorie: params.categorie });
  if (params.cohorte) q.set("cohorte", params.cohorte);
  return `/classement?${q}`;
}

export default async function LeaderboardPage({ searchParams }: PageProps<"/classement">) {
  const params = await searchParams;
  const periode = params.periode === "semaine" ? "semaine" : "arc";
  const categorie = CATEGORIES.includes(params.categorie as Category) ? (params.categorie as Category) : "toutes";
  const { supabase, user } = await getUser();
  const today = todayParis();

  // Cohorte : celle demandée, sinon celle de l'utilisateur, sinon l'arc en cours, sinon le prochain.
  let cohortId: string | null = null;
  const requested = z.uuid().safeParse(params.cohorte);
  if (requested.success) cohortId = requested.data;
  if (!cohortId && user) {
    const { data: mine } = await supabase
      .from("enrollments")
      .select("cohort_id, created_at")
      .eq("user_id", user.id)
      .neq("status", "pending_payment")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    cohortId = mine?.cohort_id ?? null;
  }
  if (!cohortId) {
    const { data: running } = await supabase
      .from("cohorts")
      .select("id")
      .eq("is_test", false)
      .lte("start_date", today)
      .gte("end_date", today)
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: upcoming } = running
      ? { data: null }
      : await supabase.from("cohorts").select("id").eq("is_test", false).gt("start_date", today).order("start_date").limit(1).maybeSingle();
    cohortId = running?.id ?? upcoming?.id ?? null;
  }

  const { data: cohort } = cohortId
    ? await supabase.from("cohorts").select("id, name, start_date, end_date").eq("id", cohortId).maybeSingle()
    : { data: null };

  const [{ data: rowsData }, { data: statsData }] = cohort
    ? await Promise.all([
        supabase.rpc("leaderboard", {
          p_cohort_id: cohort.id,
          p_category: categorie === "toutes" ? null : categorie,
          p_period: periode,
        }),
        supabase.rpc("cohort_stats", { p_cohort_id: cohort.id }),
      ])
    : [{ data: null }, { data: null }];

  const rows = (rowsData as Row[] | null) ?? [];
  const stats = (statsData as { inscrits: number; actifs: number; ont_lache: number; ont_termine: number; verts_aujourdhui: number }[] | null)?.[0];
  const top = rows.slice(0, 100);
  const me = rows.find((r) => r.is_me);
  const running = cohort ? today >= cohort.start_date && today <= cohort.end_date : false;

  return (
    <>
      <div className={`mx-auto w-full max-w-xl px-5 pt-6 ${user ? "pb-28" : "pb-12"}`}>
        <Link href={user ? "/app" : "/"} aria-label="Nonante">
          <Logo size="sm" />
        </Link>
        <p className={`${label} mt-10`}>{cohort?.name ?? "Classement"}</p>
        <h1 className="mt-3 font-serif text-5xl leading-none">Classement.</h1>

        {stats ? (
          <p className="mt-5 text-sm text-mute">
            {plural(stats.inscrits, "inscrit", "inscrits")} · {plural(stats.actifs, "actif", "actifs")} ·{" "}
            {stats.ont_lache} {stats.ont_lache > 1 ? "ont lâché" : "a lâché"}
            {stats.ont_termine ? ` · ${stats.ont_termine} ont tenu` : ""}
            {running ? ` · ${stats.verts_aujourdhui} déjà verts aujourd'hui` : ""}
          </p>
        ) : null}

        <nav aria-label="Période" className="mt-8 flex gap-6 border-b border-line text-sm">
          {(["arc", "semaine"] as const).map((p) => (
            <Link
              key={p}
              href={href({ periode: p, categorie, cohorte: requested.success ? requested.data : undefined })}
              aria-current={periode === p ? "page" : undefined}
              className={`-mb-px border-b pb-3 ${periode === p ? "border-paper text-paper" : "border-transparent text-mute"}`}
            >
              {p === "arc" ? "Arc" : "Semaine"}
            </Link>
          ))}
        </nav>
        <nav aria-label="Catégorie" className="mt-4 flex flex-wrap gap-2 text-xs">
          {CATEGORIES.map((c) => (
            <Link
              key={c}
              href={href({ periode, categorie: c, cohorte: requested.success ? requested.data : undefined })}
              aria-current={categorie === c ? "page" : undefined}
              className={`rounded-xs border px-3 py-1.5 ${categorie === c ? "border-paper text-paper" : "border-line text-mute"}`}
            >
              {c === "toutes" ? "Toutes" : CATEGORY_LABEL[c]}
            </Link>
          ))}
        </nav>
        {periode === "semaine" ? <p className="mt-4 text-xs text-mute">Points depuis lundi. Nouveau départ chaque semaine.</p> : null}

        {rows.length === 0 ? (
          <p className="mt-10 text-mute">
            {cohort ? "Personne au classement pour l'instant." : "Aucun arc en cours."}
          </p>
        ) : (
          <ol className="mt-6 divide-y divide-line border-y border-line">
            {top.map((r, i) => (
              <Rank key={`${r.rank}-${i}`} row={r} />
            ))}
            {me && !top.includes(me) ? (
              <>
                <li className="py-2 text-center text-xs text-mute">…</li>
                <Rank row={me} />
              </>
            ) : null}
          </ol>
        )}
        <p className="mt-6 text-xs text-mute">
          Égalité : départagée par les jours verts, puis par le moins de jours blancs. Le classement ne rapporte que des points,
          des succès et des œuvres.
        </p>
      </div>
      {user ? <BottomNav /> : <SiteFooter />}
    </>
  );
}

function Rank({ row }: { row: Row }) {
  return (
    <li className={`flex items-center gap-4 py-3 ${row.is_me ? "-mx-3 border border-paper px-3" : ""}`}>
      <span className="w-8 shrink-0 font-serif text-2xl tabular-nums">{row.rank}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate">
          {row.is_public ? (
            <Link href={`/u/${row.pseudo}`} className="hover:underline">
              {row.pseudo}
            </Link>
          ) : (
            <span className="text-mute">{row.pseudo}</span>
          )}
          {row.is_me ? <span className="text-xs text-mute"> · toi</span> : null}
        </p>
        <p className="truncate text-xs text-mute">
          {CATEGORY_LABEL[row.category as Category]} · niv. {row.level} · {row.green_days} verts
          {row.goal_title ? ` · ${row.goal_title}` : ""}
        </p>
      </div>
      <span className="shrink-0 font-serif text-2xl tabular-nums">{row.points}</span>
    </li>
  );
}
