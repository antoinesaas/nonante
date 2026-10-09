import type { emails as fr } from "@/lib/i18n/messages/fr/emails";

export const emails: typeof fr = {
  signature: "Nonante",
  welcome: {
    subject: "Your arc is live.",
    body: "Your payment is confirmed. Your 90-day arc is live.\n\nYour principles are waiting. Nothing counts without proof.",
  },
  audit: {
    subject: "Check: send your proof.",
    labelled: "Your validation “{label}” is being checked.",
    generic: "One of your validations is being checked.",
    body: "Send a photo of your proof before {due}. Without an answer, the penalty is heavy.",
  },
  loyalty: {
    subject: "Arc held.",
    body: "You held your arc. 90 days, proven.",
    applied: "Thank you: your next invoice is −50%. Nothing to do, the discount is already applied.",
    pending: "Thank you: your next 90-day Arc is −50%. The discount applies automatically at payment.",
  },
  result: {
    subject: "Your arc is over.",
    body: "Your arc is over: {green|# green day|# green days} out of 90.\nYou needed 75, with no more than 3 non-green days in a row.\n\nYour next arc starts whenever you want.",
  },
  referral: {
    subject: "Someone joined Nonante thanks to you.",
    body: "Your referral code was used: your friend launched their arc with −20%.",
    subscription: "You too: −20% on your next Pro invoice, already applied.",
    nextArc: "You too: −20% on your next 90-day Arc. The discount applies automatically at payment.",
  },
};
