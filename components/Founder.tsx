import Image from "next/image";
import { Hand } from "@/components/Hand";
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
    <span aria-hidden="true" className="grid size-14 shrink-0 place-items-center rounded-full bg-linear-to-br from-[#ff2d6f] via-[#9b6bff] to-[#5ac8fa] font-display text-2xl text-white">
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
      <figure className="card flex gap-4 p-5">
        <Portrait alt={f.photoAlt} />
        <div>
          <blockquote className="text-sm leading-relaxed text-paper/85">{f.quote}</blockquote>
          <figcaption className="mt-3 flex items-baseline gap-2 text-xs text-mute">
            <Hand className="text-lg font-semibold">Antoine</Hand>
            {f.roleShort}
          </figcaption>
        </div>
      </figure>
    );
  }

  return (
    <section className="card mx-auto max-w-3xl p-6 lg:p-10">
      <div>
        <p className={label}>{f.label}</p>
        <div className="mt-5 flex items-center gap-4">
          <Portrait alt={f.photoAlt} />
          <h2 className="font-display text-[34px] leading-none">{f.title}</h2>
        </div>
        <div className="mt-6 space-y-3 text-[17px] leading-snug">
          {f.lines.map((line, i) => (
            <p key={line} className={i === f.lines.length - 1 ? "font-display text-[24px] leading-tight text-paper" : "text-paper/80"}>
              {line}
            </p>
          ))}
        </div>
        <p className="mt-8 flex items-baseline gap-3">
          <Hand className="text-2xl font-semibold">Antoine</Hand>
          <span className="text-sm text-mute">{f.role}</span>
        </p>
      </div>
    </section>
  );
}
