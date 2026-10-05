import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportForm } from "@/app/u/[pseudo]/ReportForm";
import { ArtCredit } from "@/components/Art";
import { CalendarLegend, DotCalendar } from "@/components/DotCalendar";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { DEFAULT_PROFILE_ART, getArt } from "@/lib/art";
import { getUser } from "@/lib/auth";
import { CATEGORY_LABEL, plural, points } from "@/lib/proofs";
import type { PublicProfile } from "@/lib/types";
import { label } from "@/lib/ui";

async function load(pseudo: string): Promise<PublicProfile | null> {
  if (!/^[a-z0-9_]{3,20}$/.test(pseudo)) return null;
  const { supabase } = await getUser();
  const { data } = await supabase.rpc("public_profile", { p_pseudo: pseudo });
  return (data as PublicProfile | null) ?? null;
}

export async function generateMetadata({ params }: PageProps<"/u/[pseudo]">): Promise<Metadata> {
  const { pseudo } = await params;
  const profile = await load(pseudo);
  if (!profile) return { title: "Profil", robots: { index: false } };
  return {
    title: profile.pseudo,
    description: profile.day_number
      ? `Jour ${profile.day_number} sur 90. ${profile.points ?? 0} points.`
      : `${profile.points ?? 0} points sur Nonante.`,
  };
}

export default async function PublicProfilePage({ params }: PageProps<"/u/[pseudo]">) {
  const { pseudo } = await params;
  const profile = await load(pseudo);
  if (!profile) notFound();
  const { user } = await getUser();
  const art = getArt(profile.art) ?? getArt(DEFAULT_PROFILE_ART);
  const todayIndex = profile.calendar.findIndex((d) => d.status === "today");

  return (
    <>
      <div className="relative">
        {art ? (
          <>
            <Image
              src={`/art/${art.slug}-nb.jpg`}
              alt=""
              width={art.width}
              height={art.height}
              priority
              sizes="100vw"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-ink/65" />
          </>
        ) : null}
        <header className="relative mx-auto w-full max-w-xl px-5 pt-6 pb-12">
          <Link href="/" aria-label="Nonante, accueil">
            <Logo size="sm" />
          </Link>
          <p className={`${label} mt-24`}>{profile.cohort ?? "Nonante"}</p>
          <h1 className="mt-3 font-serif text-6xl leading-none">{profile.pseudo}</h1>
          {profile.goal ? <p className="mt-4 text-lg text-paper/85">{profile.goal}</p> : null}
          {art ? <ArtCredit art={art} className="mt-10" /> : null}
        </header>
      </div>

      <main className="mx-auto w-full max-w-xl px-5 pb-16">
        <dl className="grid grid-cols-3 gap-4 border-b border-line py-8">
          <div>
            <dt className="text-xs text-mute">Points</dt>
            <dd className="mt-1 font-serif text-4xl tabular-nums">{points(profile.points ?? 0)}</dd>
          </div>
          <div>
            <dt className="text-xs text-mute">Rang</dt>
            <dd className="mt-1 font-serif text-4xl tabular-nums">
              {profile.rank ?? "—"}
              {profile.total ? <span className="text-base text-mute"> / {profile.total}</span> : null}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-mute">Niveau</dt>
            <dd className="mt-1 font-serif text-4xl tabular-nums">{profile.level ?? 1}</dd>
          </div>
        </dl>

        <p className="mt-6 text-sm text-mute">
          {profile.day_number ? `Jour ${profile.day_number} sur 90 · ` : null}
          {profile.category ? `${CATEGORY_LABEL[profile.category]} · ` : null}
          {plural(profile.refused_proofs, "preuve refusée", "preuves refusées")}
        </p>

        {profile.calendar.length ? (
          <section className="mt-10">
            <DotCalendar days={profile.calendar.map((d) => d.status)} today={todayIndex >= 0 ? todayIndex : undefined} />
            <CalendarLegend />
          </section>
        ) : null}

        <section className="mt-12">
          <h2 className="font-serif text-3xl">Succès</h2>
          {profile.achievements.length ? (
            <ul className="mt-4 divide-y divide-line border-y border-line">
              {profile.achievements.map((a) => (
                <li key={a.code} className="py-3">
                  <p>{a.title}</p>
                  <p className="text-xs text-mute">{a.description}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-mute">Aucun pour l&apos;instant.</p>
          )}
        </section>

        <section className="mt-12 border-t border-line pt-6">
          {user ? (
            <ReportForm pseudo={profile.pseudo} />
          ) : (
            <Link href={`/login?next=/u/${profile.pseudo}`} className="text-sm text-mute underline underline-offset-4">
              Signaler ce profil
            </Link>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
