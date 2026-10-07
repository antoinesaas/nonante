import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { BottomNav } from "@/components/BottomNav";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { getUser } from "@/lib/auth";
import { Board } from "@/app/classement/Board";
import { plural } from "@/lib/proofs";
import type { Category, LeaderboardRow, SquadView } from "@/lib/types";
import { label } from "@/lib/ui";

export const metadata: Metadata = {
  title: "Classement",
  description: "Le classement des joueurs Nonante : la semaine, le général, ton escouade. Chiffres exacts, lus en base.",
};

type Stats = { joueurs: number; arcs_en_cours: number; verts_aujourdhui: number; ont_lache: number; arcs_tenus: number };

const CATEGORIES: (Category | "toutes")[] = ["toutes", "business", "mixte", "etudes"];

function href(params: { periode: string; categorie: string; escouade?: string | null }) {
  const q = new URLSearchParams({ periode: params.periode, categorie: params.categorie });
  if (params.escouade) q.set("escouade", params.escouade);
  return `/classement?${q}`;
}

export default async function LeaderboardPage({ searchParams }: PageProps<"/classement">) {
  const params = await searchParams;
  const periode = params.periode === "total" ? "total" : "semaine";
  const categorie = CATEGORIES.includes(params.categorie as Category) ? (params.categorie as Category | "toutes") : "toutes";
  const requested = z.uuid().safeParse(params.escouade);
  const escouade = requested.success ? requested.data : null;
  const { supabase, user } = await getUser();

  // Les deux périodes d'un coup : le changement de période ou de catégorie se fait ensuite sans recharger.
  const [{ data: weekData }, { data: totalData }, { data: statsData }, { data: squadData }, { data: mySquads }] = await Promise.all([
    supabase.rpc("leaderboard", { p_period: "semaine", p_category: null, p_squad: escouade }),
    supabase.rpc("leaderboard", { p_period: "total", p_category: null, p_squad: escouade }),
    supabase.rpc("global_stats"),
    escouade ? supabase.rpc("squad_detail", { p_id: escouade }) : Promise.resolve({ data: null }),
    user ? supabase.rpc("my_squads") : Promise.resolve({ data: [] }),
  ]);
  const week = (weekData as LeaderboardRow[] | null) ?? [];
  const total = (totalData as LeaderboardRow[] | null) ?? [];
  const stats = ((statsData as Stats[] | null) ?? [])[0];
  const squad = squadData as SquadView | null;
  const squads = (mySquads as SquadView[] | null) ?? [];

  return (
    <>
      <main className={`mx-auto w-full max-w-xl px-5 pt-6 ${user ? "pb-28" : "pb-12"}`}>
        <Link href={user ? "/app" : "/"} aria-label="Nonante">
          <Logo size="sm" />
        </Link>
        <p className={`${label} mt-10`}>{squad ? `Escouade · ${squad.name}` : "Tous les joueurs"}</p>
        <h1 className="mt-3 font-serif text-5xl leading-none">Classement</h1>
        {stats && !squad ? (
          <p className="mt-4 text-sm text-mute">
            {plural(stats.joueurs, "joueur", "joueurs")} · {plural(stats.arcs_en_cours, "arc en cours", "arcs en cours")} ·{" "}
            {stats.verts_aujourdhui} déjà au vert aujourd&apos;hui · {stats.ont_lache} ont lâché
          </p>
        ) : squad ? (
          <p className="mt-4 text-sm text-mute">{plural(squad.members, "membre", "membres")}</p>
        ) : null}

        {squads.length ? (
          <nav className="mt-6 flex flex-wrap gap-2 text-sm" aria-label="Escouades">
            <Link
              href={href({ periode, categorie })}
              aria-current={!escouade ? "page" : undefined}
              className={`rounded-xs border px-3 py-1.5 ${!escouade ? "border-paper bg-paper text-ink" : "border-line text-mute"}`}
            >
              Tous
            </Link>
            {squads.map((s) => (
              <Link
                key={s.id}
                href={href({ periode, categorie, escouade: s.id })}
                aria-current={escouade === s.id ? "page" : undefined}
                className={`rounded-xs border px-3 py-1.5 ${escouade === s.id ? "border-paper bg-paper text-ink" : "border-line text-mute"}`}
              >
                {s.name}
              </Link>
            ))}
          </nav>
        ) : null}

        <Board week={week} total={total} initialPeriod={periode} initialCategory={categorie} />
        <p className="mt-4 text-xs text-mute">
          Égalité : la plus longue série, puis la meilleure note. Le classement ne rapporte que des points, jamais d&apos;argent.
        </p>
        {!user ? (
          <Link href="/onboarding" className="mt-8 block border border-paper p-4 text-center">
            Entrer dans le classement
          </Link>
        ) : null}
      </main>
      {user ? <BottomNav /> : <SiteFooter />}
    </>
  );
}
