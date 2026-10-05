import { redirect } from "next/navigation";
import { MfaForm } from "@/app/admin/mfa/MfaForm";
import { requireUser } from "@/lib/auth";

/** Double authentification obligatoire pour l'admin : inscription du TOTP ou vérification. */
export default async function MfaPage() {
  const { supabase, user } = await requireUser("/admin/mfa");
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  if (!profile?.is_admin) redirect("/app");
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === "aal2") redirect("/admin");
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = factors?.totp?.find((f) => f.status === "verified");

  return (
    <section className="max-w-md">
      <h1 className="font-serif text-4xl">Double authentification.</h1>
      <p className="mt-3 text-sm text-mute">
        {verified
          ? "Entre le code à 6 chiffres de ton application d'authentification."
          : "Obligatoire pour l'admin. Scanne le QR code avec une application d'authentification (1Password, Google Authenticator, Authy…), puis entre le code."}
      </p>
      <MfaForm verifiedFactorId={verified?.id ?? null} />
    </section>
  );
}
