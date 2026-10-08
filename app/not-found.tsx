import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";

export default async function NotFound() {
  const { m } = await getI18n();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-5">
      <p className="font-serif text-7xl leading-none">404</p>
      <h1 className="mt-6 text-lg">{m.common.notFound.title}</h1>
      <Link href="/" className="mt-10 text-sm text-mute underline underline-offset-4 hover:text-paper">
        {m.common.notFound.back}
      </Link>
    </main>
  );
}
