import { Fragment } from "react";

/**
 * En Instrument Serif, « 1er » se lit « ler » : on passe « er » en exposant (1ᵉʳ),
 * comme le veut la typographie française.
 */
export function Ordinals({ children }: { children: string }) {
  const parts = children.split(/\b1er\b/);
  return parts.map((part, i) => (
    <Fragment key={i}>
      {part}
      {i < parts.length - 1 ? (
        <>
          1<sup className="ml-[0.04em] align-[0.6em] text-[0.5em]">er</sup>
        </>
      ) : null}
    </Fragment>
  ));
}
