import type { Metadata } from "next";
import Link from "next/link";
import { ArtBand } from "@/components/Art";
import { Logo } from "@/components/Logo";
import { PlanPicker } from "@/components/PlanPicker";
import { SiteFooter } from "@/components/SiteFooter";
import { IMAGES } from "@/lib/art";
import { getUser } from "@/lib/auth";
import type { PlanId, PublicPlans } from "@/lib/types";
import { btnLink, label } from "@/lib/ui";

export const metadata: Metadata = {
  title: "Plans",
  description: "Essentiel, Pro ou Fondateur. Payer, c'est déjà s'engager.",
};

const FAQ = [
  {
    q: "Pourquoi pas de version gratuite ?",
    a: "Parce qu'un arc gratuit se lâche au premier soir difficile. Mettre de l'argent sur la table, c'est le premier principe de l'arc : tu t'engages.",
  },
  {
    q: "Je peux résilier quand je veux ?",
    a: "Oui, en un clic depuis ton profil (portail Stripe). Ton accès reste ouvert jusqu'à la fin de la période payée.",
  },
  {
    q: "Et si j'arrête de payer pendant mon arc ?",
    a: "Ton arc continue de tourner, mais plus rien ne se valide : les jours deviennent blancs. Tu peux reprendre à tout moment.",
  },
  {
    q: "Le parrainage ?",
    a: "Ton code donne −20 % à un ami sur son premier paiement, et 5 € de crédit pour toi à chaque ami qui s'abonne.",
  },
  {
    q: "Si je tiens mon arc ?",
    a: "Ta prochaine facture est à −50 %, appliqué automatiquement. Même règle pour tout le monde, jamais liée au classement.",
  },
];

export default async function SubscriptionPage() {
  const { supabase, user } = await getUser();
  const [{ data: plans }, profile] = await Promise.all([
    supabase.rpc("plans_public"),
    user ? supabase.from("profiles").select("id").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  let current: PlanId | null = null;
  if (user && profile.data) {
    const { data } = await supabase.rpc("my_plan");
    current = ((data as { plan: PlanId | null } | null)?.plan ?? null) as PlanId | null;
  }

  return (
    <>
      <main className="mx-auto min-h-dvh w-full max-w-xl px-5 pt-6 pb-16">
        <Link href={user ? "/app" : "/"} aria-label="Nonante">
          <Logo size="sm" />
        </Link>
        <ArtBand slug={IMAGES.paywall} className="-mx-5 mt-6 h-64">
          <p className={label}>Plans</p>
          <h1 className="mt-2 font-serif text-5xl leading-[0.95]">Payer, c&apos;est déjà s&apos;engager.</h1>
        </ArtBand>
        <p className="mt-6 text-lg leading-relaxed text-paper/85">
          Un arc gratuit, on le lâche. Un arc payé, on le tient. Choisis ton plan : ton arc démarre dès que le paiement
          est confirmé.
        </p>

        {!user ? (
          <p className="mt-6 text-sm text-mute">
            Commence par{" "}
            <Link href="/login?next=/onboarding" className={btnLink}>
              construire ton arc
            </Link>
            , le paiement vient ensuite.
          </p>
        ) : !profile.data ? (
          <p className="mt-6 text-sm text-mute">
            <Link href="/onboarding" className={btnLink}>
              Construis d&apos;abord ton arc
            </Link>{" "}
            : deux minutes, avant de choisir ton plan.
          </p>
        ) : null}

        <div className="mt-10">
          {plans ? <PlanPicker plans={plans as PublicPlans} current={current} /> : <p className="text-mute">Plans indisponibles.</p>}
        </div>

        <p className="mt-6 text-xs text-mute">
          Prix TTC. Paiement sécurisé par Stripe. Codes promo acceptés à l&apos;étape suivante.{" "}
          <Link href="/legal/cgv" className="underline underline-offset-2">
            Conditions générales de vente
          </Link>
          .
        </p>

        <section className="mt-14">
          <h2 className="font-serif text-3xl">Questions</h2>
          <dl className="mt-6 divide-y divide-line border-y border-line">
            {FAQ.map((f) => (
              <div key={f.q} className="py-5">
                <dt className="font-medium">{f.q}</dt>
                <dd className="mt-2 text-sm text-mute">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
