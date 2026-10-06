import type { Metadata } from "next";
import Link from "next/link";
import { ArtBand } from "@/components/Art";
import { CopyButton } from "@/components/CopyButton";
import { IMAGES } from "@/lib/art";
import { requireUser } from "@/lib/auth";
import { formatDayFr } from "@/lib/dates";
import { siteUrl } from "@/lib/env";
import { plural } from "@/lib/proofs";
import type { PlanState, SquadView } from "@/lib/types";
import { btnLink, label } from "@/lib/ui";
import { CreateForm, JoinForm, JoinPublicButton, LeaveButton } from "./SquadForms";

export const metadata: Metadata = { title: "Escouades" };

export default async function SquadsPage() {
  const { supabase } = await requireUser("/app/escouades");
  const [{ data: mine }, { data: open }, { data: plan }] = await Promise.all([
    supabase.rpc("my_squads"),
    supabase.rpc("public_squads"),
    supabase.rpc("my_plan"),
  ]);
  const squads = (mine as SquadView[] | null) ?? [];
  const publicSquads = ((open as SquadView[] | null) ?? []).filter((s) => !s.is_member);
  const canCreate = Boolean((plan as PlanState | null)?.limits?.create_squad);

  return (
    <>
      <ArtBand slug={IMAGES.squads} className="-mx-5 -mt-6 h-56">
        <p className={label}>Escouades</p>
        <h1 className="mt-2 font-serif text-4xl leading-none">Seul on va vite. En escouade, on tient.</h1>
      </ArtBand>
      <p className="mt-6 text-sm text-mute">
        Un classement rien qu&apos;entre vous : amis, associés, promo, communauté. 50 membres maximum, 3 escouades par personne.
      </p>

      <section className="mt-10">
        <h2 className="font-serif text-3xl">Tes escouades</h2>
        {squads.length ? (
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {squads.map((s) => (
              <li key={s.id} className="py-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-lg">{s.name}</p>
                    <p className="mt-1 text-xs text-mute">
                      {plural(s.members, "membre", "membres")}
                      {s.is_official ? " · officielle" : s.is_public ? " · publique" : " · privée"}
                      {s.start_date ? ` · départ le ${formatDayFr(s.start_date, { year: false })}` : ""}
                      {s.is_owner ? " · tu l'as créée" : ""}
                    </p>
                    {s.description ? <p className="mt-2 text-sm text-mute">{s.description}</p> : null}
                  </div>
                  <Link href={`/classement?escouade=${s.id}`} className={btnLink}>
                    Classement
                  </Link>
                </div>
                {s.code ? (
                  <div className="mt-4 flex items-center justify-between gap-4 border border-line p-3">
                    <span>
                      <span className="text-xs text-mute">Code </span>
                      <span className="font-serif text-2xl tracking-widest">{s.code}</span>
                    </span>
                    <CopyButton value={`Rejoins mon escouade « ${s.name} » sur Nonante avec le code ${s.code} : ${siteUrl()}/app/escouades`} label="Inviter" />
                  </div>
                ) : null}
                <div className="mt-3">
                  <LeaveButton id={s.id} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-mute">Aucune pour l&apos;instant. Rejoins-en une avec un code, ou crée la tienne.</p>
        )}
      </section>

      <section className="mt-10">
        <JoinForm />
      </section>

      {publicSquads.length ? (
        <section className="mt-12">
          <h2 className="font-serif text-3xl">Escouades ouvertes</h2>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {publicSquads.map((s) => (
              <li key={s.id} className="flex items-start justify-between gap-4 py-4">
                <div className="min-w-0">
                  <p>{s.name}</p>
                  <p className="mt-1 text-xs text-mute">
                    {plural(s.members, "membre", "membres")}
                    {s.is_official ? " · officielle" : ""}
                    {s.start_date ? ` · départ le ${formatDayFr(s.start_date)}` : ""}
                  </p>
                  {s.description ? <p className="mt-1 text-sm text-mute">{s.description}</p> : null}
                </div>
                <JoinPublicButton id={s.id} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-12">
        <h2 className="font-serif text-3xl">Créer une escouade</h2>
        <div className="mt-6 border border-line bg-surface p-4">
          {canCreate ? (
            <CreateForm />
          ) : (
            <p className="text-sm">
              Créer une escouade fait partie du plan Pro.{" "}
              <Link href="/abonnement" className={btnLink}>
                Voir les plans
              </Link>
            </p>
          )}
        </div>
      </section>
    </>
  );
}
