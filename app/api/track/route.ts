import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

// Évènements de parcours anonymes (lib/track.ts → navigator.sendBeacon). Rien de personnel n'est accepté :
// un nom d'évènement connu, quelques valeurs courtes, la page et le type d'appareil.
const Event = z.object({
  visit: z.string().regex(/^[a-z0-9]{8,32}$/),
  name: z.enum(["questionnaire", "plan_choisi", "paiement_lance", "session", "calcul_mental", "depart"]),
  props: z
    .record(z.string().max(30), z.union([z.string().max(60), z.number().finite(), z.boolean(), z.null()]))
    .refine((p) => Object.keys(p).length <= 8)
    .default({}),
  path: z.string().max(200).startsWith("/"),
  device: z.enum(["mobile", "desktop"]),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    // sendBeacon envoie du texte : on lit le corps à la main (2 Ko au plus).
    const text = await request.text();
    if (text.length > 2048) return new Response(null, { status: 413 });
    body = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }
  const parsed = Event.safeParse(body);
  if (!parsed.success) return new Response(null, { status: 400 });
  // Au plus 120 évènements par adresse et par 10 minutes (l'adresse n'est pas enregistrée).
  if (!(await rateLimit("track", 120, 600))) return new Response(null, { status: 429 });
  const e = parsed.data;
  const { error } = await createAdminClient().rpc("track_event", {
    p_visit: e.visit,
    p_name: e.name,
    p_props: e.props,
    p_path: e.path.split("?")[0],
    p_device: e.device,
  });
  if (error) console.error(`[track] erreur base : ${error.code}`);
  return new Response(null, { status: 204 });
}
