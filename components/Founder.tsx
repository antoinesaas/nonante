import Image from "next/image";
import { ArtBand } from "@/components/Art";
import { Hand } from "@/components/Hand";
import { IMAGES } from "@/lib/art";
import { getI18n } from "@/lib/i18n/server";
import { label } from "@/lib/ui";

// Photo du fondateur : déposer public/fondateur.jpg (format portrait) puis passer HAS_PHOTO à true.
// (Sur Vercel, le dossier public n'est pas lisible par le serveur : pas de détection automatique.)
const PHOTO = "/fondateur.jpg";
const HAS_PHOTO = false;

function Portrait({ alt }: { alt: string }) {
  if (HAS_PHOTO) {
    return <Image src={PHOTO} alt={alt} width={112} height={112} className="size-14 shrink-0 rounded-full object-cover grayscale" />;
  }
  return (
    <span aria-hidden="true" className="grid size-14 shrink-0 place-items-center rounded-full border border-line bg-surface font-serif text-3xl">
      A
    </span>
  );
}

/** Le mot du fondateur : court et direct (landing), ou en citation (résultat du questionnaire). */
export async function Founder({ compact = false }: { compact?: boolean }) {
  const { m } = await getI18n();
  const f = m.founder;
  if (compact) {
    return (
      <figure className="flex gap-4 border-y border-line py-6">
        <Portrait alt={f.photoAlt} />
        <div>
          <blockquote className="text-sm leading-relaxed text-paper/85">{f.quote}</blockquote>
          <figcaption className="mt-3 flex items-baseline gap-2 text-xs text-mute">
            <Hand className="text-2xl text-paper">Antoine</Hand>
            {f.roleShort}
          </figcaption>
        </div>
      </figure>
    );
  }

  return (
    <section className="lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:gap-16">
      <ArtBand slug={IMAGES.founder} className="-mx-5 h-72 lg:mx-0 lg:h-[30rem]" />
      <div className="mt-2 lg:mt-0">
        <p className={label}>{f.label}</p>
        <div className="mt-5 flex items-center gap-4">
          <Portrait alt={f.photoAlt} />
          <h2 className="font-serif text-5xl leading-none">{f.title}</h2>
        </div>
        <div className="mt-8 space-y-4 text-xl leading-snug">
          {f.lines.map((line, i) => (
            <p key={line} className={i === f.lines.length - 1 ? "font-serif text-3xl leading-tight text-paper" : "text-paper/80"}>
              {line}
            </p>
          ))}
        </div>
        <p className="mt-8 flex items-baseline gap-3">
          <Hand underline className="text-4xl">
            Antoine
          </Hand>
          <span className="text-sm text-mute">{f.role}</span>
        </p>
      </div>
    </section>
  );
}
