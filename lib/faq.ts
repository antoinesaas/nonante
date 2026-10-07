// Questions fréquentes. Chaque réponse décrit ce que fait vraiment l'app (aucune promesse en l'air).

export type FaqItem = { id: string; q: string; a: string };
export type FaqGroup = { title: string; items: FaqItem[] };

export const FAQ: FaqGroup[] = [
  {
    title: "Le principe",
    items: [
      {
        id: "quoi",
        q: "C'est quoi, Nonante ?",
        a: "Un arc de 90 jours pour atteindre un objectif précis : un chiffre d'affaires, des clients, un lancement, un examen. Tu suis des principes « si… alors… » construits pour ton objectif, et chaque jour tu les prouves. Tes preuves font monter tes stats de joueur, ton niveau et ta place au classement.",
      },
      {
        id: "pourquoi-90",
        q: "Pourquoi 90 jours ?",
        a: "C'est assez long pour qu'une habitude devienne automatique (66 jours en moyenne selon une étude de l'University College London, Lally et al., 2010) et assez court pour garder la ligne d'arrivée en vue. Un trimestre, c'est aussi le bon horizon pour un objectif business.",
      },
      {
        id: "principes",
        q: "Les principes, ils viennent d'où ?",
        a: "D'une bibliothèque de principes qui ont fait leurs preuves : plans « si… alors… », travail profond, « manger la grenouille », règle des 2 minutes, prospection quotidienne, réveil fixe… Nonante choisit les 6 qui collent à ton objectif et à tes points faibles. Tu peux tous les modifier, en ajouter ou en écrire de zéro.",
      },
      {
        id: "quand",
        q: "Je peux commencer quand ?",
        a: "Quand tu veux : aujourd'hui, demain, lundi prochain, une date précise, ou avec un départ collectif (comme le 1er janvier). Ton arc dure 90 jours à partir de ton jour 1.",
      },
      {
        id: "temps",
        q: "Combien de temps ça prend par jour ?",
        a: "Ça dépend des principes que tu gardes. Une preuve prend quelques secondes (photo, code, bouton) ; seules les sessions de concentration durent 25, 50 ou 90 minutes, et c'est du temps de travail que tu aurais fait de toute façon, sans téléphone.",
      },
    ],
  },
  {
    title: "Les preuves",
    items: [
      {
        id: "preuves",
        q: "Comment on prouve ?",
        a: "Selon le principe : un minuteur qui casse si tu quittes l'écran, la caméra qui compte tes pompes ou tes squats, un code à recopier à ton réveil, une photo prise dans l'app, une capture d'écran ou un lien. Une preuve forte rapporte tous les points, une preuve faible la moitié.",
      },
      {
        id: "triche",
        q: "Et si quelqu'un triche ?",
        a: "Une partie des preuves faibles est contrôlée au hasard : il faut alors envoyer une photo sous 24 heures. Une preuve refusée coûte trois fois sa valeur et reste visible sur le profil. Tricher dans un jeu contre soi-même, c'est surtout se voler 90 jours.",
      },
      {
        id: "camera",
        q: "La caméra enregistre ce que je fais ?",
        a: "Non. Le comptage des pompes et des squats se fait sur ton téléphone ; aucune image n'est envoyée. Seules les photos de preuve que tu choisis d'envoyer sont stockées, dans un espace privé, et supprimées après 30 jours.",
      },
      {
        id: "rate",
        q: "Et si je rate un jour ?",
        a: "Tu perds des points, et la série repart de zéro. Rater deux jours d'affilée coûte plus cher (« jamais deux fois »). Tu as aussi des jokers : un joker rend une journée neutre, sans points ni pénalité. Un arc est tenu avec 75 jours verts sur 90.",
      },
    ],
  },
  {
    title: "Prix et paiement",
    items: [
      {
        id: "payant",
        q: "Pourquoi ce n'est pas gratuit ?",
        a: "Parce qu'un arc gratuit se lâche au premier soir difficile. Mettre de l'argent sur la table, c'est déjà un engagement : tu as une raison de plus de tenir. Et ça nous permet de construire l'app sans publicité ni revente de données.",
      },
      {
        id: "choisir",
        q: "Arc 90 jours, Pro ou Fondateur : lequel choisir ?",
        a: "L'Arc 90 jours (19,99 € une fois) suffit pour faire un arc complet : 6 principes, toutes les preuves, le classement et les escouades. Pro (14,99 € par mois ou 99,99 € par an) est fait pour enchaîner les arcs, avec 12 principes, le portefeuille de revenus, 3 jokers et la création d'escouades. Fondateur, c'est Pro à vie en un paiement, pour les 100 premiers.",
      },
      {
        id: "renouvellement",
        q: "L'Arc 90 jours se renouvelle tout seul ?",
        a: "Non. C'est un paiement unique pour un arc de 90 jours. Rien n'est prélevé ensuite : ton prochain arc, tu le lances quand tu veux. Seul Pro est un abonnement, résiliable en un clic.",
      },
      {
        id: "retractation",
        q: "Je peux me faire rembourser ?",
        a: "Tu as 14 jours pour te rétracter. Comme tu demandes à commencer tout de suite, seule la part déjà utilisée reste due, au prorata des jours écoulés. Il suffit d'écrire à l'adresse indiquée dans les conditions de vente.",
      },
      {
        id: "remises",
        q: "Il y a des réductions ?",
        a: "Oui, les mêmes pour tout le monde. Le code d'un ami te donne −20 % sur ton premier paiement (et lui fait gagner 5 € de crédit). Et si tu tiens ton arc, ton prochain arc ou ta prochaine facture Pro est à −50 %.",
      },
      {
        id: "classement-argent",
        q: "Le classement fait gagner de l'argent ?",
        a: "Non. Le classement, les niveaux et les succès rapportent des points, des titres et des fonds pour ta carte de joueur, jamais d'argent ni de lot. Le portefeuille, lui, sert à suivre ce que tu gagnes avec ton propre projet.",
      },
    ],
  },
  {
    title: "Pratique",
    items: [
      {
        id: "installer",
        q: "Il faut installer une app ?",
        a: "Non. Nonante marche dans le navigateur de ton téléphone. Pour l'avoir comme une app, ajoute-la à ton écran d'accueil (Partager, puis « Sur l'écran d'accueil » sur iPhone).",
      },
      {
        id: "donnees",
        q: "Qu'est-ce que vous faites de mes données ?",
        a: "Le strict nécessaire pour faire tourner ton arc : ton email, tes réponses, tes preuves. Pas de publicité, pas de revente, aucun cookie de suivi. Tu peux exporter ou supprimer ton compte à tout moment depuis ton profil.",
      },
      {
        id: "public",
        q: "Les autres voient quoi de moi ?",
        a: "Si ton profil est public : ton pseudo, ta photo, ta carte de joueur, ton calendrier et tes succès. Ton objectif et ton portefeuille seulement si tu le choisis. En privé, tu apparais en « Anonyme » au classement.",
      },
    ],
  },
];

/** Une question par son identifiant (pour les extraits sur la landing, les plans et le questionnaire). */
export function faqItems(ids: string[]): FaqItem[] {
  const all = FAQ.flatMap((g) => g.items);
  return ids.map((id) => all.find((i) => i.id === id)).filter((i): i is FaqItem => Boolean(i));
}
