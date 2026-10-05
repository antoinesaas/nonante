import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChallengeDeclaratif } from "@/app/app/(main)/epreuve/ChallengeDeclaratif";
import { LinkForm } from "@/components/LinkForm";
import { requireUser } from "@/lib/auth";
import { signed } from "@/lib/proofs";
import type { Dashboard } from "@/lib/types";
import { btnPrimary, label } from "@/lib/ui";

export const metadata: Metadata = { title: "Épreuve de la semaine" };

const PAGE: Record<string, string> = { session: "session", reps: "reps", reveil: "reveil", photo: "photo" };

export default async function ChallengePage() {
  const { supabase } = await requireUser("/app/epreuve");
  const { data } = await supabase.rpc("my_dashboard");
  const d = data as Dashboard;
  if (!d?.enrollment) redirect("/onboarding");

  const { data: history } = await supabase
    .from("challenge_assignments")
    .select("id, week, status, challenge_id")
    .eq("enrollment_id", d.enrollment.id)
    .order("week", { ascending: false });
  const ids = (history ?? []).map((h) => h.challenge_id);
  const { data: titles } = ids.length
    ? await supabase.from("challenges").select("id, title, kind").in("id", ids)
    : { data: [] as { id: string; title: string; kind: string }[] };
  const titleOf = new Map((titles ?? []).map((t) => [t.id, t.title]));

  const c = d.challenge;
  const page = c?.proof_type ? PAGE[c.proof_type] : null;

  return (
    <>
      <p className={label}>{c ? `Semaine ${c.week} · ${c.kind === "piege" ? "piège" : `niveau ${c.level}`}` : "Épreuve"}</p>
      {c ? (
        <>
          <h1 className="mt-4 font-serif text-4xl leading-tight">{c.title}</h1>
          <p className="mt-3 text-mute">{c.description}</p>
          <p className="mt-6 flex gap-6 text-sm">
            <span>Réussie : {signed(c.points_done)}</span>
            <span className="text-mute">Ratée : {signed(c.points_failed)}</span>
          </p>
          <p className="mt-6 font-serif text-5xl tabular-nums">
            {c.status === "done" ? "Réussie." : c.status === "failed" ? "Ratée." : `${c.progress.current} / ${c.progress.goal}`}
          </p>

          {c.status === "assigned" ? (
            <div className="mt-8">
              {page ? (
                <Link href={`/app/${page}/${c.assignment_id}?epreuve=1`} className={btnPrimary}>
                  {c.proof_type === "session"
                    ? "Lancer une session"
                    : c.proof_type === "reps"
                      ? "Compter"
                      : c.proof_type === "reveil"
                        ? "Je suis debout"
                        : "Prendre la photo"}
                </Link>
              ) : null}
              {c.proof_type === "lien" ? <LinkForm mode="challenge" targetId={c.assignment_id} domains={c.rule.domains ?? []} /> : null}
              {c.proof_type === "declaratif" ? <ChallengeDeclaratif assignmentId={c.assignment_id} /> : null}
              {c.proof_type === null ? (
                <p className="text-sm text-mute">Rien à faire ici : l&apos;épreuve est jugée automatiquement à la clôture du jour.</p>
              ) : null}
              {c.proof_type === "session" ? (
                <p className="mt-4 text-xs text-mute">Les sessions de tes principes comptent aussi.</p>
              ) : null}
            </div>
          ) : null}
        </>
      ) : (
        <p className="mt-4 text-mute">L&apos;épreuve de la semaine arrive au départ de l&apos;arc.</p>
      )}

      {history && history.length > 1 ? (
        <section className="mt-14">
          <h2 className="font-serif text-2xl">Semaines passées</h2>
          <ul className="mt-4 divide-y divide-line border-y border-line text-sm">
            {history
              .filter((h) => h.id !== c?.assignment_id)
              .map((h) => (
                <li key={h.id} className="flex justify-between gap-4 py-3">
                  <span>
                    <span className="text-mute">S{h.week}</span> {titleOf.get(h.challenge_id)}
                  </span>
                  <span className={h.status === "done" ? "text-paper" : "text-mute"}>
                    {h.status === "done" ? "réussie" : h.status === "failed" ? "ratée" : "en cours"}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
