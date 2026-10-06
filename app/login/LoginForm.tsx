"use client";

import { useActionState, useState } from "react";
import { type LoginState, sendLoginCode, verifyLoginCode } from "@/app/actions/auth";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";
import { btnLink, btnPrimary, input } from "@/lib/ui";

const initial: LoginState = { step: "email", email: "", message: null };

export function LoginForm({ next }: { next: string }) {
  const [sent, sendAction] = useActionState(sendLoginCode, initial);
  const [checked, verifyAction] = useActionState(verifyLoginCode, initial);
  // Résultat d'envoi que l'utilisateur a quitté (« changer d'adresse ») : chaque nouvel envoi est un nouvel objet.
  const [dismissed, setDismissed] = useState<LoginState | null>(null);

  // Étape 2 dès que l'envoi a réussi, tant que l'utilisateur ne revient pas en arrière.
  const codeStep = sent.step === "code" && sent !== dismissed;
  const email = sent.email;

  if (!codeStep) {
    return (
      <form action={sendAction} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <label className="block">
          <span className="text-sm text-mute">Ton email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            defaultValue={email}
            placeholder="ton@email.fr"
            className={`${input} mt-2`}
          />
        </label>
        <SubmitButton className={btnPrimary} pendingLabel="Envoi…">
          Recevoir mon lien de connexion
        </SubmitButton>
        <FormMessage message={sent.message} />
      </form>
    );
  }

  return (
    <form action={verifyAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="email" value={email} />
      <p className="text-sm text-mute">
        Email envoyé à <span className="text-paper">{email}</span>. Ouvre-le et clique sur le lien, sur ce même appareil. S&apos;il
        contient un code à 6 chiffres, tu peux aussi le saisir ici.
      </p>
      <label className="block">
        <span className="text-sm text-mute">Code à 6 chiffres (si ton email en contient un)</span>
        <input
          name="token"
          required
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="[0-9 ]{6,12}"
          maxLength={12}
          placeholder="123456"
          className={`${input} mt-2 font-serif text-3xl tracking-[0.3em]`}
        />
      </label>
      <SubmitButton className={btnPrimary} pendingLabel="Vérification…">
        Se connecter
      </SubmitButton>
      <FormMessage message={checked.message} />
      <button type="button" onClick={() => setDismissed(sent)} className={btnLink}>
        Changer d&apos;adresse ou renvoyer l&apos;email
      </button>
    </form>
  );
}
