import type { emails as fr } from "@/lib/i18n/messages/fr/emails";

export const emails: typeof fr = {
  signature: "Nonante",
  welcome: {
    subject: "Dein Arc ist gestartet.",
    body: "Deine Zahlung ist bestätigt. Dein 90-Tage-Arc ist gestartet.\n\nDeine Prinzipien warten auf dich. Ohne Nachweis zählt nichts.",
  },
  audit: {
    subject: "Kontrolle: Sende deinen Nachweis.",
    labelled: "Deine Bestätigung „{label}“ wird kontrolliert.",
    generic: "Eine deiner Bestätigungen wird kontrolliert.",
    body: "Sende vor {due} ein Foto deines Nachweises. Ohne Antwort ist die Strafe hoch.",
  },
  loyalty: {
    subject: "Arc gehalten.",
    body: "Du hast deinen Arc gehalten. 90 Tage, bewiesen.",
    applied: "Danke: Deine nächste Rechnung kostet −50 %. Nichts zu tun, der Rabatt ist schon angewendet.",
    pending: "Danke: Dein nächster 90-Tage-Arc kostet −50 %. Der Rabatt wird bei der Zahlung automatisch angewendet.",
  },
  result: {
    subject: "Dein Arc ist vorbei.",
    body: "Dein Arc ist vorbei: {green|# grüner Tag|# grüne Tage} von 90.\nNötig waren 75, mit höchstens 3 nicht grünen Tagen in Folge.\n\nDein nächster Arc beginnt, wann du willst.",
  },
  referral: {
    subject: "Jemand ist dank dir zu Nonante gekommen.",
    body: "Dein Empfehlungscode wurde genutzt: Dein Freund hat seinen Arc mit −20 % gestartet.",
    subscription: "Du auch: −20 % auf deine nächste Pro-Rechnung, schon angewendet.",
    nextArc: "Du auch: −20 % auf deinen nächsten 90-Tage-Arc. Der Rabatt wird bei der Zahlung automatisch angewendet.",
  },
};
