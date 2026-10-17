"use client";

import Image from "next/image";
import { ActivityRings, type RingTone } from "@/components/ActivityRings";
import { useI18n } from "@/components/I18nProvider";
import { artSrc, getArt } from "@/lib/art";
import { avatarUrl } from "@/lib/avatar";
import { fmt, formatNumber } from "@/lib/i18n/format";
import { titleFor } from "@/lib/i18n/labels";
import { STAT_KEYS } from "@/lib/stats";
import type { Stats } from "@/lib/types";


export function Avatar({ path, pseudo, size = 48, className = "" }: { path: string | null | undefined; pseudo: string; size?: number; className?: string }) {
  const url = avatarUrl(path);
  const style = `rounded-full bg-raised object-cover shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)] ${className}`;
  if (url) {
    // Image distante déjà ré-encodée en 512 px par le serveur : pas besoin de l'optimiseur.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" width={size} height={size} className={style} />;
  }
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center font-display leading-none text-paper ${style} ${size >= 64 ? "text-3xl" : size >= 40 ? "text-lg" : "text-sm"}`}
    >
      {pseudo.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Couleur de chaque stat (la même que son pilier). */
export const STAT_TONE: Record<(typeof STAT_KEYS)[number], RingTone> = {
  discipline: "sky",
  focus: "blue",
  corps: "amber",
  business: "mint",
  esprit: "violet",
  energie: "rose",
};

const STEPS = ["w-0", "w-[10%]", "w-[20%]", "w-[30%]", "w-[40%]", "w-[50%]", "w-[60%]", "w-[70%]", "w-[80%]", "w-[90%]", "w-full"];

/** Barre de stat 0-99, en dégradé. */
export function StatBar({ value }: { value: number }) {
  const width = Math.max(0, Math.min(99, value));
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]" aria-hidden="true">
      <span className={`block h-1.5 rounded-full bg-linear-to-r from-violet to-sky ${STEPS[Math.round(width / 10)]}`} />
    </span>
  );
}

/** Les 6 stats en anneaux (façon Apple Forme) : chaque anneau se remplit jusqu'à sa note sur 99. */
export function StatGrid({ stats, compact = false }: { stats: Stats; compact?: boolean }) {
  const { m } = useI18n();
  const size = compact ? 46 : 58;
  return (
    <dl className="grid grid-cols-3 gap-2">
      {STAT_KEYS.map((key) => (
        <div key={key} className="flex flex-col items-center rounded-2xl bg-white/[0.04] px-1 py-3">
          <div className="relative">
            <ActivityRings rings={[{ value: Number(stats[key]), max: 99, tone: STAT_TONE[key] }]} size={size} stroke={compact ? 6 : 7} label="" />
            <dd className="absolute inset-0 grid place-items-center font-display text-[15px] tabular-nums">{stats[key]}</dd>
          </div>
          <dt className="mt-1.5 max-w-full truncate text-[11px] text-mute">{compact ? m.game.stats[key].short : m.game.stats[key].label}</dt>
        </div>
      ))}
    </dl>
  );
}

/** Progression vers le niveau suivant. */
export function XpBar({ stats }: { stats: Stats }) {
  const { m, locale } = useI18n();
  const span = Math.max(1, stats.level_next - stats.level_floor);
  const pct = Math.max(0, Math.min(1, (stats.xp - stats.level_floor) / span));
  return (
    <div>
      <span className="block h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]" aria-hidden="true">
        <span className={`block h-1.5 rounded-full bg-linear-to-r from-rose via-violet to-sky ${STEPS[Math.floor(pct * 10)]}`} />
      </span>
      <p className="mt-1.5 flex justify-between text-[11px] text-mute tabular-nums">
        <span>{fmt(m.game.stats.xp, { xp: formatNumber(stats.xp, locale) })}</span>
        <span>{fmt(m.game.stats.nextLevel, { level: stats.level + 1, xp: formatNumber(stats.level_next, locale) })}</span>
      </p>
    </div>
  );
}

/** La carte de joueur : fond choisi, note globale, niveau, titre, les 6 stats. */
export function PlayerCard({
  pseudo,
  avatarPath,
  stats,
  art,
  founder = false,
  subtitle,
  avatarSlot,
  editSlot,
}: {
  pseudo: string;
  avatarPath: string | null;
  stats: Stats;
  art: string | null;
  founder?: boolean;
  subtitle?: string | null;
  /** Remplace la photo (profil : photo cliquable pour la changer). */
  avatarSlot?: React.ReactNode;
  /** Bouton en bas à droite de la carte (profil : changer le fond). */
  editSlot?: React.ReactNode;
}) {
  const { m } = useI18n();
  // Fond par défaut (jamais choisi) : le dégradé, pas de photo. Les œuvres débloquées restent au choix.
  const background = art && art !== "nuit-tours" ? getArt(art) : null;
  return (
    <section className="card relative overflow-hidden" aria-label={fmt(m.game.stats.cardAria, { pseudo })}>
      {background ? (
        <>
          <Image
            key={background.slug}
            src={artSrc(background, "nb")}
            alt=""
            width={background.width}
            height={background.height}
            sizes="(max-width: 640px) 100vw, 576px"
            className="absolute inset-0 h-full w-full animate-fade object-cover"
          />
          <div className="absolute inset-0 bg-linear-to-b from-black/70 via-black/80 to-black/90" />
        </>
      ) : (
        <div aria-hidden="true" className="glow-violet absolute inset-x-0 top-0 h-48 opacity-70 [mask-image:linear-gradient(to_bottom,#000,transparent)]" />
      )}
      <div className={`relative z-10 p-5 ${editSlot ? "pb-16" : ""}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-dot text-[56px] leading-none">{stats.ovr}</p>
            <p className="mt-1 text-[12px] font-medium text-paper/70">{m.game.stats.overall}</p>
          </div>
          {avatarSlot ?? <Avatar path={avatarPath} pseudo={pseudo} size={72} className="size-18" />}
        </div>
        <h2 className="mt-5 font-display text-[30px] leading-none break-words">{pseudo}</h2>
        <p className="mt-1.5 text-sm text-paper/70">
          {fmt(m.game.stats.level, { level: stats.level })} · {titleFor(stats.level, m)}
          {founder ? ` · ${m.game.stats.founder}` : ""}
          {subtitle ? ` · ${subtitle}` : ""}
        </p>
        <div className="mt-4">
          <XpBar stats={stats} />
        </div>
        <div className="mt-6">
          <StatGrid stats={stats} />
        </div>
      </div>
      {editSlot ? <div className="absolute right-3 bottom-3 z-20">{editSlot}</div> : null}
    </section>
  );
}
