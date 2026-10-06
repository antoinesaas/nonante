import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { type CollectiveStart, OnboardingFlow, type OnboardingPrefill } from "@/app/onboarding/OnboardingFlow";
import { getArt, IMAGES } from "@/lib/art";
import { requireUser } from "@/lib/auth";
import { todayParis } from "@/lib/dates";

export const metadata: Metadata = { title: "Ton arc", robots: { index: false } };

export default async function OnboardingPage() {
  const { supabase, user } = await requireUser("/onboarding");
  const today = todayParis();

  const [{ data: profile }, { data: enrollments }, { data: starts }] = await Promise.all([
    supabase.from("profiles").select("pseudo").eq("id", user.id).maybeSingle(),
    supabase
      .from("enrollments")
      .select("id, arc_number, status, start_date, category, goal_type, goal_title, goal_target, goal_unit, goal_public, weak_points, wake_time, pushups, focus_minutes")
      .eq("user_id", user.id)
      .order("arc_number", { ascending: false }),
    supabase.rpc("collective_starts"),
  ]);

  // Arc en cours (jour 1 passé) : il se pilote depuis le tableau de bord.
  const open = (enrollments ?? []).find((e) => e.status === "draft" || e.status === "active");
  if (open && open.status === "active" && open.start_date <= today) redirect("/app");

  const prefill: OnboardingPrefill | null = open
    ? {
        category: open.category as OnboardingPrefill["category"],
        goalType: open.goal_type as OnboardingPrefill["goalType"],
        goal: open.goal_title,
        goalTarget: open.goal_target,
        goalUnit: open.goal_unit,
        goalPublic: open.goal_public,
        weakPoints: open.weak_points,
        wakeTime: open.wake_time.slice(0, 5),
        pushups: open.pushups as OnboardingPrefill["pushups"],
        focusMinutes: open.focus_minutes as OnboardingPrefill["focusMinutes"],
        startDate: open.start_date,
      }
    : null;

  const arcNumber = open ? open.arc_number : (enrollments?.[0]?.arc_number ?? 0) + 1;

  return (
    <OnboardingFlow
      hasProfile={Boolean(profile)}
      prefill={prefill}
      arts={IMAGES.onboarding.map((slug) => getArt(slug))}
      currentYear={Number(today.slice(0, 4))}
      today={today}
      collectiveStarts={(starts as CollectiveStart[] | null) ?? []}
      arcNumber={arcNumber}
    />
  );
}
