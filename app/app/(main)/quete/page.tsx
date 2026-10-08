import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChallengeDeclaratif } from "@/app/app/(main)/quete/ChallengeDeclaratif";
import { BackLink } from "@/components/BackLink";
import { LinkForm } from "@/components/LinkForm";
import { requireUser } from "@/lib/auth";
import { fmt, signed } from "@/lib/i18n/format";
import { getI18n } from "@/lib/i18n/server";
import type { Dashboard } from "@/lib/types";
import { btnPrimary, label } from "@/lib/ui";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.app.quest.title };
}

const PAGE: Record<string, string> = { session: "session", reps: "reps", reveil: "reveil", photo: "photo" };

export default async function ChallengePage() {
  const [{ supabase }, { m }] = await Promise.all([requireUser("/app/quete"), getI18n()]);
  const t = m.app.quest;
  const { data } = await supabase.rpc("my_dashboard");
  const d = data as Dashboard;
  if (!d?.enrollment) redirect("/onboarding");

  const { data: history } = await supabase.from("challenge_assignments").select("id, week, status, challenge_id").eq("enrollment_id", d.enrollment.id).order("week", { ascending: false });
  const ids = (history ?? []).map((h) => h.challenge_id);
  const { data: rows } = ids.length ? await supabase.from("challenges").select("id, code, title").in("id", ids) : { data: [] as { id: string; code: string; title: string }[] };
  const titleOf = new Map((rows ?? []).map((r) => [r.id, m.content.challenges[r.code]?.title ?? r.title]));

  const c = d.challenge;
  const page = c?.proof_type ? PAGE[c.proof_type] : null;
  const text = c ? (m.content.challenges[c.code ?? ""] ?? { title: c.title, description: c.description }) : null;

  return (
    <>
      <BackLink />
      <p className={`${label} mt-4`}>{c ? fmt(t.label, { week: c.week, kind: c.kind === "piege" ? t.trap : fmt(t.tier, { n: c.level }) }) : t.fallback}</p>
      {c && text ? (
        <>
          <h1 className="mt-4 font-serif text-4xl leading-tight text-balance">{text.title}</h1>
          <p className="mt-3 text-mute">{text.description}</p>
          <p className="mt-6 flex gap-6 text-sm">
            <span>{fmt(t.done, { n: signed(c.points_done) })}</span>
            <span className="text-mute">{fmt(t.failed, { n: signed(c.points_failed) })}</span>
          </p>
          <p className="mt-6 font-serif text-5xl tabular-nums">{c.status === "done" ? t.doneBig : c.status === "failed" ? t.failedBig : `${c.progress.current} / ${c.progress.goal}`}</p>

          {c.status === "assigned" ? (
            <div className="mt-8">
              {page ? (
                <Link href={`/app/${page}/${c.assignment_id}?epreuve=1`} className={btnPrimary}>
                  {c.proof_type === "session" ? t.session : c.proof_type === "reps" ? t.reps : c.proof_type === "reveil" ? t.wake : t.photo}
                </Link>
              ) : null}
              {c.proof_type === "lien" ? <LinkForm mode="challenge" targetId={c.assignment_id} domains={c.rule.domains ?? []} /> : null}
              {c.proof_type === "declaratif" ? <ChallengeDeclaratif assignmentId={c.assignment_id} /> : null}
              {c.proof_type === null ? <p className="text-sm text-mute">{t.auto}</p> : null}
              {c.proof_type === "session" ? <p className="mt-4 text-xs text-mute">{t.sessionsCount}</p> : null}
            </div>
          ) : null}
        </>
      ) : (
        <p className="mt-4 text-mute">{t.soon}</p>
      )}

      {history && history.length > 1 ? (
        <section className="mt-14">
          <h2 className="font-serif text-2xl">{t.past}</h2>
          <ul className="mt-4 divide-y divide-line border-y border-line text-sm">
            {history
              .filter((h) => h.id !== c?.assignment_id)
              .map((h) => (
                <li key={h.id} className="flex justify-between gap-4 py-3">
                  <span>
                    <span className="text-mute">{fmt(t.week, { n: h.week })}</span> {titleOf.get(h.challenge_id)}
                  </span>
                  <span className={h.status === "done" ? "text-paper" : "text-mute"}>{h.status === "done" ? t.statusDone : h.status === "failed" ? t.statusFailed : t.statusRunning}</span>
                </li>
              ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
