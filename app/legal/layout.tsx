import Link from "next/link";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { getI18n } from "@/lib/i18n/server";

export default async function LegalLayout({ children }: LayoutProps<"/legal">) {
  const { m } = await getI18n();
  return (
    <>
      <header className="mx-auto w-full max-w-xl px-5 pt-6 lg:max-w-3xl">
        <Link href="/" aria-label={m.common.homeAria}>
          <Logo />
        </Link>
      </header>
      <main className="mx-auto w-full max-w-xl px-5 pt-14 pb-20 lg:max-w-3xl">
        <article className="space-y-6 leading-relaxed [&_h1]:font-serif [&_h1]:text-5xl [&_h1]:leading-none [&_h2]:pt-6 [&_h2]:font-serif [&_h2]:text-3xl [&_li]:ml-5 [&_li]:list-disc [&_p]:text-paper/90">
          {children}
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
