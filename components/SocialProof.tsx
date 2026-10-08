import { CountUp } from "@/components/CountUp";
import { Avatar } from "@/components/Player";
import { fmt } from "@/lib/i18n/format";
import { getI18n } from "@/lib/i18n/server";
import type { SocialProof as Proof } from "@/lib/types";
import { label } from "@/lib/ui";

/** Seuils sous lesquels un chiffre n'est pas montré (un « 3 joueurs » ne rassure personne). */
const MIN_PLAYERS = 20;
const MIN_ACTIVE = 3;
const DELAYS = ["", "[animation-delay:80ms]", "[animation-delay:160ms]", "[animation-delay:240ms]", "[animation-delay:320ms]"];

/** Preuve sociale : chiffres réels (au-delà d'un seuil) et études publiées, citées sans exagérer. */
export async function SocialProof({ proof, compact = false }: { proof: Proof | null; compact?: boolean }) {
  const { m, locale } = await getI18n();
  const s = m.game.social;
  const live = proof && proof.joueurs >= MIN_PLAYERS;
  const active = proof && proof.joueurs_en_forme.length >= MIN_ACTIVE ? proof.joueurs_en_forme : [];

  return (
    <div className="space-y-10">
      {live ? (
        <div>
          <p className={label}>
            <span aria-hidden="true" className="mr-2 inline-block size-1.5 animate-breathe rounded-full bg-ok align-middle" />
            {s.live}
          </p>
          <dl className="mt-5 grid grid-cols-3 gap-4">
            {[
              [proof.joueurs, s.players],
              [proof.preuves_7j, s.proofsWeek],
              [proof.arcs_en_cours, s.arcsRunning],
            ].map(([n, text]) => (
              <div key={String(text)}>
                <dd className="font-serif text-4xl leading-none">
                  <CountUp value={Number(n)} locale={locale} />
                </dd>
                <dt className="mt-1.5 text-xs text-mute">{text}</dt>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      {active.length ? (
        <div>
          <p className={label}>{s.streaks}</p>
          <ul className="mt-4 space-y-3">
            {active.map((p, i) => (
              <li key={p.pseudo} className={`flex animate-slide items-center gap-3 ${DELAYS[i] ?? ""}`}>
                <Avatar path={p.avatar_path} pseudo={p.pseudo} size={36} className="size-9" />
                <span className="min-w-0 flex-1 truncate text-sm">{p.pseudo}</span>
                <span className="text-xs text-mute tabular-nums">{fmt(s.level, { n: p.level })}</span>
                <span className="font-serif text-xl leading-none tabular-nums">
                  {p.streak}
                  <span className="ml-1 font-sans text-xs text-mute">{s.days}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <p className={label}>{s.research}</p>
        <ul className={`mt-5 grid ${compact ? "gap-5" : "gap-7 lg:grid-cols-3 lg:gap-10"}`}>
          {m.game.research.map((r) => (
            <li key={r.source} className={`grid grid-cols-[5.5rem_1fr] gap-4 ${compact ? "" : "lg:grid-cols-1"}`}>
              <p className="font-serif text-5xl leading-none">
                {r.figure}
                <span className="mt-0.5 block -rotate-2 font-hand text-xl leading-none text-mute">{r.unit}</span>
              </p>
              <div>
                <p className="text-sm leading-relaxed text-paper/90">{r.text}</p>
                <p className="mt-1.5 text-[11px] text-mute">{r.source}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
