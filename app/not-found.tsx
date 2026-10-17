import Link from "next/link";
import { Aura } from "@/components/Aura";
import { getI18n } from "@/lib/i18n/server";
import { btnPrimary } from "@/lib/ui";

export default async function NotFound() {
  const { m } = await getI18n();
  return (
    <main className="relative isolate mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center overflow-x-clip px-5">
      <Aura tone="violet" />
      <p className="font-dot text-[88px] leading-none">404</p>
      <h1 className="mt-4 font-display text-[24px]">{m.common.notFound.title}</h1>
      <Link href="/" className={`${btnPrimary} mt-8`}>
        {m.common.notFound.back}
      </Link>
    </main>
  );
}
