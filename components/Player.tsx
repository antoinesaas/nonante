import Image from "next/image";
import { artSrc, getArt } from "@/lib/art";
import { avatarUrl } from "@/lib/avatar";
import { titleFor } from "@/lib/rules";
import type { Stats } from "@/lib/types";

export const STAT_ROWS: { key: keyof Stats; label: string; short: string; help: string }[] = [
  { key: "discipline", label: "Discipline", short: "DIS", help: "Jours verts sur les 30 derniers jours clos." },
  { key: "focus", label: "Focus", short: "FOC", help: "Points des principes Focus sur 30 jours." },
  { key: "business", label: "Business", short: "BUS", help: "Principes Business et revenus prouvés sur 30 jours." },
  { key: "corps", label: "Corps", short: "COR", help: "Principes Corps (pompes, squats, sport) sur 30 jours." },
  { key: "esprit", label: "Esprit", short: "ESP", help: "Lecture, journal, apprentissage sur 30 jours." },
  { key: "energie", label: "Énergie", short: "ÉNE", help: "Réveil, sommeil, hygiène de vie sur 30 jours." },
];

export function Avatar({ path, pseudo, size = 48, className = "" }: { path: string | null | undefined; pseudo: string; size?: number; className?: string }) {
  const url = avatarUrl(path);
  const style = `rounded-full border border-line bg-surface object-cover ${className}`;
  if (url) {
    // Image distante déjà ré-encodée en 512 px par le serveur : pas besoin de l'optimiseur.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" width={size} height={size} className={style} />;
  }
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center font-serif leading-none text-paper ${style} ${size >= 64 ? "text-3xl" : size >= 40 ? "text-lg" : "text-sm"}`}
    >
      {pseudo.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Barre de stat 0-99, blanche. */
export function StatBar({ value }: { value: number }) {
  const width = Math.max(0, Math.min(99, value));
  const steps = ["w-0", "w-[10%]", "w-[20%]", "w-[30%]", "w-[40%]", "w-[50%]", "w-[60%]", "w-[70%]", "w-[80%]", "w-[90%]", "w-full"];
  return (
    <span className="block h-1 w-full bg-line" aria-hidden="true">
      <span className={`block h-1 bg-paper ${steps[Math.round(width / 10)]}`} />
    </span>
  );
}

export function StatGrid({ stats, compact = false }: { stats: Stats; compact?: boolean }) {
  return (
    <dl className={`grid grid-cols-3 ${compact ? "gap-x-4 gap-y-3" : "gap-x-5 gap-y-4"}`}>
      {STAT_ROWS.map((row) => (
        <div key={row.key} className="min-w-0">
          <dt className="truncate text-[10px] tracking-[0.12em] text-mute uppercase">{compact ? row.short : row.label}</dt>
          <dd className={`mt-0.5 font-serif leading-none tabular-nums ${compact ? "text-xl" : "text-2xl"}`}>{stats[row.key]}</dd>
          <dd className="mt-1.5">
            <StatBar value={Number(stats[row.key])} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Progression vers le niveau suivant. */
export function XpBar({ stats }: { stats: Stats }) {
  const span = Math.max(1, stats.level_next - stats.level_floor);
  const pct = Math.max(0, Math.min(1, (stats.xp - stats.level_floor) / span));
  const steps = ["w-0", "w-[10%]", "w-[20%]", "w-[30%]", "w-[40%]", "w-[50%]", "w-[60%]", "w-[70%]", "w-[80%]", "w-[90%]", "w-full"];
  return (
    <div>
      <span className="block h-0.5 w-full bg-line" aria-hidden="true">
        <span className={`block h-0.5 bg-paper ${steps[Math.floor(pct * 10)]}`} />
      </span>
      <p className="mt-1.5 flex justify-between text-[11px] text-mute tabular-nums">
        <span>{stats.xp.toLocaleString("fr-FR")} XP</span>
        <span>niveau {stats.level + 1} à {stats.level_next.toLocaleString("fr-FR")}</span>
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
}: {
  pseudo: string;
  avatarPath: string | null;
  stats: Stats;
  art: string | null;
  founder?: boolean;
  subtitle?: string | null;
}) {
  const background = getArt(art);
  return (
    <section className="relative overflow-hidden border border-line bg-surface" aria-label={`Carte de joueur de ${pseudo}`}>
      {background ? (
        <>
          <Image
            src={artSrc(background, "nb")}
            alt=""
            width={background.width}
            height={background.height}
            sizes="(max-width: 640px) 100vw, 576px"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-ink/80" />
        </>
      ) : null}
      <div className="relative z-10 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-serif text-6xl leading-none tabular-nums">{stats.ovr}</p>
            <p className="mt-1 text-[10px] tracking-[0.2em] text-mute uppercase">Note globale</p>
          </div>
          <Avatar path={avatarPath} pseudo={pseudo} size={72} className="size-18" />
        </div>
        <h2 className="mt-6 font-serif text-4xl leading-none break-words">{pseudo}</h2>
        <p className="mt-2 text-sm text-mute">
          Niveau {stats.level} · {titleFor(stats.level)}
          {founder ? " · Fondateur" : ""}
          {subtitle ? ` · ${subtitle}` : ""}
        </p>
        <div className="mt-4">
          <XpBar stats={stats} />
        </div>
        <div className="mt-6">
          <StatGrid stats={stats} />
        </div>
      </div>
    </section>
  );
}
