import { quoteOfDay } from "@/lib/quotes";

/** La citation du jour : la même pour tout le monde. */
export function QuoteCard({ date, className = "" }: { date: string; className?: string }) {
  const q = quoteOfDay(date);
  return (
    <figure className={className}>
      <blockquote className="font-serif text-2xl leading-snug italic">« {q.text} »</blockquote>
      <figcaption className="mt-3 text-xs text-mute">
        {q.author}, <span className="italic">{q.work}</span>
        {q.translated ? " (trad.)" : ""}
      </figcaption>
    </figure>
  );
}
