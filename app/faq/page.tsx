import type { Metadata } from "next";
import Link from "next/link";
import { Faq } from "@/components/Faq";
import { Hand } from "@/components/Hand";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { getI18n } from "@/lib/i18n/server";
import { EDITOR } from "@/lib/legal";
import { btnPrimary, label } from "@/lib/ui";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.faq.metaTitle, description: m.faq.metaDescription };
}

const DELAYS = ["[animation-delay:120ms]", "[animation-delay:180ms]", "[animation-delay:240ms]", "[animation-delay:300ms]"];

export default async function FaqPage() {
  const { m } = await getI18n();
  const [before, after] = m.faq.write.split("{email}");
  return (
    <>
      <header className="mx-auto w-full max-w-xl px-5 pt-6 lg:max-w-3xl">
        <Link href="/" aria-label={m.common.homeAria}>
          <Logo />
        </Link>
      </header>
      <main className="mx-auto w-full max-w-xl px-5 pt-14 pb-20 lg:max-w-3xl">
        <Hand className="animate-rise text-3xl text-mute">{m.faq.hand}</Hand>
        <h1 className="mt-3 animate-rise font-serif text-6xl leading-[0.9] [animation-delay:80ms]">{m.faq.title}</h1>
        <div className="mt-12 space-y-14">
          {m.faq.groups.map((g, i) => (
            <section key={g.title} className={`animate-rise ${DELAYS[i] ?? ""}`}>
              <h2 className={label}>{g.title}</h2>
              <div className="mt-4">
                <Faq items={g.items} />
              </div>
            </section>
          ))}
        </div>
        <section className="mt-16 border-t border-line pt-10">
          <p className="font-serif text-3xl leading-tight">{m.faq.other}</p>
          <p className="mt-3 text-mute">
            {before}
            <a href={`mailto:${EDITOR.email}`} className="text-paper underline underline-offset-4">
              {EDITOR.email}
            </a>
            {after}
          </p>
          <Link href="/onboarding" className={`${btnPrimary} mt-8 lg:max-w-sm`}>
            {m.common.actions.buildArc}
          </Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
