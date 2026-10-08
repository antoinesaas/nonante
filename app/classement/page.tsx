import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { Board, type Period } from "@/app/classement/Board";
import { BottomNav } from "@/components/BottomNav";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { getUser } from "@/lib/auth";
import { fmt } from "@/lib/i18n/format";
import { getCountry, getI18n } from "@/lib/i18n/server";
import { navTabs } from "@/lib/nav";
import type { Category, LeaderboardRow, SquadView } from "@/lib/types";
import { label } from "@/lib/ui";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.pages.leaderboard.metaTitle, description: m.pages.leaderboard.metaDescription };
}

type Stats = { joueurs: number; arcs_en_cours: number; verts_aujourdhui: number; ont_lache: number; arcs_tenus: number };

const CATEGORIES: (Category | "toutes")[] = ["toutes", "business", "mixte", "etudes"];
const PERIODS: Period[] = ["semaine", "mois", "total"];

function href(params: { periode: string; categorie: string; escouade?: string | null }) {
  const q = new URLSearchParams({ periode: params.periode, categorie: params.categorie });
  if (params.escouade) q.set("escouade", params.escouade);
  return `/classement?${q}`;
}

export default async function LeaderboardPage({ searchParams }: PageProps<"/classement">) {
  const params = await searchParams;
  const periode = PERIODS.includes(params.periode as Period) ? (params.periode as Period) : "semaine";
  const categorie = CATEGORIES.includes(params.categorie as Category) ? (params.categorie as Category | "toutes") : "toutes";
  const requested = z.uuid().safeParse(params.escouade);
  const escouade = requested.success ? requested.data : null;
  const [{ supabase, user }, { m, locale }] = await Promise.all([getUser(), getI18n()]);
  const t = m.pages.leaderboard;

  // Les trois périodes d'un coup : changer de période, de zone ou de catégorie se fait ensuite sans recharger.
  const board = (p: Period) => supabase.rpc("leaderboard", { p_period: p, p_category: null, p_squad: escouade });
  const [{ data: week }, { data: month }, { data: total }, { data: statsData }, { data: squadData }, { data: mySquads }, { data: me }, tabs] = await Promise.all([
    board("semaine"),
    board("mois"),
    board("total"),
    supabase.rpc("global_stats"),
    escouade ? supabase.rpc("squad_detail", { p_id: escouade }) : Promise.resolve({ data: null }),
    user ? supabase.rpc("my_squads") : Promise.resolve({ data: [] }),
    user ? supabase.from("profiles").select("country").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    navTabs(),
  ]);
  const stats = ((statsData as Stats[] | null) ?? [])[0];
  const squad = squadData as SquadView | null;
  const squads = (mySquads as SquadView[] | null) ?? [];
  const country = (me as { country: string | null } | null)?.country ?? (await getCountry());

  return (
    <>
      <main className={`mx-auto w-full max-w-xl px-5 pt-6 lg:max-w-3xl ${user ? "pb-32 lg:pt-24" : "pb-12"}`}>
        {user ? null : (
          <Link href="/" aria-label={m.common.homeAria}>
            <Logo size="sm" />
          </Link>
        )}
        <p className={`${label} ${user ? "mt-4" : "mt-10"}`}>{squad ? fmt(t.squad, { name: squad.name }) : t.allPlayers}</p>
        <h1 className="mt-3 font-serif text-5xl leading-none">{t.title}</h1>
        {stats && !squad ? (
          <p className="mt-4 text-sm text-mute">
            {fmt(t.stats, { players: stats.joueurs, arcs: stats.arcs_en_cours, green: stats.verts_aujourdhui, quit: stats.ont_lache }, locale)}
          </p>
        ) : squad ? (
          <p className="mt-4 text-sm text-mute">{fmt(t.members, { n: squad.members }, locale)}</p>
        ) : null}

        {squads.length ? (
          <nav className="mt-6 flex flex-wrap gap-2 text-sm" aria-label={t.squadsAria}>
            <Link
              href={href({ periode, categorie })}
              aria-current={!escouade ? "page" : undefined}
              className={`rounded-full border px-3.5 py-1.5 ${!escouade ? "border-paper bg-paper text-ink" : "border-line text-mute"}`}
            >
              {t.all}
            </Link>
            {squads.map((s) => (
              <Link
                key={s.id}
                href={href({ periode, categorie, escouade: s.id })}
                aria-current={escouade === s.id ? "page" : undefined}
                className={`rounded-full border px-3.5 py-1.5 ${escouade === s.id ? "border-paper bg-paper text-ink" : "border-line text-mute"}`}
              >
                {s.name}
              </Link>
            ))}
          </nav>
        ) : null}

        <Board
          data={{
            semaine: (week as LeaderboardRow[] | null) ?? [],
            mois: (month as LeaderboardRow[] | null) ?? [],
            total: (total as LeaderboardRow[] | null) ?? [],
          }}
          country={country}
          initialPeriod={periode}
          initialCategory={categorie}
          initialScope={params.zone === "pays" ? "pays" : "monde"}
        />
        <p className="mt-4 text-xs text-mute">{t.ties}</p>
        {!user ? (
          <Link href="/onboarding" className="mt-8 block rounded-xs border border-paper p-4 text-center transition-colors hover:bg-paper hover:text-ink">
            {t.join}
          </Link>
        ) : null}
      </main>
      {user ? <BottomNav wallet={tabs.wallet} grades={tabs.grades} /> : <SiteFooter />}
    </>
  );
}
