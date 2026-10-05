import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-5">
      <p className="font-serif text-7xl leading-none">404</p>
      <h1 className="mt-6 text-lg">Cette page n&apos;existe pas.</h1>
      <Link href="/" className="mt-10 text-sm text-mute underline underline-offset-4 hover:text-paper">
        Retour à l&apos;accueil
      </Link>
    </main>
  );
}
