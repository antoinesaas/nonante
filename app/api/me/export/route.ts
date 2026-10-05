import { createClient } from "@/lib/supabase/server";

/** Export RGPD : toutes les données de l'utilisateur, en JSON. */
export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new Response("Connecte-toi.", { status: 401 });
  const { data, error } = await supabase.rpc("export_my_data");
  if (error) return new Response("Export impossible pour le moment.", { status: 500 });
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="nonante-donnees.json"`,
      "cache-control": "no-store",
    },
  });
}
