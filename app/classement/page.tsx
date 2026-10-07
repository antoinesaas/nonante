import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { BottomNav } from "@/components/BottomNav";
import { Logo } from "@/components/Logo";
import { Avatar } from "@/components/Player";
import { SiteFooter } from "@/components/SiteFooter";
import { getUser } from "@/lib/auth";
import { CATEGORY_LABEL, plural, points } from "@/lib/proofs";
import { titleFor } from "@/lib/rules";
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

  const [{ data: rowsData }, { data: statsData }, { data: squadData }, { data: mySquads }] = await Promise.all([
    supabase.rpc("leaderboard", { p_period: periode, p_category: categorie === "toutes" ? null : categorie, p_squad: escouade }),
    supabase.rpc("global_stats"),
    escouade ? supabase.rpc("squad_detail", { p_id: escouade }) : Promise.resolve({ data: null }),
    user ? supabase.rpc("my_squads") : Promise.resolve({ data: [] }),
  ]);
  const rows = (rowsData as LeaderboardRow[] | null) ?? [];
  const stats = ((statsData as Stats[] | null) ?? [])[0];
  const squad = squadData as SquadView | null;
  const squads = (mySquads as SquadView[] | null) ?? [];
  const me = rows.find((r) => r.is_me);

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

        <nav className="mt-6 grid grid-cols-2 border border-line p-1 text-sm" aria-label="Période">
          {(["semaine", "total"] as const).map((p) => (
            <Link
              key={p}
              href={href({ periode: p, categorie, escouade })}
              aria-current={periode === p ? "page" : undefined}
              className={`flex h-10 items-center justify-center ${periode === p ? "bg-paper text-ink" : "text-mute hover:text-paper"}`}
            >
              {p === "semaine" ? "Cette semaine" : "Général"}
            </Link>
          ))}
        </nav>
        <p className="mt-2 text-xs text-mute">
          {periode === "semaine" ? "Depuis lundi : tout le monde repart de zéro chaque semaine." : "Tous les points gagnés et perdus depuis le début."}
        </p>

        <nav className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm" aria-label="Catégorie">
          {CATEGORIES.map((c) => (
            <Link
              key={c}
              href={href({ periode, categorie: c, escouade })}
              aria-current={categorie === c ? "page" : undefined}
              className={categorie === c ? "text-paper underline underline-offset-4" : "text-mute hover:text-paper"}
            >
              {c === "toutes" ? "Tous" : CATEGORY_LABEL[c]}
            </Link>
          ))}
        </nav>

        {me && me.rank > 10 ? (
          <p className="mt-6 border border-paper p-3 text-sm">
            Toi : {me.rank}
            <sup>e</sup> · {points(me.points)} points
          </p>
        ) : null}

        <ol className="mt-6 divide-y divide-line border-y border-line">
          {rows.map((r, i) => (
            <li key={`${r.rank}-${i}`} className={`flex items-center gap-3 py-3 ${r.is_me ? "-mx-3 bg-surface px-3" : ""}`}>
              <span className="w-8 shrink-0 font-serif text-xl text-mute tabular-nums">{r.rank}</span>
              <Avatar path={r.avatar_path} pseudo={r.pseudo} size={36} className="size-9" />
              <div className="min-w-0 flex-1">
                {r.is_public ? (
                  <Link href={`/u/${r.pseudo}`} className="block truncate hover:underline">
                    {r.pseudo}
                    {r.is_me ? <span className="text-mute"> · toi</span> : null}
                  </Link>
                ) : (
                  <span className="block truncate text-mute">
                    {r.pseudo}
                    {r.is_me ? " · toi" : ""}
                  </span>
                )}
                <span className="block text-xs text-mute">
                  Niv. {r.level} · {titleFor(r.level)} · note {r.ovr}
                  {r.streak ? ` · série ${r.streak}` : ""}
                </span>
              </div>
              <span className="shrink-0 font-serif text-xl tabular-nums">{points(r.points)}</span>
            </li>
          ))}
          {!rows.length ? <li className="py-6 text-sm text-mute">Personne pour l&apos;instant. Sois le premier.</li> : null}
        </ol>
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
