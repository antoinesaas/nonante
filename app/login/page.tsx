import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/app/login/LoginForm";
import { ArtBackdrop } from "@/components/Art";
import { Hand } from "@/components/Hand";
import { Logo } from "@/components/Logo";
import { IMAGES } from "@/lib/art";
import { getUser, safeNext } from "@/lib/auth";

export const metadata: Metadata = { title: "Connexion", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNext(params.next, "/app");
  const { user } = await getUser();
  if (user) redirect(next);

  return (
    <ArtBackdrop slug={IMAGES.login}>
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pt-6 pb-12">
      <Link href="/" aria-label="Nonante, accueil">
        <Logo />
      </Link>
      <div className="my-auto py-16">
        <Hand className="animate-rise text-3xl text-mute">content de te revoir</Hand>
        <h1 className="mt-3 animate-rise font-serif text-5xl leading-none [animation-delay:80ms]">Reprends ton arc.</h1>
        <p className="mt-5 animate-rise text-paper/80 [animation-delay:140ms]">Pas de mot de passe : un code et un lien de connexion arrivent par email.</p>
        {params.erreur === "lien" ? (
          <p role="alert" className="mt-6 text-sm">
            Ce lien a expiré ou a déjà servi. Demande un nouveau code.
          </p>
        ) : null}
        <div className="mt-10 animate-rise [animation-delay:200ms]">
          <LoginForm next={next} />
        </div>
        <p className="mt-10 text-sm text-mute">
          Pas encore d&apos;arc ?{" "}
          <Link href="/onboarding" className="text-paper underline underline-offset-4">
            Construis le tien en 2 minutes
          </Link>
          .
        </p>
      </div>
    </main>
    </ArtBackdrop>
  );
}
