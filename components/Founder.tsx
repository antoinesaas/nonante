import Image from "next/image";
import { Hand } from "@/components/Hand";
import { label } from "@/lib/ui";

// Photo du fondateur : déposer public/fondateur.jpg (format portrait) puis passer HAS_PHOTO à true.
// (Sur Vercel, le dossier public n'est pas lisible par le serveur : pas de détection automatique.)
const PHOTO = "/fondateur.jpg";
const HAS_PHOTO = false;

function Portrait({ size }: { size: "sm" | "lg" }) {
  const box = size === "lg" ? "h-28 w-24" : "size-14";
  if (HAS_PHOTO) {
    return (
      <Image
        src={PHOTO}
        alt="Antoine, fondateur de Nonante"
        width={size === "lg" ? 192 : 112}
        height={size === "lg" ? 224 : 112}
        className={`${box} shrink-0 rounded-xs object-cover grayscale`}
      />
    );
  }
  return (
    <span aria-hidden="true" className={`${box} grid shrink-0 place-items-center rounded-xs border border-line bg-surface font-serif text-4xl`}>
      A
    </span>
  );
}

/** Le mot du fondateur, en entier (landing) ou en version courte (résultat du questionnaire). */
export function Founder({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <figure className="flex gap-4 border-y border-line py-6">
        <Portrait size="sm" />
        <div>
          <blockquote className="text-sm leading-relaxed text-paper/85">
            « J&apos;ai lancé un SaaS, de la revente sur Vinted, une chaîne YouTube… Mon problème n&apos;a jamais été les idées,
            c&apos;était la dispersion. Nonante, c&apos;est l&apos;outil qui m&apos;a manqué. »
          </blockquote>
          <figcaption className="mt-3 flex items-baseline gap-2 text-xs text-mute">
            <Hand className="text-2xl text-paper">Antoine</Hand>
            fondateur, étudiant en économie-gestion
          </figcaption>
        </div>
      </figure>
    );
  }

  return (
    <section>
      <p className={label}>Qui est derrière Nonante</p>
      <div className="mt-6 flex items-end gap-5">
        <Portrait size="lg" />
        <div>
          <Hand className="text-2xl text-mute">le fondateur</Hand>
          <h2 className="mt-1 font-serif text-4xl leading-none">Moi, c&apos;est Antoine.</h2>
        </div>
      </div>
      <div className="mt-8 space-y-4 text-lg leading-relaxed text-paper/85">
        <p>
          Je suis étudiant en économie-gestion, en Alsace. Depuis des années, je lance des projets : un SaaS, de la revente
          sur Vinted, une chaîne YouTube, et d&apos;autres encore.
        </p>
        <p>
          Des idées et de l&apos;énergie, j&apos;en ai toujours eu. Mon vrai problème, c&apos;était la dispersion : je
          commençais tout, je changeais de projet dès que ça devenait dur, et je finissais peu de choses.
        </p>
        <p>
          Nonante, c&apos;est l&apos;outil qui m&apos;a manqué : un seul objectif à la fois, des règles claires, et une preuve
          chaque jour. Je l&apos;ai construit pour tous ceux qui ont le même problème que moi.
        </p>
      </div>
      <p className="mt-6 flex items-baseline gap-3">
        <Hand underline className="text-4xl">
          Antoine
        </Hand>
        <span className="text-sm text-mute">fondateur de Nonante</span>
      </p>
    </section>
  );
}
