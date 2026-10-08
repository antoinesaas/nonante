"use client";

import { useActionState, useState } from "react";
import { type LoginState, sendLoginCode, signInWithProvider, verifyLoginCode } from "@/app/actions/auth";
import { useI18n } from "@/components/I18nProvider";
import { OAUTH_PROVIDERS, oauthButtonClass, OrDivider, ProviderLabel } from "@/components/OAuthButtons";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";
import { fmt } from "@/lib/i18n/format";
import { btnLink, btnPrimary, input } from "@/lib/ui";

const initial: LoginState = { step: "email", email: "", message: null };

export function LoginForm({ next }: { next: string }) {
  const { m } = useI18n();
  const t = m.auth;
  const [sent, sendAction] = useActionState(sendLoginCode, initial);
  const [checked, verifyAction] = useActionState(verifyLoginCode, initial);
  // Résultat d'envoi que l'utilisateur a quitté (« changer d'adresse ») : chaque nouvel envoi est un nouvel objet.
  const [dismissed, setDismissed] = useState<LoginState | null>(null);

  // Étape 2 dès que l'envoi a réussi, tant que l'utilisateur ne revient pas en arrière.
  const codeStep = sent.step === "code" && sent !== dismissed;
  const email = sent.email;

  if (!codeStep) {
    return (
      <div className="space-y-6">
        {OAUTH_PROVIDERS.length ? (
          <>
            <div className="space-y-3">
              {OAUTH_PROVIDERS.map((provider) => (
                <form key={provider} action={signInWithProvider}>
                  <input type="hidden" name="next" value={next} />
                  <input type="hidden" name="provider" value={provider} />
                  <SubmitButton className={oauthButtonClass(provider)} pendingLabel={m.common.actions.redirecting}>
                    <ProviderLabel provider={provider} />
                  </SubmitButton>
                </form>
              ))}
            </div>
            <OrDivider />
          </>
        ) : null}
        <form action={sendAction} className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <label className="block">
            <span className="text-sm text-mute">{t.email}</span>
            <input name="email" type="email" required autoComplete="email" inputMode="email" defaultValue={email} placeholder={t.emailPlaceholder} className={`${input} mt-2`} />
          </label>
          <SubmitButton className={btnPrimary} pendingLabel={m.common.actions.sending}>
            {t.sendCode}
          </SubmitButton>
          <FormMessage message={sent.message} />
        </form>
      </div>
    );
  }

  return (
    <form action={verifyAction} className="animate-step space-y-4">
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="email" value={email} />
      <p className="text-sm text-mute">{fmt(t.sent, { email })}</p>
      <label className="block">
        <span className="text-sm text-mute">{t.code}</span>
        <input
          name="token"
          required
          autoFocus
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="[0-9 ]{6,12}"
          maxLength={12}
          placeholder="123456"
          className={`${input} mt-2 font-serif text-3xl tracking-[0.3em]`}
        />
      </label>
      <SubmitButton className={btnPrimary} pendingLabel={t.verifying}>
        {t.signIn}
      </SubmitButton>
      <FormMessage message={checked.message} />
      <p className="text-xs text-mute">{t.spam}</p>
      <button type="button" onClick={() => setDismissed(sent)} className={btnLink}>
        {t.change}
      </button>
    </form>
  );
}
