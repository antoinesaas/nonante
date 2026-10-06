import type { Metadata } from "next";
import Link from "next/link";
import { PhotoCapture } from "@/components/PhotoCapture";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { btnLink, label } from "@/lib/ui";

export const metadata: Metadata = { title: "Avant / après" };

type ArcPhotos = {
  before_path: string | null;
  after_path: string | null;
  day_number: number | null;
  can_take_before: boolean;
  can_take_after: boolean;
};

async function signed(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await createAdminClient().storage.from("proofs").createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}

/** Photo du jour 1, verrouillée jusqu'à la fin de l'arc, puis comparée à celle du jour 90. */
export default async function BeforeAfterPage({ searchParams }: PageProps<"/app/avant-apres">) {
  const { supabase, user } = await requireUser("/app/avant-apres");
  const params = await searchParams;
  const { data } = await supabase.rpc("my_arc_photos");
  const p = data as ArcPhotos | null;
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id")
    .eq("user_id", user.id)
    .order("arc_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!p || !enrollment) {
    return (
      <>
        <p className={label}>Avant / après</p>
        <h1 className="mt-4 font-serif text-4xl leading-tight">Lance ton arc d&apos;abord.</h1>
        <Link href="/app" className={`${btnLink} mt-6 inline-block`}>
          Retour
        </Link>
      </>
    );
  }

  const unlocked = Boolean(p.after_path);
  const [before, after] = unlocked ? await Promise.all([signed(p.before_path), signed(p.after_path)]) : [null, null];
  const retake = params.refaire === "1";

  return (
    <>
      <p className={label}>Avant / après</p>
      <h1 className="mt-4 font-serif text-4xl leading-tight">Le jour 1 contre le jour 90.</h1>
      <p className="mt-3 text-sm text-mute">
        Une photo de toi au début, verrouillée : tu ne la revois qu&apos;une fois la photo de fin prise, à partir du jour 81.
        Privée, jamais montrée à personne.
      </p>

      {unlocked ? (
        <div className="mt-8 grid grid-cols-2 gap-3">
          {[
            ["Jour 1", before],
            ["Jour 90", after],
          ].map(([title, url]) => (
            <figure key={title}>
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element -- URL signée de 5 minutes, bucket privé
                <img src={url} alt={`Photo ${title}`} className="aspect-[3/4] w-full object-cover" />
              ) : (
                <div className="aspect-[3/4] w-full bg-surface" />
              )}
              <figcaption className="mt-2 text-sm text-mute">{title}</figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <div className="mt-8 border border-line p-5">
          <p>{p.before_path ? "Photo du jour 1 prise. Verrouillée." : "Pas encore de photo du jour 1."}</p>
          <p className="mt-1 text-sm text-mute">
            {p.can_take_after ? "Tu peux prendre ta photo de fin." : p.day_number ? `Jour ${p.day_number} sur 90.` : ""}
          </p>
        </div>
      )}

      {(p.can_take_before && (!p.before_path || retake)) ? (
        <div className="mt-10">
          <PhotoCapture
            kind="arc_avant"
            targetId={enrollment.id}
            title="Ta photo du jour 1"
            detail="Toi, aujourd'hui. Même endroit, même lumière que tu pourras retrouver au jour 90."
            facing="user"
            backHref="/app/avant-apres"
          />
        </div>
      ) : p.can_take_before && p.before_path ? (
        <Link href="/app/avant-apres?refaire=1" className={`${btnLink} mt-6 inline-block`}>
          Reprendre la photo du jour 1 (possible la première semaine)
        </Link>
      ) : null}

      {p.can_take_after && p.before_path && !p.after_path ? (
        <div className="mt-10">
          <PhotoCapture
            kind="arc_apres"
            targetId={enrollment.id}
            title="Ta photo de fin"
            detail="Même endroit, même lumière qu'au jour 1. Elle déverrouille la comparaison."
            facing="user"
            backHref="/app/avant-apres"
          />
        </div>
      ) : null}
    </>
  );
}
