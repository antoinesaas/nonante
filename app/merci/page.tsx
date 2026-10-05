import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { Logo } from "@/components/Logo";
import { formatDayFr } from "@/lib/dates";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Place réservée",
  robots: { index: false },
};

const SessionId = z.string().regex(/^cs_(test|live)_[A-Za-z0-9]{10,200}$/);

type Outcome =
  | { status: "paid"; cohortName: string | null; startDate: string | null }
  | { status: "pending" }
  | { status: "unknown" };

/** Statut lu chez Stripe à partir de l'identifiant de session, jamais d'après l'URL seule. */
async function checkoutOutcome(rawSessionId: unknown): Promise<Outcome> {
  const parsed = SessionId.safeParse(rawSessionId);
  if (!parsed.success || !stripeConfigured()) return { status: "unknown" };

  try {
    const session = await getStripe().checkout.sessions.retrieve(parsed.data);
    if (session.payment_status !== "paid") return { status: "pending" };

    const cohortId = z.uuid().safeParse(session.metadata?.cohort_id);
    if (!cohortId.success) return { status: "paid", cohortName: null, startDate: null };

    const supabase = await createClient();
    const { data: cohort } = await supabase
      .from("cohorts")
      .select("name, start_date")
      .eq("id", cohortId.data)
      .maybeSingle();
    return { status: "paid", cohortName: cohort?.name ?? null, startDate: cohort?.start_date ?? null };
  } catch {
    return { status: "unknown" };
  }
}

export default async function MerciPage({ searchParams }: PageProps<"/merci">) {
  const { session_id } = await searchParams;
  const outcome = await checkoutOutcome(session_id);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pt-6 pb-12">
      <Link href="/" aria-label="Nonante, accueil">
        <Logo />
      </Link>

      <div className="my-auto py-16">
        {outcome.status === "paid" ? (
          <>
            <h1 className="font-serif text-5xl leading-none">Ta place est réservée.</h1>
            {outcome.cohortName && outcome.startDate ? (
              <p className="mt-6 text-lg">
                {outcome.cohortName}. Départ le {formatDayFr(outcome.startDate, { weekday: true })}.
              </p>
            ) : null}
            <p className="mt-4 leading-relaxed text-mute">
              Un email de confirmation arrive. Avant le départ, tu recevras un second email pour créer
              ton compte avec la même adresse.
            </p>
          </>
        ) : outcome.status === "pending" ? (
          <>
            <h1 className="font-serif text-5xl leading-none">Paiement en cours.</h1>
            <p className="mt-6 leading-relaxed text-mute">
              Ta banque n&apos;a pas encore confirmé. Tu recevras un email dès que c&apos;est fait.
            </p>
          </>
        ) : (
          <>
            <h1 className="font-serif text-5xl leading-none">Merci.</h1>
            <p className="mt-6 leading-relaxed text-mute">
              Si ton paiement est passé, un email de confirmation arrive dans quelques minutes.
            </p>
          </>
        )}

        <Link href="/" className="mt-10 inline-block text-sm text-mute underline underline-offset-4 hover:text-paper">
          Retour à l&apos;accueil
        </Link>
      </div>
    </main>
  );
}
