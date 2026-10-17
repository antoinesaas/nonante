import Link from "next/link";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { getI18n } from "@/lib/i18n/server";

export default async function LegalLayout({ children }: LayoutProps<"/legal">) {
  const { m } = await getI18n();
  return (
    <>
      <header className="mx-auto w-full max-w-xl px-5 pt-[max(1.25rem,env(safe-area-inset-top))] lg:max-w-3xl">
        <Link href="/" aria-label={m.common.homeAria}>
          <Logo />
        </Link>
      </header>
      <main className="mx-auto w-full max-w-xl px-5 pt-12 pb-20 lg:max-w-3xl">
        <article className="space-y-5 text-[15px] leading-relaxed [&_h1]:font-display [&_h1]:text-[38px] [&_h1]:leading-[1.05] [&_h2]:pt-5 [&_h2]:font-display [&_h2]:text-[22px] [&_li]:ml-5 [&_li]:list-disc [&_p]:text-paper/85">
          {children}
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
