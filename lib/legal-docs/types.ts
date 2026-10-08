// Documents légaux, rédigés en blocs simples pour être traduits.
// Dans le texte : [libellé](/chemin) pour un lien, {email} pour l'adresse de contact (lien), {name} et {address} pour l'éditeur.

export type LegalBlock = { h2: string } | { p: string } | { ul: string[] } | { quote: string };

export type LegalDoc = { title: string; updated: string; blocks: LegalBlock[] };

export type LegalSet = {
  /** Note en tête des traductions : la version française fait foi. */
  notice: string | null;
  mentions: LegalDoc;
  cgu: LegalDoc;
  cgv: LegalDoc;
  privacy: LegalDoc;
};
