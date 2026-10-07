import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArtBand } from "@/components/Art";
import { PrincipleForm, PrincipleRow, TemplateLibrary } from "@/components/PrincipleEditor";
import { IMAGES } from "@/lib/art";
import { requireUser } from "@/lib/auth";
import { formatDayFr } from "@/lib/dates";
import { PLAN_NAME } from "@/lib/plans";
import { GOAL_LABEL } from "@/lib/proofs";
import type { MyPrinciples } from "@/lib/types";
import { btnLink, btnPrimary, label } from "@/lib/ui";
import { RegenerateButton } from "./RegenerateButton";

export const metadata: Metadata = { title: "Principes" };

export default async function PrinciplesPage({ searchParams }: PageProps<"/app/principes">) {
  const { supabase } = await requireUser("/app/principes");
  const params = await searchParams;
  const { data, error } = await supabase.rpc("my_principles");
  if (error) throw new Error(`Principes indisponibles (${error.code})`);
  const d = data as MyPrinciples;
  if (!d.enrollment) redirect("/onboarding");

  const principles = d.principles ?? [];
  const limits = d.limits!;
  const editable = Boolean(d.editable);
  const draft = d.enrollment.status === "draft";
  const beforeStart = draft || !d.started;
  const fresh = params.nouveau === "1";

  return (
    <>
      <ArtBand slug={IMAGES.onboarding[6]} className="-mx-5 -mt-6 h-52">
        <p className={label}>{GOAL_LABEL[d.enrollment.goal_type]}</p>
        <h1 className="mt-2 font-serif text-4xl leading-none">{fresh ? "Tes principes." : "Principes"}</h1>
      </ArtBand>

      <p className="mt-6 text-lg">{d.enrollment.goal_title}</p>
      <p className="mt-2 text-sm text-mute">
        {fresh
          ? "Proposés pour ton objectif et tes points faibles. Garde, modifie, retire, ajoute : c'est ton arc."
          : beforeStart
            ? `Jour 1 le ${formatDayFr(d.enrollment.start_date, { weekday: true })}. Tout se modifie jusque-là.`
            : "Pendant l'arc, chaque modification s'applique dès demain. Aujourd'hui reste comme prévu."}
      </p>

      <div className="mt-6 flex items-baseline justify-between border-b border-line pb-3 text-sm">
        <span className="text-mute">
          {principles.length} / {limits.max_principles} principes
          {d.plan ? ` · plan ${PLAN_NAME[d.plan]}` : ""}
        </span>
        {beforeStart && editable ? <RegenerateButton /> : null}
      </div>

      <ul className="divide-y divide-line border-b border-line">
        {principles.map((p) => (
          <PrincipleRow key={p.id} principle={p} editable={editable} />
        ))}
      </ul>

      {draft ? (
        <div className="mt-8 border border-paper p-5">
          <p className="font-serif text-2xl leading-tight">Prêt ? Lance ton arc.</p>
          <p className="mt-2 text-sm text-mute">
            Payer, c&apos;est déjà s&apos;engager. Ton arc démarre dès le paiement.
            {principles.length > 6 ? " L&apos;Arc 90 jours garde tes 6 premiers principes ; Pro les garde tous." : ""}
          </p>
          <Link href="/abonnement" className={`${btnPrimary} mt-5`}>
            Choisir mon plan
          </Link>
        </div>
      ) : fresh ? (
        <Link href="/app" className={`${btnPrimary} mt-8`}>
          C&apos;est parti
        </Link>
      ) : null}

      {editable ? (
        <>
          <section className="mt-14">
            <h2 className="font-serif text-3xl">Créer un principe</h2>
            <p className="mt-2 text-sm text-mute">
              Une situation précise, une action précise : « si… alors… ». C&apos;est ce qui rend une habitude automatique.
            </p>
            <div className="mt-6 border border-line bg-surface p-4">
              {principles.length < limits.max_principles ? (
                <PrincipleForm />
              ) : (
                <p className="text-sm">
                  Ton plan permet {limits.max_principles} principes.{" "}
                  {limits.max_principles < 12 ? (
                    <Link href="/abonnement" className={btnLink}>
                      Passe Pro pour en avoir 12
                    </Link>
                  ) : (
                    "Retires-en un pour en ajouter un autre."
                  )}
                </p>
              )}
            </div>
          </section>

          <section className="mt-14">
            <h2 className="font-serif text-3xl">Bibliothèque</h2>
            <p className="mt-2 text-sm text-mute">Des principes qui ont fait leurs preuves, avec d&apos;où ils viennent.</p>
            <div className="mt-6">
              <TemplateLibrary templates={d.templates ?? []} disabled={principles.length >= limits.max_principles} />
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}
