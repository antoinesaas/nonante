import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DeleteAccountForm } from "@/app/app/(main)/profil/DeleteAccountForm";
import { InstallHint } from "@/app/app/(main)/profil/InstallHint";
import { PushToggle } from "@/app/app/(main)/profil/PushToggle";
import { SettingsForm } from "@/app/app/(main)/profil/SettingsForm";
import { CopyButton } from "@/components/CopyButton";
import { getArt } from "@/lib/art";
import { requireUser } from "@/lib/auth";
import { siteUrl } from "@/lib/env";
import { plural } from "@/lib/proofs";
import { ensureReferralCode } from "@/lib/stripe-codes";
import type { MyProfile } from "@/lib/types";
import { btnLink, btnSecondary, label } from "@/lib/ui";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfilePage() {
  const { supabase, user } = await requireUser("/app/profil");
  const { data } = await supabase.rpc("my_profile");
  const profile = data as MyProfile | null;
  if (!profile) redirect("/onboarding");

  // Code de parrainage pas encore créé chez Stripe (Stripe indisponible à l'onboarding) : on réessaie.
  if (profile.referral_code && !profile.referral_ready) {
    try {
      await ensureReferralCode(user.id, profile.referral_code);
    } catch {
      // Sans gravité : nouvel essai à la prochaine visite.
    }
  }

  const unlocked = profile.achievements.filter((a) => a.unlocked_at);
  const arts = profile.arts.map((slug) => getArt(slug)).filter((a) => a !== null);
  const background = getArt(profile.profile_art_slug);

  return (
    <>
      <header>
        <p className={label}>Profil</p>
        <h1 className="mt-4 font-serif text-5xl leading-none">{profile.pseudo}</h1>
        <p className="mt-3 text-sm text-mute">
          {profile.level ? `Niveau ${profile.level} · ` : null}
          {plural(profile.refused_proofs, "preuve refusée", "preuves refusées")}
        </p>
        {profile.is_public ? (
          <Link href={`/u/${profile.pseudo}`} className={`${btnLink} mt-4 inline-block`}>
            Voir mon profil public
          </Link>
        ) : null}
      </header>

      {background ? (
        <div className="relative mt-8 aspect-[3/1] overflow-hidden">
          <Image
            src={`/art/${background.slug}-nb.jpg`}
            alt={background.title}
            width={background.width}
            height={background.height}
            sizes="576px"
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}

      <section className="mt-12">
        <h2 className="font-serif text-3xl">Succès</h2>
        <p className="mt-2 text-sm text-mute">
          {unlocked.length} sur {profile.achievements.length}. La rareté est calculée sur ta cohorte.
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
                {a.percent !== null ? <p className="mt-1 text-mute">{a.percent} % de la cohorte</p> : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="font-serif text-3xl">Réglages</h2>
        <SettingsForm
          isPublic={profile.is_public}
          emailReminders={profile.email_reminders}
          art={profile.profile_art_slug}
          arts={arts.map((a) => ({ slug: a.slug, title: a.title, artist: a.artist, width: a.width, height: a.height }))}
        />
      </section>

      <section className="mt-12">
        <h2 className="font-serif text-3xl">Notifications</h2>
        <p className="mt-2 text-sm text-mute">Un seul rappel par jour, à 18 h 30, s&apos;il te reste des principes à prouver.</p>
        <PushToggle subscribed={profile.push_subscriptions > 0} publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />
        <InstallHint />
      </section>

      {profile.referral_code ? (
        <section className="mt-12">
          <h2 className="font-serif text-3xl">Parrainage</h2>
          <p className="mt-2 text-sm text-mute">
            −20 % pour un ami, à saisir au paiement. {plural(profile.referral_sales, "vente générée", "ventes générées")}.
          </p>
          <div className="mt-4 flex items-center justify-between gap-4">
            <span className="font-serif text-2xl">{profile.referral_code}</span>
            <CopyButton
              value={`${profile.referral_code} · ${siteUrl()}/?utm_source=parrainage&utm_campaign=${encodeURIComponent(profile.referral_code)}`}
            />
          </div>
        </section>
      ) : null}

      {profile.loyalty_code ? (
        <section className="mt-12">
          <h2 className="font-serif text-3xl">Fidélité</h2>
          <p className="mt-2 text-sm text-mute">Arc tenu : −50 % sur le prochain, une seule fois.</p>
          <div className="mt-4 flex items-center justify-between gap-4">
            <span className="font-serif text-2xl">{profile.loyalty_code}</span>
            <CopyButton value={profile.loyalty_code} />
          </div>
        </section>
      ) : null}

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
        <Link href="/app/principes" className="underline underline-offset-4">
          Tes principes
        </Link>{" "}
        ·{" "}
        <Link href="/art" className="underline underline-offset-4">
          Crédits des œuvres
        </Link>{" "}
        ·{" "}
        <Link href="/legal/confidentialite" className="underline underline-offset-4">
          Confidentialité
        </Link>
      </p>
    </>
  );
}
