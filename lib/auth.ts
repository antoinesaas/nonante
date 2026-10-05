import "server-only";
import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Utilisateur vérifié auprès de Supabase Auth (jamais déduit du cookie seul). */
export async function getUser(): Promise<{ supabase: Awaited<ReturnType<typeof createClient>>; user: User | null }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
}

export async function requireUser(next: string) {
  const { supabase, user } = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return { supabase, user };
}

/** Admin : is_admin et double authentification (aal2). */
export async function requireAdmin() {
  const { supabase, user } = await requireUser("/admin");
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  if (!profile?.is_admin) redirect("/app");
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") redirect("/admin/mfa");
  return { supabase, user };
}

/** Évite les redirections ouvertes : seulement des chemins internes. */
export function safeNext(value: unknown, fallback = "/app"): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }
  return value;
}
