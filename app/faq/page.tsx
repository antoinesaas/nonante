import type { Metadata } from "next";
import Link from "next/link";
import { Faq } from "@/components/Faq";
import { Hand } from "@/components/Hand";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { EDITOR } from "@/lib/legal";
import { FAQ } from "@/lib/faq";
import { btnPrimary, label } from "@/lib/ui";

export const metadata: Metadata = {
  title: "Questions fréquentes",
  description: "Comment marche un arc de 90 jours, les preuves, les prix, le remboursement, les données.",
};

export default function FaqPage() {
  return (
    <>
      <header className="mx-auto w-full max-w-xl px-5 pt-6">
        <Link href="/" aria-label="Nonante, accueil">
          <Logo />
        </Link>
      </header>
      <main className="mx-auto w-full max-w-xl px-5 pt-14 pb-20">
        <Hand className="animate-rise text-3xl text-mute">tout ce qu&apos;on nous demande</Hand>
        <h1 className="mt-3 animate-rise font-serif text-6xl leading-[0.9] [animation-delay:80ms]">Questions fréquentes.</h1>
        <div className="mt-12 space-y-14">
          {FAQ.map((g, i) => (
            <section key={g.title} className={`animate-rise ${["[animation-delay:120ms]", "[animation-delay:180ms]", "[animation-delay:240ms]", "[animation-delay:300ms]"][i] ?? ""}`}>
              <h2 className={label}>{g.title}</h2>
              <div className="mt-4">
                <Faq items={g.items} />
              </div>
            </section>
          ))}
        </div>
        <section className="mt-16 border-t border-line pt-10">
          <p className="font-serif text-3xl leading-tight">Une autre question ?</p>
          <p className="mt-3 text-mute">
            Écris-nous à{" "}
            <a href={`mailto:${EDITOR.email}`} className="text-paper underline underline-offset-4">
              {EDITOR.email}
            </a>
            , on te répond personnellement.
          </p>
          <Link href="/onboarding" className={`${btnPrimary} mt-8`}>
            Construire mon arc
          </Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
