import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportForm } from "@/app/u/[pseudo]/ReportForm";
import { CalendarLegend, DotCalendar } from "@/components/DotCalendar";
import { Logo } from "@/components/Logo";
import { PlayerCard } from "@/components/Player";
import { SiteFooter } from "@/components/SiteFooter";
import { getUser } from "@/lib/auth";
import { formatDayFr } from "@/lib/dates";
import { formatEuros } from "@/lib/money";
import { CATEGORY_LABEL, GOAL_LABEL, plural, points } from "@/lib/proofs";
import { titleFor } from "@/lib/rules";
import type { PublicProfile } from "@/lib/types";
import { btnPrimary, label } from "@/lib/ui";

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
    description: `Niveau ${profile.stats.level} (${titleFor(profile.stats.level)}), note globale ${profile.stats.ovr}. ${
      profile.arc?.day_number ? `Jour ${profile.arc.day_number} sur 90.` : ""
    }`,
  };
}

export default async function PublicProfilePage({ params }: PageProps<"/u/[pseudo]">) {
  const { pseudo } = await params;
  const profile = await load(pseudo);
  if (!profile) notFound();
  const { user } = await getUser();
  const todayIndex = profile.calendar.findIndex((d) => d.status === "today");
  const s = profile.stats;

  return (
    <>
      <main className="mx-auto w-full max-w-xl px-5 pt-6 pb-16">
        <Link href="/" aria-label="Nonante, accueil">
          <Logo size="sm" />
        </Link>

        <div className="mt-8">
          <PlayerCard
            pseudo={profile.pseudo}
            avatarPath={profile.avatar_path}
            stats={s}
            art={profile.art}
            founder={profile.founder}
            subtitle={profile.arc?.day_number ? `jour ${profile.arc.day_number}/90` : null}
          />
        </div>

        {profile.bio ? <p className="mt-6 text-lg">{profile.bio}</p> : null}
        {profile.arc?.goal ? (
          <div className="mt-6">
            <p className={label}>{GOAL_LABEL[profile.arc.goal_type]}</p>
            <p className="mt-2 text-lg">{profile.arc.goal}</p>
          </div>
        ) : null}

        <dl className="mt-8 grid grid-cols-3 gap-y-6 border-y border-line py-6">
          <div>
            <dt className="text-xs text-mute">Points</dt>
            <dd className="mt-1 font-serif text-3xl tabular-nums">{points(profile.points)}</dd>
          </div>
          <div>
            <dt className="text-xs text-mute">Rang général</dt>
            <dd className="mt-1 font-serif text-3xl tabular-nums">{profile.rank ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-mute">Série</dt>
            <dd className="mt-1 font-serif text-3xl tabular-nums">{s.streak}</dd>
          </div>
          <div>
            <dt className="text-xs text-mute">Jours verts</dt>
            <dd className="mt-1 font-serif text-3xl tabular-nums">{s.green_days}</dd>
          </div>
          <div>
            <dt className="text-xs text-mute">Heures de focus</dt>
            <dd className="mt-1 font-serif text-3xl tabular-nums">{Math.floor(s.focus_minutes / 60)}</dd>
          </div>
          <div>
            <dt className="text-xs text-mute">Répétitions</dt>
            <dd className="mt-1 font-serif text-3xl tabular-nums">{s.reps.toLocaleString("fr-FR")}</dd>
          </div>
          {profile.wallet_proven_cents !== null ? (
            <div className="col-span-3">
              <dt className="text-xs text-mute">Revenus prouvés avec son projet</dt>
              <dd className="mt-1 font-serif text-3xl tabular-nums">{formatEuros(profile.wallet_proven_cents)}</dd>
            </div>
          ) : null}
        </dl>

        <p className="mt-4 text-sm text-mute">
          {profile.arc ? `Arc n° ${profile.arc.number} · ${CATEGORY_LABEL[profile.arc.category]} · ` : ""}
          {plural(s.arcs_completed, "arc tenu", "arcs tenus")} · {plural(profile.refused_proofs, "preuve refusée", "preuves refusées")} ·
          joueur depuis le {formatDayFr(profile.member_since.slice(0, 10))}
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

        {!user ? (
          <Link href="/onboarding" className={`${btnPrimary} mt-12`}>
            Créer ma carte de joueur
          </Link>
        ) : null}

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
