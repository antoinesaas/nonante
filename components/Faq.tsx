import type { FaqItem } from "@/lib/faq";

/** Accordéon sans JavaScript (details/summary), un « + » qui tourne à l'ouverture. */
export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <div className="divide-y divide-line border-y border-line">
      {items.map((f) => (
        <details key={f.id} id={f.id} className="group py-1">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-4 text-left [&::-webkit-details-marker]:hidden">
            <span className="font-medium">{f.q}</span>
            <span
              aria-hidden="true"
              className="mt-0.5 font-serif text-2xl leading-none text-mute transition-transform duration-300 group-open:rotate-45 group-open:text-paper"
            >
              +
            </span>
          </summary>
          <p className="animate-rise pb-5 text-sm leading-relaxed text-paper/80">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
