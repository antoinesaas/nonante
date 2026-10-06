import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { openBillingPortal } from "@/app/actions/checkout";
import { DeleteAccountForm } from "@/app/app/(main)/profil/DeleteAccountForm";
import { InstallHint } from "@/app/app/(main)/profil/InstallHint";
import { PushToggle } from "@/app/app/(main)/profil/PushToggle";
import { AvatarForm, SettingsForm } from "@/app/app/(main)/profil/SettingsForm";
import { CopyButton } from "@/components/CopyButton";
import { PlayerCard, STAT_ROWS } from "@/components/Player";
import { getArt } from "@/lib/art";
import { requireUser } from "@/lib/auth";
import { formatDayFr } from "@/lib/dates";
import { siteUrl } from "@/lib/env";
import { formatEuros } from "@/lib/money";
import { PLAN_NAME } from "@/lib/plans";
import { plural, points } from "@/lib/proofs";
import { nextTitle } from "@/lib/rules";
import { ensureReferralCode } from "@/lib/stripe-codes";
import type { MyProfile } from "@/lib/types";
import { btnLink, btnPrimary, btnSecondary, label } from "@/lib/ui";

export const metadata: Metadata = { title: "Profil" };

const ARC_STATUS: Record<string, string> = {
  draft: "en construction",
  active: "en cours",
  completed: "tenu",
  failed: "raté",
  abandoned: "lâché",
};

export default async function ProfilePage({ searchParams }: PageProps<"/app/profil">) {
  const { supabase, user } = await requireUser("/app/profil");
  const params = await searchParams;
  const { data } = await supabase.rpc("my_profile");
  const profile = data as MyProfile | null;
  if (!profile) redirect("/onboarding");

  // Code de parrainage pas encore créé chez Stripe (Stripe indisponible à l'onboarding) : on réessaie.
  if (profile.referral_code && !profile.referral_ready && process.env.STRIPE_SECRET_KEY) {
    try {
      await ensureReferralCode(user.id, profile.referral_code);
    } catch {
      // Sans gravité : nouvel essai à la prochaine visite.
    }
  }

  const s = profile.stats;
  const unlocked = profile.achievements.filter((a) => a.unlocked_at);
  const arts = profile.arts.map((slug) => getArt(slug)).filter((a) => a !== null);
  const next = nextTitle(s.level);
  const plan = profile.plan;
  const weakest = [...STAT_ROWS].sort((a, b) => Number(s[a.key]) - Number(s[b.key]))[0];

  return (
    <>
      <PlayerCard
        pseudo={profile.pseudo}
        avatarPath={profile.avatar_path}
        stats={s}
        art={profile.profile_art_slug}
        founder={plan.plan === "fondateur"}
      />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <AvatarForm hasAvatar={Boolean(profile.avatar_path)} />
        {profile.is_public ? (
          <Link href={`/u/${profile.pseudo}`} className={btnLink}>
            Mon profil public
          </Link>
        ) : null}
      </div>

      <section className="mt-10">
        <h2 className="font-serif text-3xl">Tes stats</h2>
        <p className="mt-2 text-sm text-mute">
          {next ? `Titre suivant : ${next.title}, au niveau ${next.level}. ` : "Tu es au sommet des titres. "}
          Ta stat la plus basse : {weakest.label.toLowerCase()}. C&apos;est elle qui tire ta note vers le bas.
        </p>
        <dl className="mt-6 divide-y divide-line border-y border-line">
          {STAT_ROWS.map((row) => (
            <div key={row.key} className="flex items-baseline justify-between gap-4 py-3">
              <dt>
                {row.label}
                <span className="block text-xs text-mute">{row.help}</span>
              </dt>
              <dd className="font-serif text-3xl tabular-nums">{s[row.key]}</dd>
            </div>
          ))}
        </dl>
        <dl className="mt-8 grid grid-cols-3 gap-y-6">
          {[
            ["Points", points(profile.points)],
            ["Rang général", profile.rank ? String(profile.rank) : "—"],
            ["XP", s.xp.toLocaleString("fr-FR")],
            ["Série", String(s.streak)],
            ["Meilleure série", String(s.best_streak)],
            ["Jours verts", String(s.green_days)],
            ["Heures de focus", String(Math.floor(s.focus_minutes / 60))],
            ["Répétitions", s.reps.toLocaleString("fr-FR")],
            ["Réveils prouvés", String(s.wakes)],
            ["Revenus prouvés", formatEuros(s.wallet_proven_cents)],
            ["Arcs tenus", String(s.arcs_completed)],
            ["Preuves refusées", String(profile.refused_proofs)],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-mute">{k}</dt>
              <dd className="mt-1 font-serif text-2xl tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-12">
        <h2 className="font-serif text-3xl">Succès</h2>
        <p className="mt-2 text-sm text-mute">
          {unlocked.length} sur {profile.achievements.length}. La rareté est calculée sur tous les joueurs.
        </p>
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {profile.achievements.map((a) => (
            <li key={a.code} className={`flex items-start justify-between gap-4 py-4 ${a.unlocked_at ? "" : "text-mute"}`}>
              <div>
                <p className={a.unlocked_at ? "text-paper" : ""}>{a.title}</p>
                <p className="mt-1 text-xs text-mute">{a.description}</p>
              </div>
              <div className="shrink-0 text-right text-xs">
                {a.points ? <p className="tabular-nums">+{a.points}</p> : null}
                {a.percent !== null ? <p className="mt-1 text-mute">{a.percent} % des joueurs</p> : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {profile.arcs.length ? (
        <section className="mt-12">
          <h2 className="font-serif text-3xl">Tes arcs</h2>
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {profile.arcs.map((a) => (
              <li key={a.number} className="py-4">
                <p className="flex justify-between gap-4">
                  <span>Arc n° {a.number}</span>
                  <span className="text-sm text-mute">{ARC_STATUS[a.status]}</span>
                </p>
                <p className="mt-1 text-sm text-mute">{a.goal_title}</p>
                <p className="mt-1 text-xs text-mute">
                  {formatDayFr(a.start_date, { year: false })} → {formatDayFr(a.end_date)} · {plural(a.green, "jour vert", "jours verts")} ·{" "}
                  {points(a.points)} points
                  {a.loyalty_applied ? " · −50 % appliqué" : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-12">
        <h2 className="font-serif text-3xl">Abonnement</h2>
        <p className="mt-3">
          {plan.plan ? `Plan ${PLAN_NAME[plan.plan]}` : "Aucun plan actif"}
          {plan.interval === "month" ? " · mensuel" : plan.interval === "year" ? " · annuel" : plan.interval === "lifetime" ? " · à vie" : ""}
        </p>
        <p className="mt-1 text-sm text-mute">
          {plan.comp_until
            ? `Accès offert jusqu'au ${formatDayFr(plan.comp_until)}.`
            : plan.cancel_at_period_end && plan.period_end
              ? `Résilié : accès jusqu'au ${formatDayFr(plan.period_end.slice(0, 10))}.`
              : plan.period_end && plan.interval !== "lifetime"
                ? `Prochain renouvellement le ${formatDayFr(plan.period_end.slice(0, 10))}.`
                : null}
          {plan.status === "past_due" ? " Paiement en échec : mets ta carte à jour." : ""}
        </p>
        {params.portail === "indisponible" ? <p className="mt-3 text-sm">Le portail de paiement est indisponible. Réessaie plus tard.</p> : null}
        <div className="mt-5 flex flex-wrap gap-3">
          {profile.has_billing ? (
            <form action={openBillingPortal}>
              <button type="submit" className={btnSecondary}>
                Gérer mon abonnement
              </button>
            </form>
          ) : null}
          {plan.plan !== "fondateur" ? (
            <Link href="/abonnement" className={plan.plan ? btnSecondary : btnPrimary}>
              {plan.plan ? "Changer de plan" : "Choisir un plan"}
            </Link>
          ) : null}
        </div>
      </section>

      {profile.referral_code ? (
        <section className="mt-12">
          <h2 className="font-serif text-3xl">Parrainage</h2>
          <p className="mt-2 text-sm text-mute">
            −20 % pour ton ami sur son premier paiement, {formatEuros(500)} de crédit pour toi à chaque abonnement.{" "}
            {plural(profile.referral_sales, "ami inscrit", "amis inscrits")} · {formatEuros(profile.referral_credit_cents)} gagnés.
          </p>
          <div className="mt-4 flex items-center justify-between gap-4">
            <span className="font-serif text-2xl">{profile.referral_code}</span>
            <CopyButton
              value={`${profile.referral_code} · ${siteUrl()}/?utm_source=parrainage&utm_campaign=${encodeURIComponent(profile.referral_code)}`}
            />
          </div>
        </section>
      ) : null}

      <section className="mt-12">
        <h2 className="font-serif text-3xl">Réglages</h2>
        <SettingsForm
          isPublic={profile.is_public}
          emailReminders={profile.email_reminders}
          walletPublic={profile.wallet_public}
          bio={profile.bio}
          art={profile.profile_art_slug}
          arts={arts.map((a) => ({ slug: a.slug, title: a.title, artist: a.artist, width: a.width, height: a.height }))}
        />
      </section>

      <section className="mt-12">
        <h2 className="font-serif text-3xl">Notifications</h2>
        <p className="mt-2 text-sm text-mute">Un seul rappel par jour, le soir, s&apos;il te reste des principes à prouver.</p>
        <PushToggle subscribed={profile.push_subscriptions > 0} publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />
        <InstallHint />
      </section>

      <section className="mt-12">
        <h2 className="font-serif text-3xl">Tes données</h2>
        <p className="mt-2 text-sm text-mute">Connecté avec {profile.email}.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a href="/api/me/export" className={btnSecondary}>
            Exporter mes données
          </a>
          <form action="/auth/signout" method="post">
            <button type="submit" className={btnSecondary}>
              Se déconnecter
            </button>
          </form>
          {profile.is_admin ? (
            <Link href="/admin" className={btnSecondary}>
              Admin
            </Link>
          ) : null}
        </div>
        <DeleteAccountForm pseudo={profile.pseudo} />
      </section>

      <p className="mt-12 text-xs text-mute">
        <span className={label}>Liens</span>{" "}
        <Link href="/app/principes" className="underline underline-offset-4">
          Tes principes
        </Link>{" "}
        ·{" "}
        <Link href="/art" className="underline underline-offset-4">
          Crédits des images
        </Link>{" "}
        ·{" "}
        <Link href="/legal/confidentialite" className="underline underline-offset-4">
          Confidentialité
        </Link>
      </p>
    </>
  );
}
