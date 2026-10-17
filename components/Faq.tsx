import type { FaqItem } from "@/lib/faq";

/** Accordéon sans JavaScript (details/summary), un « + » qui tourne à l'ouverture. */
export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <div className="grouped overflow-hidden">
      {items.map((f) => (
        <details key={f.id} id={f.id} className="group px-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-4 text-left [&::-webkit-details-marker]:hidden">
            <span className="text-[15px] font-medium">{f.q}</span>
            <span
              aria-hidden="true"
              className="grid size-7 shrink-0 place-items-center rounded-full bg-white/[0.07] text-lg leading-none text-mute transition-transform duration-300 group-open:rotate-45 group-open:text-paper"
            >
              +
            </span>
          </summary>
          <p className="animate-in pb-4 text-sm leading-relaxed text-paper/80">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
