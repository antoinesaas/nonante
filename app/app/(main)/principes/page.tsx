import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PrincipleList } from "@/components/PrincipleList";
import { requireUser } from "@/lib/auth";
import type { Dashboard } from "@/lib/types";
import { label } from "@/lib/ui";

export const metadata: Metadata = { title: "Tes principes" };

export default async function MyPrinciplesPage() {
  const { supabase } = await requireUser("/app/principes");
  const { data } = await supabase.rpc("my_dashboard");
  const d = data as Dashboard;
  if (!d?.enrollment) redirect("/onboarding");
  return (
    <>
      <p className={label}>{d.cohort?.name}</p>
      <h1 className="mt-4 font-serif text-5xl leading-none">Tes principes.</h1>
      <p className="mt-4 text-mute">Imposés, et non modifiables pendant l&apos;arc. Niveau {d.enrollment.level}.</p>
      <div className="mt-8">
        <PrincipleList principles={d.principles ?? []} />
      </div>
    </>
  );
}
