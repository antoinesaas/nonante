"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { Avatar } from "@/components/Player";
import { countryName, fmt, formatPoints } from "@/lib/i18n/format";
import { titleFor } from "@/lib/i18n/labels";
import type { Category, LeaderboardRow } from "@/lib/types";

export type Period = "semaine" | "mois" | "total";
type Filter = Category | "toutes";
type Scope = "monde" | "pays";

const PERIODS: Period[] = ["semaine", "mois", "total"];
const CATEGORIES: Filter[] = ["toutes", "business", "mixte", "etudes"];
const SHIFT: Record<Period, string> = { semaine: "", mois: "translate-x-full", total: "translate-x-[200%]" };
const SHOWN = 100;

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
 * Les trois périodes arrivent ensemble du serveur : changer de période, de zone ou de catégorie est instantané
 * (pas d'aller-retour), et l'adresse suit pour pouvoir partager le lien.
 */
export function Board({
  data,
  country,
  initialPeriod,
  initialCategory,
  initialScope,
}: {
  data: Record<Period, LeaderboardRow[]>;
  country: string | null;
  initialPeriod: Period;
  initialCategory: Filter;
  initialScope: Scope;
}) {
  const { m, locale } = useI18n();
  const t = m.pages.leaderboard;
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [category, setCategory] = useState<Filter>(initialCategory);
  const [scope, setScope] = useState<Scope>(country ? initialScope : "monde");

  const rows = useMemo(() => {
    let list = data[period];
    if (scope === "pays" && country) list = list.filter((r) => r.country === country);
    if (category !== "toutes") list = list.filter((r) => r.category === category);
    return scope === "monde" && category === "toutes" ? list : rerank(list);
  }, [period, category, scope, data, country]);
  const me = rows.find((r) => r.is_me);

  function update(next: { period?: Period; category?: Filter; scope?: Scope }) {
    const p = next.period ?? period;
    const c = next.category ?? category;
    const s = next.scope ?? scope;
    setPeriod(p);
    setCategory(c);
    setScope(s);
    const url = new URL(window.location.href);
    url.searchParams.set("periode", p);
    url.searchParams.set("categorie", c);
    url.searchParams.set("zone", s);
    window.history.replaceState(null, "", url);
  }

  const chip = (on: boolean) =>
    `rounded-full border px-3.5 py-1.5 transition-[background-color,border-color,color,transform] duration-200 active:scale-95 ${on ? "border-paper bg-paper text-ink" : "border-line text-mute hover:text-paper"}`;

  return (
    <>
      <div className="relative mt-6 grid grid-cols-3 rounded-full border border-line p-1 text-sm" role="tablist" aria-label={t.periodAria}>
        <span aria-hidden="true" className={`absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-full bg-paper transition-transform duration-300 ease-out ${SHIFT[period]}`} />
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={period === p}
            onClick={() => update({ period: p })}
            className={`relative z-10 flex h-10 items-center justify-center rounded-full transition-colors duration-300 ${period === p ? "text-ink" : "text-mute hover:text-paper"}`}
          >
            {t.periods[p]}
          </button>
        ))}
      </div>
      <p className="mt-2 min-h-8 text-xs text-mute">{t.periodHint[period]}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        {country ? (
          <div className="flex gap-2" role="tablist" aria-label={t.scopeAria}>
            {(["monde", "pays"] as const).map((s) => (
              <button key={s} type="button" role="tab" aria-selected={scope === s} onClick={() => update({ scope: s })} className={chip(scope === s)}>
                {s === "monde" ? t.world : countryName(country, locale)}
              </button>
            ))}
          </div>
        ) : null}
        {country ? <span aria-hidden="true" className="mx-1 h-5 w-px bg-line" /> : null}
        <div className="flex flex-wrap gap-2" role="tablist" aria-label={t.categoryAria}>
          {CATEGORIES.map((c) => (
            <button key={c} type="button" role="tab" aria-selected={category === c} onClick={() => update({ category: c })} className={chip(category === c)}>
              {c === "toutes" ? t.all : m.game.category[c]}
            </button>
          ))}
        </div>
      </div>

      {me && me.rank > 10 ? <p className="mt-6 rounded-xs border border-paper p-3 text-sm">{fmt(t.you, { rank: me.rank, points: formatPoints(me.points, locale) })}</p> : null}

      <ol key={`${period}-${category}-${scope}`} className="mt-6 divide-y divide-line border-y border-line">
        {rows.slice(0, SHOWN).map((r, i) => (
          <li key={`${r.rank}-${r.pseudo}-${i}`} className={`flex animate-fade items-center gap-3 py-3 ${r.is_me ? "-mx-3 bg-surface px-3" : ""}`}>
            <span className={`w-8 shrink-0 font-serif text-xl tabular-nums ${r.rank <= 3 ? "text-paper" : "text-mute"}`}>{r.rank}</span>
            <Avatar path={r.avatar_path} pseudo={r.pseudo} size={36} className="size-9" />
            <div className="min-w-0 flex-1">
              {r.is_public ? (
                <Link href={`/u/${r.pseudo}`} className="block truncate hover:underline">
                  {r.pseudo}
                  {r.is_me ? <span className="text-mute">{t.youShort}</span> : null}
                </Link>
              ) : (
                <span className="block truncate text-mute">
                  {r.pseudo}
                  {r.is_me ? t.youShort : ""}
                </span>
              )}
              <span className="block truncate text-xs text-mute">
                {fmt(t.line, { level: r.level, title: titleFor(r.level, m), ovr: r.ovr })}
                {r.streak ? fmt(t.streak, { n: r.streak }) : ""}
                {r.country && r.is_public && scope === "monde" ? ` · ${r.country}` : ""}
              </span>
            </div>
            <span className="shrink-0 font-serif text-xl tabular-nums">{formatPoints(r.points, locale)}</span>
          </li>
        ))}
        {!rows.length ? <li className="py-6 text-sm text-mute">{t.empty}</li> : null}
      </ol>
      {me && me.rank > SHOWN ? (
        <p className="mt-3 text-sm text-mute">{fmt(t.you, { rank: me.rank, points: formatPoints(me.points, locale) })}</p>
      ) : null}
    </>
  );
}
