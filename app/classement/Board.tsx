"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/Player";
import { CATEGORY_LABEL, points } from "@/lib/proofs";
import { titleFor } from "@/lib/rules";
import type { Category, LeaderboardRow } from "@/lib/types";

type Period = "semaine" | "total";
type Filter = Category | "toutes";

const CATEGORIES: Filter[] = ["toutes", "business", "mixte", "etudes"];

/** Rang avec ex æquo (comme rank() en SQL) : points, puis série, puis note. */
function rerank(rows: LeaderboardRow[]): LeaderboardRow[] {
  const sorted = [...rows].sort((a, b) => b.points - a.points || b.streak - a.streak || b.ovr - a.ovr);
  let rank = 0;
  return sorted.map((r, i) => {
    const prev = sorted[i - 1];
    if (!prev || prev.points !== r.points || prev.streak !== r.streak || prev.ovr !== r.ovr) rank = i + 1;
    return { ...r, rank };
  });
}

/**
 * Les deux périodes arrivent ensemble du serveur : changer de période ou de catégorie est instantané
 * (pas d'aller-retour), et l'adresse suit pour pouvoir partager le lien.
 */
export function Board({
  week,
  total,
  initialPeriod,
  initialCategory,
}: {
  week: LeaderboardRow[];
  total: LeaderboardRow[];
  initialPeriod: Period;
  initialCategory: Filter;
}) {
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [category, setCategory] = useState<Filter>(initialCategory);

  const rows = useMemo(() => {
    const source = period === "semaine" ? week : total;
    return category === "toutes" ? source : rerank(source.filter((r) => r.category === category));
  }, [period, category, week, total]);
  const me = rows.find((r) => r.is_me);

  function update(next: { period?: Period; category?: Filter }) {
    const p = next.period ?? period;
    const c = next.category ?? category;
    setPeriod(p);
    setCategory(c);
    const url = new URL(window.location.href);
    url.searchParams.set("periode", p);
    url.searchParams.set("categorie", c);
    window.history.replaceState(null, "", url);
  }

  return (
    <>
      <div className="relative mt-6 grid grid-cols-2 border border-line p-1 text-sm" role="tablist" aria-label="Période">
        <span
          aria-hidden="true"
          className={`absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] bg-paper transition-transform duration-300 ease-out ${period === "total" ? "translate-x-full" : ""}`}
        />
        {(["semaine", "total"] as const).map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={period === p}
            onClick={() => update({ period: p })}
            className={`relative z-10 flex h-10 items-center justify-center transition-colors duration-300 ${period === p ? "text-ink" : "text-mute hover:text-paper"}`}
          >
            {p === "semaine" ? "Cette semaine" : "Général"}
          </button>
        ))}
      </div>
      <p className="mt-2 min-h-8 text-xs text-mute">
        {period === "semaine" ? "Depuis lundi : tout le monde repart de zéro chaque semaine." : "Tous les points gagnés et perdus depuis le début."}
      </p>

      <div className="mt-4 flex flex-wrap gap-2 text-sm" role="tablist" aria-label="Catégorie">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={category === c}
            onClick={() => update({ category: c })}
            className={`rounded-full border px-3 py-1 transition-colors duration-200 ${category === c ? "border-paper bg-paper text-ink" : "border-line text-mute hover:text-paper"}`}
          >
            {c === "toutes" ? "Tous" : CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>

      {me && me.rank > 10 ? (
        <p className="mt-6 border border-paper p-3 text-sm">
          Toi : {me.rank}
          <sup>e</sup> · {points(me.points)} points
        </p>
      ) : null}

      <ol key={`${period}-${category}`} className="mt-6 divide-y divide-line border-y border-line">
        {rows.map((r, i) => (
          <li
            key={`${r.rank}-${r.pseudo}-${i}`}
            className={`flex animate-fade items-center gap-3 py-3 ${r.is_me ? "-mx-3 bg-surface px-3" : ""}`}
          >
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
    </>
  );
}
