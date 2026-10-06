// Citations du jour : auteurs du domaine public uniquement. Les textes latins, grecs, allemands,
// anglais et chinois sont traduits par Nonante (marqués « trad. ») ; les auteurs français sont cités tels quels.

export type Quote = { text: string; author: string; work: string; translated: boolean };

export const QUOTES: Quote[] = [
  { text: "Ce n'est pas parce que les choses sont difficiles que nous n'osons pas ; c'est parce que nous n'osons pas qu'elles sont difficiles.", author: "Sénèque", work: "Lettres à Lucilius, 104", translated: true },
  { text: "Pendant qu'on remet à plus tard, la vie passe.", author: "Sénèque", work: "Lettres à Lucilius, 1", translated: true },
  { text: "Tout nous est étranger ; seul le temps est à nous.", author: "Sénèque", work: "Lettres à Lucilius, 1", translated: true },
  { text: "Nous n'avons pas trop peu de temps : nous en perdons beaucoup.", author: "Sénèque", work: "De la brièveté de la vie", translated: true },
  { text: "Il n'y a pas de vent favorable pour qui ne sait pas vers quel port il va.", author: "Sénèque", work: "Lettres à Lucilius, 71", translated: true },
  { text: "Nous souffrons plus souvent en imagination que dans la réalité.", author: "Sénèque", work: "Lettres à Lucilius, 13", translated: true },
  { text: "Qui est partout n'est nulle part.", author: "Sénèque", work: "Lettres à Lucilius, 2", translated: true },
  { text: "Au point du jour, quand tu as du mal à te lever, dis-toi : je me lève pour faire mon travail d'homme.", author: "Marc Aurèle", work: "Pensées, V", translated: true },
  { text: "Ne discute plus de ce que doit être un homme de bien. Sois-en un.", author: "Marc Aurèle", work: "Pensées, X", translated: true },
  { text: "Ce qui fait obstacle à l'action fait avancer l'action. Ce qui barre la route devient la route.", author: "Marc Aurèle", work: "Pensées, V", translated: true },
  { text: "La plupart de ce que nous disons et faisons n'est pas nécessaire. Retire-le, et tu auras plus de temps et de calme.", author: "Marc Aurèle", work: "Pensées, IV", translated: true },
  { text: "À chaque instant, applique-toi avec sérieux à ce que tu as en main.", author: "Marc Aurèle", work: "Pensées, II", translated: true },
  { text: "Parmi les choses, les unes dépendent de nous, les autres non.", author: "Épictète", work: "Manuel, 1", translated: true },
  { text: "Rien de grand ne se fait d'un coup.", author: "Épictète", work: "Entretiens, I", translated: true },
  { text: "Dis-toi d'abord qui tu veux être ; puis fais ce que tu as à faire.", author: "Épictète", work: "Entretiens, III", translated: true },
  { text: "Jusqu'à quand attendras-tu pour exiger de toi le meilleur ?", author: "Épictète", work: "Manuel, 51", translated: true },
  { text: "Toute habitude se fortifie par les actes qui lui correspondent : la marche par la marche, la course par la course.", author: "Épictète", work: "Entretiens, II", translated: true },
  { text: "C'est en faisant des actes justes que nous devenons justes, et des actes courageux que nous devenons courageux.", author: "Aristote", work: "Éthique à Nicomaque, II", translated: true },
  { text: "Le caractère d'un homme, c'est son destin.", author: "Héraclite", work: "Fragments", translated: true },
  { text: "Un voyage de mille lieues commence sous tes pieds.", author: "Lao-tseu", work: "Tao-tö-king, 64", translated: true },
  { text: "Les guerriers victorieux gagnent d'abord, puis vont à la guerre.", author: "Sun Tzu", work: "L'Art de la guerre, IV", translated: true },
  { text: "Il ne suffit pas de savoir, il faut aussi appliquer ; il ne suffit pas de vouloir, il faut aussi agir.", author: "Goethe", work: "Les Années de voyage de Wilhelm Meister", translated: true },
  { text: "Ce qui ne me tue pas me rend plus fort.", author: "Nietzsche", work: "Crépuscule des idoles", translated: true },
  { text: "Le temps perdu ne se retrouve jamais.", author: "Benjamin Franklin", work: "Almanach du Pauvre Richard", translated: true },
  { text: "Bien fait vaut mieux que bien dit.", author: "Benjamin Franklin", work: "Almanach du Pauvre Richard", translated: true },
  { text: "Le génie, c'est un pour cent d'inspiration et quatre-vingt-dix-neuf pour cent de transpiration.", author: "Thomas Edison", work: "Propos rapportés", translated: true },
  { text: "La plus grande chose du monde, c'est de savoir être à soi.", author: "Montaigne", work: "Essais, I, 39", translated: false },
  { text: "Le prix de l'âme ne consiste pas à aller haut, mais ordonnément.", author: "Montaigne", work: "Essais, III, 2", translated: false },
  { text: "Tout le malheur des hommes vient d'une seule chose, qui est de ne savoir pas demeurer en repos dans une chambre.", author: "Pascal", work: "Pensées", translated: false },
  { text: "Nous avons plus de force que de volonté ; et c'est souvent pour nous excuser à nous-mêmes que nous nous imaginons que les choses sont impossibles.", author: "La Rochefoucauld", work: "Maximes, 30", translated: false },
  { text: "Le mieux est l'ennemi du bien.", author: "Voltaire", work: "La Bégueule", translated: false },
  { text: "Travaillons sans raisonner, c'est le seul moyen de rendre la vie supportable.", author: "Voltaire", work: "Candide", translated: false },
  { text: "Il faut cultiver notre jardin.", author: "Voltaire", work: "Candide", translated: false },
  { text: "Rien ne sert de courir ; il faut partir à point.", author: "La Fontaine", work: "Le Lièvre et la Tortue", translated: false },
  { text: "Patience et longueur de temps font plus que force ni que rage.", author: "La Fontaine", work: "Le Lion et le Rat", translated: false },
  { text: "Vingt fois sur le métier remettez votre ouvrage.", author: "Boileau", work: "L'Art poétique", translated: false },
  { text: "Ceux qui vivent, ce sont ceux qui luttent.", author: "Victor Hugo", work: "Les Châtiments", translated: false },
];

/** Une citation par jour, la même pour tout le monde (date au format AAAA-MM-JJ). */
export function quoteOfDay(date: string): Quote {
  const [y, m, d] = date.split("-").map(Number);
  const dayNumber = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
  return QUOTES[((dayNumber % QUOTES.length) + QUOTES.length) % QUOTES.length];
}
