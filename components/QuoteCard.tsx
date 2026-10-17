import { quoteOfDay } from "@/lib/i18n/labels";
import { getI18n } from "@/lib/i18n/server";

/** La citation du jour : la même pour tout le monde, dans la langue de l'utilisateur. */
export async function QuoteCard({ date, className = "" }: { date: string; className?: string }) {
  const { m, locale } = await getI18n();
  const q = quoteOfDay(date, m);
  const open = locale === "fr" ? "« " : locale === "de" ? "„" : "“";
  const close = locale === "fr" ? " »" : locale === "de" ? "“" : "”";
  return (
    <figure className={`border-l-2 border-violet/60 pl-4 ${className}`}>
      <blockquote className="text-[17px] leading-snug font-medium tracking-tight text-paper/85">
        {open}
        {q.text}
        {close}
      </blockquote>
      <figcaption className="mt-2 text-xs text-mute">
        {q.author}, <span className="italic">{q.work}</span>
        {q.translated ? m.common.quoteTranslated : ""}
      </figcaption>
    </figure>
  );
}
