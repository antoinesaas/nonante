import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/app/login/LoginForm";
import { Logo } from "@/components/Logo";
import { getUser, safeNext } from "@/lib/auth";

export const metadata: Metadata = { title: "Connexion", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNext(params.next, "/app");
  const { user } = await getUser();
  if (user) redirect(next);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pt-6 pb-12">
      <Link href="/" aria-label="Nonante, accueil">
        <Logo />
      </Link>
      <div className="my-auto py-16">
        <h1 className="font-serif text-5xl leading-none">Connexion.</h1>
        <p className="mt-5 text-mute">Pas de mot de passe. Un lien et un code arrivent par email.</p>
        {params.erreur === "lien" ? (
          <p role="alert" className="mt-6 text-sm">
            Ce lien a expiré ou a déjà servi. Demande un nouveau code.
          </p>
        ) : null}
        <div className="mt-10">
          <LoginForm next={next} />
        </div>
      </div>
    </main>
  );
}
