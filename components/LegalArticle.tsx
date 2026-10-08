import Link from "next/link";
import { Fragment } from "react";
import { EDITOR } from "@/lib/legal";
import type { LegalDoc } from "@/lib/legal-docs/types";

/** Texte avec [libellé](/chemin), {email}, {name} et {address}. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\)|\{email\}|\{name\}|\{address\})/g);
  return (
    <>
      {parts.map((part, i) => {
        const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (link) {
          return (
            <Link key={i} href={link[2]} className="underline underline-offset-4">
              {link[1]}
            </Link>
          );
        }
        if (part === "{email}") {
          return (
            <a key={i} href={`mailto:${EDITOR.email}`} className="underline underline-offset-4">
              {EDITOR.email}
            </a>
          );
        }
        if (part === "{name}") return <Fragment key={i}>{EDITOR.name}</Fragment>;
        if (part === "{address}") return <Fragment key={i}>{EDITOR.address}</Fragment>;
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}

/** Document légal dans la langue de l'utilisateur ; les traductions rappellent que la version française fait foi. */
export function LegalArticle({ doc, notice, frenchHref }: { doc: LegalDoc; notice: string | null; frenchHref: string }) {
  return (
    <>
      <h1>{doc.title}</h1>
      {doc.updated ? <p className="text-sm text-mute">{doc.updated}</p> : null}
      {notice ? (
        <p className="rounded-xs border border-line p-3 text-sm text-mute">
          {notice}{" "}
          <Link href={`${frenchHref}?lang=fr`} className="underline underline-offset-4" hrefLang="fr">
            Version française
          </Link>
        </p>
      ) : null}
      {doc.blocks.map((b, i) =>
        "h2" in b ? (
          <h2 key={i}>{b.h2}</h2>
        ) : "p" in b ? (
          <p key={i}>
            <Rich text={b.p} />
          </p>
        ) : "ul" in b ? (
          <ul key={i}>
            {b.ul.map((li, j) => (
              <li key={j}>
                <Rich text={li} />
              </li>
            ))}
          </ul>
        ) : (
          <blockquote key={i} className="border-l border-line pl-4 text-sm text-mute">
            <Rich text={b.quote} />
          </blockquote>
        ),
      )}
    </>
  );
}
