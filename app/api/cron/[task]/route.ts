import { timingSafeEqual } from "node:crypto";
import { runDue, taskArcEnd, taskAudits, taskCleanup, taskDayClose } from "@/lib/cron";

export const maxDuration = 300;

const TASKS: Record<string, () => Promise<unknown>> = {
  "day-close": () => taskDayClose(),
  audits: () => taskAudits(),
  cleanup: () => taskCleanup(),
  "arc-end": () => taskArcEnd(),
  run: () => runDue(),
};

/** Vercel Cron envoie « Authorization: Bearer <CRON_SECRET> ». */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request, { params }: RouteContext<"/api/cron/[task]">) {
  if (!authorized(request)) return new Response("Non autorisé.", { status: 401 });
  const { task } = await params;
  const run = TASKS[task];
  if (!run) return new Response("Tâche inconnue.", { status: 404 });
  try {
    return Response.json({ task, result: await run() });
  } catch (e) {
    console.error(`[cron] ${task} : ${e instanceof Error ? e.message : "erreur"}`);
    return Response.json({ task, error: "échec" }, { status: 500 });
  }
}
