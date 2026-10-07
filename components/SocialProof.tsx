import { CountUp } from "@/components/CountUp";
import { Avatar } from "@/components/Player";
import type { SocialProof as Proof } from "@/lib/types";
import { label } from "@/lib/ui";

// Ce que dit la recherche : études publiées, citées sans exagérer leurs résultats.
export const RESEARCH = [
  {
    figure: "66",
    unit: "jours",
    text: "En moyenne, pour qu'une nouvelle habitude devienne automatique. 90 jours laissent le temps d'y arriver.",
    source: "Lally et al., European Journal of Social Psychology, 2010",
  },
  {
    figure: "94",
    unit: "études",
    text: "Formuler ses objectifs en « si… alors… » augmente nettement les chances de les atteindre. Tous tes principes sont écrits comme ça.",
    source: "Gollwitzer et Sheeran, Advances in Experimental Social Psychology, 2006",
  },
  {
    figure: "138",
    unit: "études",
    text: "Suivre ses progrès aide à atteindre ses objectifs, surtout quand on les note ou qu'on les rend publics. C'est le rôle des preuves et du classement.",
    source: "Harkin et al., Psychological Bulletin, 2016",
  },
] as const;

/** Seuils sous lesquels un chiffre n'est pas montré (un « 3 joueurs » ne rassure personne). */
const MIN_PLAYERS = 20;
const MIN_ACTIVE = 3;

export function SocialProof({ proof, compact = false }: { proof: Proof | null; compact?: boolean }) {
  const live = proof && proof.joueurs >= MIN_PLAYERS;
  const active = proof?.joueurs_en_forme.length && proof.joueurs_en_forme.length >= MIN_ACTIVE ? proof.joueurs_en_forme : [];

  return (
    <div className="space-y-10">
      {live ? (
        <div>
          <p className={label}>
            <span aria-hidden="true" className="mr-2 inline-block size-1.5 animate-breathe rounded-full bg-ok align-middle" />
            En ce moment sur Nonante
          </p>
          <dl className="mt-5 grid grid-cols-3 gap-4">
            {[
              [proof.joueurs, "joueurs"],
              [proof.preuves_7j, "preuves cette semaine"],
              [proof.arcs_en_cours, "arcs en cours"],
            ].map(([n, text]) => (
              <div key={String(text)}>
                <dd className="font-serif text-4xl leading-none">
                  <CountUp value={Number(n)} />
                </dd>
                <dt className="mt-1.5 text-xs text-mute">{text}</dt>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      {active.length ? (
        <div>
          <p className={label}>Ils tiennent leur série</p>
          <ul className="mt-4 space-y-3">
            {active.map((p, i) => (
              <li
                key={p.pseudo}
                className={`flex animate-slide items-center gap-3 ${["", "[animation-delay:80ms]", "[animation-delay:160ms]", "[animation-delay:240ms]", "[animation-delay:320ms]"][i]}`}
              >
                <Avatar path={p.avatar_path} pseudo={p.pseudo} size={36} className="size-9" />
                <span className="min-w-0 flex-1 truncate text-sm">{p.pseudo}</span>
                <span className="text-xs text-mute tabular-nums">niv. {p.level}</span>
                <span className="font-serif text-xl leading-none tabular-nums">
                  {p.streak}
                  <span className="ml-1 font-sans text-xs text-mute">j</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <p className={label}>Ce que dit la recherche</p>
        <ul className={`mt-5 ${compact ? "space-y-5" : "space-y-7"}`}>
          {RESEARCH.map((r) => (
            <li key={r.source} className="grid grid-cols-[5.5rem_1fr] gap-4">
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
