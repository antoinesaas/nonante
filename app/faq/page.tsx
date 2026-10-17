import type { Metadata } from "next";
import Link from "next/link";
import { Faq } from "@/components/Faq";
import { Aura } from "@/components/Aura";
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
      <div className="relative isolate overflow-x-clip">
        <Aura tone="sky" />
        <header className="mx-auto w-full max-w-xl px-5 pt-[max(1.25rem,env(safe-area-inset-top))] lg:max-w-3xl">
          <Link href="/" aria-label={m.common.homeAria}>
            <Logo />
          </Link>
        </header>
      </div>
      <main className="mx-auto w-full max-w-xl px-5 pt-12 pb-20 lg:max-w-3xl">
        <p className="animate-in bg-linear-to-r from-[#b79bff] to-[#8358e8] bg-clip-text text-[15px] font-semibold text-transparent">{m.faq.hand}</p>
        <h1 className="mt-2 animate-in font-display text-[44px] leading-[1.0] [animation-delay:80ms]">{m.faq.title}</h1>
        <div className="mt-10 space-y-10">
          {m.faq.groups.map((g, i) => (
            <section key={g.title} className={`animate-in ${DELAYS[i] ?? ""}`}>
              <h2 className={`${label} px-1`}>{g.title}</h2>
              <div className="mt-2">
                <Faq items={g.items} />
              </div>
            </section>
          ))}
        </div>
        <section className="glow-violet mt-14 rounded-[2rem] p-6">
          <p className="font-display text-[26px] leading-tight">{m.faq.other}</p>
          <p className="mt-2 text-paper/85">
            {before}
            <a href={`mailto:${EDITOR.email}`} className="text-paper underline underline-offset-4">
              {EDITOR.email}
            </a>
            {after}
          </p>
          <Link href="/onboarding" className={`${btnPrimary} mt-6 lg:max-w-sm`}>
            {m.common.actions.buildArc}
          </Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
