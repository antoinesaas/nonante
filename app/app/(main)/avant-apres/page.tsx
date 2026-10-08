import type { Metadata } from "next";
import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import { PhotoCapture } from "@/components/PhotoCapture";
import { requireUser } from "@/lib/auth";
import { fmt } from "@/lib/i18n/format";
import { getI18n } from "@/lib/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { btnLink, label } from "@/lib/ui";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.app.beforeAfter.title };
}

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
  const [{ supabase, user }, { m }, params] = await Promise.all([requireUser("/app/avant-apres"), getI18n(), searchParams]);
  const t = m.app.beforeAfter;
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
        <BackLink />
        <p className={`${label} mt-4`}>{t.title}</p>
        <h1 className="mt-4 font-serif text-4xl leading-tight">{t.startFirst}</h1>
      </>
    );
  }

  const unlocked = Boolean(p.after_path);
  const [before, after] = unlocked ? await Promise.all([signed(p.before_path), signed(p.after_path)]) : [null, null];
  const retake = params.refaire === "1";

  return (
    <>
      <BackLink />
      <p className={`${label} mt-4`}>{t.title}</p>
      <h1 className="mt-4 font-serif text-4xl leading-tight">{t.heading}</h1>
      <p className="mt-3 text-sm text-mute">{t.intro}</p>

      {unlocked ? (
        <div className="mt-8 grid grid-cols-2 gap-3">
          {[
            [t.day1, before],
            [t.day90, after],
          ].map(([title, url]) => (
            <figure key={title}>
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element -- URL signée de 5 minutes, bucket privé
                <img src={url} alt={fmt(t.photoAlt, { day: title ?? "" })} className="aspect-[3/4] w-full object-cover" />
              ) : (
                <div className="aspect-[3/4] w-full bg-surface" />
              )}
              <figcaption className="mt-2 text-sm text-mute">{title}</figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-xs border border-line p-5">
          <p>{p.before_path ? t.beforeTaken : t.beforeMissing}</p>
          <p className="mt-1 text-sm text-mute">
            {p.can_take_after ? t.canAfter : p.day_number ? fmt(t.dayOf, { n: p.day_number }) : ""}
          </p>
        </div>
      )}

      {(p.can_take_before && (!p.before_path || retake)) ? (
        <div className="mt-10">
          <PhotoCapture
            kind="arc_avant"
            targetId={enrollment.id}
            title={t.beforeTitle}
            detail={t.beforeDetail}
            facing="user"
            backHref="/app/avant-apres"
          />
        </div>
      ) : p.can_take_before && p.before_path ? (
        <Link href="/app/avant-apres?refaire=1" className={`${btnLink} mt-6 inline-block`}>
          {t.retake}
        </Link>
      ) : null}

      {p.can_take_after && p.before_path && !p.after_path ? (
        <div className="mt-10">
          <PhotoCapture
            kind="arc_apres"
            targetId={enrollment.id}
            title={t.afterTitle}
            detail={t.afterDetail}
            facing="user"
            backHref="/app/avant-apres"
          />
        </div>
      ) : null}
    </>
  );
}
