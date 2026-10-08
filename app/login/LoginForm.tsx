"use client";

import { signInWithGoogle } from "@/app/actions/auth";
import { GoogleLabel, googleButtonClass } from "@/components/GoogleButton";
import { useI18n } from "@/components/I18nProvider";
import { SubmitButton } from "@/components/SubmitButton";

export function LoginForm({ next }: { next: string }) {
  const { m } = useI18n();
  return (
    <form action={signInWithGoogle}>
      <input type="hidden" name="next" value={next} />
      <SubmitButton className={googleButtonClass} pendingLabel={m.common.actions.redirecting}>
        <GoogleLabel />
      </SubmitButton>
    </form>
  );
}
