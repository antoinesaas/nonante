import Link from "next/link";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Logo } from "@/components/Logo";
import { getI18n } from "@/lib/i18n/server";
import { EDITOR } from "@/lib/legal";

export async function SiteFooter() {
  const { m } = await getI18n();
  const f = m.common.footer;
  const links = [
    ["/classement", m.common.nav.leaderboard],
    ["/abonnement", f.plans],
    ["/faq", f.faq],
    ["/art", f.credits],
    ["/legal/mentions", f.legal],
    ["/legal/cgu", f.terms],
    ["/legal/cgv", f.sales],
    ["/legal/confidentialite", f.privacy],
  ] as const;
  return (
    <footer className="mx-auto w-full max-w-xl border-t border-line px-5 pt-10 pb-12 text-sm text-mute lg:max-w-6xl lg:px-8">
      <div className="lg:flex lg:items-start lg:justify-between lg:gap-12">
        <div>
          <Link href="/" aria-label={m.common.homeAria}>
            <Logo size="sm" />
          </Link>
          <p className="mt-3 text-xs">{m.common.tagline}</p>
        </div>
        <nav aria-label={f.aria} className="mt-6 flex flex-wrap gap-x-5 gap-y-2 lg:mt-0 lg:grid lg:grid-cols-2 lg:gap-x-12">
          {links.map(([href, label]) => (
            <Link key={href} href={href} className="hover:text-paper">
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-8 lg:mt-0">
          <LanguageSwitcher className="-ml-2" />
          <p className="mt-4 text-xs">
            {f.question}{" "}
            <a href={`mailto:${EDITOR.email}`} className="underline underline-offset-4 hover:text-paper">
              {EDITOR.email}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
