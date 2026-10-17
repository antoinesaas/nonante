"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { Avatar } from "@/components/Player";
import { countryFlag, countryName, fmt, formatPoints } from "@/lib/i18n/format";
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
  const types = m.quiz.business.types as Record<string, { label: string }>;
  /** Activité du joueur : « SaaS ou application · Agence ou freelance », « Autre » remplacé par ses mots. */
  const business = (r: LeaderboardRow) =>
    (r.business ?? [])
      .map((b) => (b === "autre" ? r.business_other || types.autre?.label : types[b]?.label))
      .filter(Boolean)
      .join(" · ");

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

  const chip = (on: boolean) => `press h-9 rounded-full px-3.5 text-sm font-medium ${on ? "pearl" : "liquid text-paper/80"}`;

  return (
    <>
      <div className="liquid relative mt-6 grid grid-cols-3 rounded-full p-1 text-sm" role="tablist" aria-label={t.periodAria}>
        <span aria-hidden="true" className={`pearl absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-full transition-transform duration-500 ease-[cubic-bezier(0.3,1.3,0.4,1)] ${SHIFT[period]}`} />
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={period === p}
            onClick={() => update({ period: p })}
            className={`relative z-10 flex h-10 items-center justify-center rounded-full font-medium transition-colors duration-300 ${period === p ? "text-black" : "text-paper/75"}`}
          >
            {t.periods[p]}
          </button>
        ))}
      </div>
      <p className="mt-2 min-h-8 px-1 text-xs text-mute">{t.periodHint[period]}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        {country ? (
          <div className="flex gap-2" role="tablist" aria-label={t.scopeAria}>
            {(["monde", "pays"] as const).map((s) => (
              <button key={s} type="button" role="tab" aria-selected={scope === s} onClick={() => update({ scope: s })} className={chip(scope === s)}>
                {s === "monde" ? t.world : `${countryFlag(country)} ${countryName(country, locale)}`}
              </button>
            ))}
          </div>
        ) : null}
        {country ? <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-white/15" /> : null}
        <div className="flex flex-wrap gap-2" role="tablist" aria-label={t.categoryAria}>
          {CATEGORIES.map((c) => (
            <button key={c} type="button" role="tab" aria-selected={category === c} onClick={() => update({ category: c })} className={chip(category === c)}>
              {c === "toutes" ? t.all : m.game.category[c]}
            </button>
          ))}
        </div>
      </div>

      {me && me.rank > 10 ? <p className="glow-violet mt-6 rounded-2xl p-4 text-sm">{fmt(t.you, { rank: me.rank, points: formatPoints(me.points, locale) })}</p> : null}

      <ol key={`${period}-${category}-${scope}`} className="grouped mt-5 animate-in overflow-hidden">
        {rows.slice(0, SHOWN).map((r, i) => (
          <li key={`${r.rank}-${r.pseudo}-${i}`} className={`flex items-center gap-3 px-3.5 py-3 ${r.is_me ? "bg-white/[0.05]" : ""}`}>
            <span
              className={`grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-semibold tabular-nums ${
                r.rank === 1 ? "bg-linear-to-br from-[#ffd35c] to-[#ff8a1f] text-black" : r.rank === 2 ? "bg-linear-to-br from-[#f5f5f7] to-[#9a9aa2] text-black" : r.rank === 3 ? "bg-linear-to-br from-[#ffb48c] to-[#b0552a] text-black" : "text-mute"
              }`}
            >
              {r.rank}
            </span>
            <Avatar path={r.avatar_path} pseudo={r.pseudo} size={36} className="size-9" />
            <div className="min-w-0 flex-1">
              {r.is_public ? (
                <Link href={`/u/${r.pseudo}`} className="block truncate hover:underline">
                  {r.pseudo}
                  {r.country ? (
                    <span className="ml-1.5 no-underline" role="img" aria-label={countryName(r.country, locale)} title={countryName(r.country, locale)}>
                      {countryFlag(r.country)}
                    </span>
                  ) : null}
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
              </span>
              {business(r) ? <span className="block truncate text-xs text-paper/80">{business(r)}</span> : null}
            </div>
            <span className={`shrink-0 font-display text-[17px] tabular-nums ${r.points < 0 ? "text-ko" : ""}`}>{formatPoints(r.points, locale)}</span>
          </li>
        ))}
        {!rows.length ? <li className="px-4 py-6 text-sm text-mute">{t.empty}</li> : null}
      </ol>
      {me && me.rank > SHOWN ? (
        <p className="mt-3 text-sm text-mute">{fmt(t.you, { rank: me.rank, points: formatPoints(me.points, locale) })}</p>
      ) : null}
    </>
  );
}
