// Emails et notifications (envoyés dans la langue enregistrée du joueur).
export const emails = {
  signature: "Nonante",
  unsubscribe: "Ne plus recevoir les rappels : {url}",
  welcome: {
    subject: "Ton arc est lancé.",
    body: "Ton paiement est confirmé. Ton arc de 90 jours est lancé.\n\nTes principes t'attendent. Rien ne se valide sans preuve.",
  },
  reminder: {
    subject: "Il te reste {n|# principe|# principes}.",
    body: "Il te reste {n|# principe|# principes} à prouver aujourd'hui. {points} points en jeu.\nMinuit, heure de Paris : après, c'est trop tard.",
    push: "Il te reste {n|# principe|# principes}. {points} points en jeu.",
  },
  audit: {
    subject: "Contrôle : envoie ta preuve.",
    labelled: "Ta validation « {label} » est contrôlée.",
    generic: "Une de tes validations est contrôlée.",
    body: "Envoie une photo de ta preuve avant {due}. Sans réponse, la pénalité est lourde.",
  },
  weekly: {
    subject: "Semaine écoulée : {green} jours verts sur {days}.",
    points: "{points} points en 7 jours.",
    days: "{green} jours verts sur {days}. Série en cours : {streak|# jour|# jours}.",
    level: "Niveau {level}, note globale {ovr}.",
    reset: "Le classement de la semaine repart de zéro aujourd'hui.",
  },
  loyalty: {
    subject: "Arc tenu.",
    body: "Tu as tenu ton arc. 90 jours, prouvés.",
    applied: "Merci : ta prochaine facture est à −50 %. Rien à faire, la remise est déjà appliquée.",
    pending: "Merci : ton prochain Arc 90 jours est à −50 %. La remise s'applique toute seule au paiement.",
  },
  result: {
    subject: "Ton arc est terminé.",
    body: "Ton arc est terminé : {green|# jour vert|# jours verts} sur 90.\nIl en fallait 75, sans plus de 3 jours non verts d'affilée.\n\nLe prochain arc commence quand tu veux.",
  },
  referral: {
    subject: "Quelqu'un a rejoint Nonante grâce à toi.",
    body: "Ton code de parrainage a servi : ton ami a lancé son arc avec −20 %.",
    subscription: "Toi aussi : −20 % sur ta prochaine facture Pro, déjà appliqués.",
    nextArc: "Toi aussi : −20 % sur ton prochain Arc 90 jours. La remise s'applique toute seule au paiement.",
  },
};
