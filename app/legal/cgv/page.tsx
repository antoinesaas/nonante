import type { Metadata } from "next";
import { EDITOR } from "@/lib/legal";

export const metadata: Metadata = { title: "Conditions générales de vente" };

const mail = <a href={`mailto:${EDITOR.email}`} className="underline underline-offset-4">{EDITOR.email}</a>;

export default function CgvPage() {
  return (
    <>
      <h1>Conditions générales de vente</h1>
      <p className="text-sm text-mute">En vigueur au 6 octobre 2026.</p>

      <h2>1. Vendeur</h2>
      <p>
        {EDITOR.name}, {EDITOR.address}. Contact : {mail}.
      </p>

      <h2>2. Le service</h2>
      <p>
        Nonante est une application web qui accompagne un arc de 90 jours : un objectif, des principes « si… alors… »
        personnalisés, des preuves quotidiennes (minuteur, comptage de répétitions à la caméra, code de réveil, photo, capture
        d&apos;écran, lien), des statistiques, un classement et des escouades. Le service est accessible depuis un navigateur,
        sur téléphone ou ordinateur.
      </p>

      <h2>3. Plans et prix</h2>
      <ul>
        <li>Essentiel : 7,99 € par mois, ou 59,99 € par an.</li>
        <li>Pro : 14,99 € par mois, ou 99,99 € par an.</li>
        <li>Fondateur : 199 € en un seul paiement, accès au plan Pro sans limite de durée, dans la limite de 100 places.</li>
      </ul>
      <p>
        Les prix sont en euros, toutes taxes comprises. Le contenu de chaque plan est décrit sur la page Plans au moment de la
        commande. Un changement de prix ne s&apos;applique jamais à une période déjà payée ; pour un abonnement en cours, il est
        annoncé au moins 30 jours à l&apos;avance et tu peux résilier avant qu&apos;il s&apos;applique.
      </p>

      <h2>4. Commande et paiement</h2>
      <p>
        Le paiement est traité par Stripe. Nonante n&apos;a jamais accès à tes numéros de carte. L&apos;abonnement mensuel ou
        annuel se renouvelle automatiquement à la fin de chaque période, au prix en vigueur, jusqu&apos;à résiliation. Une facture
        est disponible dans ton espace de paiement (Profil, puis « Gérer mon abonnement »).
      </p>

      <h2>5. Résiliation</h2>
      <p>
        Tu peux résilier à tout moment, en un clic, depuis ton profil. La résiliation prend effet à la fin de la période déjà
        payée : ton accès reste ouvert jusque-là, et aucun nouveau prélèvement n&apos;a lieu. Les périodes entamées ne sont pas
        remboursées, sauf exercice du droit de rétractation (article 6).
      </p>
      <p>
        Sans abonnement actif, ton arc continue de tourner mais plus aucune preuve ne peut être validée : les jours deviennent
        blancs, selon les règles du jeu.
      </p>

      <h2>6. Droit de rétractation</h2>
      <p>
        Tu disposes de 14 jours à compter de ta souscription pour te rétracter, sans avoir à te justifier (articles L221-18 et
        suivants du Code de la consommation). Au moment du paiement, tu demandes expressément que le service commence tout de
        suite. Si tu te rétractes dans ces 14 jours, tu paies seulement la part du service déjà fournie jusqu&apos;à ta
        rétractation, au prorata (article L221-25), et le reste t&apos;est remboursé dans les 14 jours, par le même moyen de
        paiement.
      </p>
      <p>
        Pour te rétracter, envoie une déclaration claire à {mail}, par exemple avec le modèle ci-dessous.
      </p>
      <blockquote className="border-l border-line pl-4 text-sm text-mute">
        À l&apos;attention de {EDITOR.name}, {EDITOR.address}, {EDITOR.email} : je vous notifie par la présente ma rétractation du
        contrat portant sur l&apos;abonnement Nonante ci-dessous. Plan : … Souscrit le : … Nom et adresse email du compte : …
        Date : …
      </blockquote>

      <h2>7. Remises</h2>
      <ul>
        <li>Parrainage : le code d&apos;un joueur donne −20 % sur le premier paiement d&apos;un nouvel abonné ; le parrain reçoit 5 € de crédit déduit de sa prochaine facture.</li>
        <li>Fidélité : un arc tenu donne −50 % sur la prochaine facture de l&apos;abonnement, une seule fois par arc.</li>
      </ul>
      <p>
        Ces remises sont identiques pour tous, n&apos;ont aucune valeur en argent et ne sont jamais liées au classement.
      </p>

      <h2>8. Classement et jeu</h2>
      <p>
        Le classement, les niveaux et les succès ne rapportent que des points, des titres et des fonds d&apos;écran pour la carte
        de joueur. Aucun gain en argent ni en lot n&apos;est attribué. Le portefeuille est un suivi personnel de ce que tu gagnes
        avec ton propre projet : Nonante ne verse ni ne garde d&apos;argent.
      </p>

      <h2>9. Règles de conduite</h2>
      <p>
        Les preuves doivent être réelles. Une preuve refusée lors d&apos;un contrôle entraîne les pénalités prévues par les
        règles du jeu. Un comportement frauduleux, un pseudo ou une photo de profil offensants peuvent entraîner le masquage du
        profil ou la fermeture du compte.
      </p>

      <h2>10. Santé</h2>
      <p>
        Les principes sportifs (pompes, squats, course…) se pratiquent sous ta responsabilité, selon ta condition physique. En
        cas de doute, demande l&apos;avis d&apos;un médecin. Nonante ne fournit aucun conseil médical.
      </p>

      <h2>11. Responsabilité</h2>
      <p>
        Nonante s&apos;engage à fournir le service avec soin et à le rendre disponible le mieux possible. Des interruptions
        ponctuelles peuvent survenir pour maintenance. La responsabilité de l&apos;éditeur ne peut être engagée que pour un
        dommage direct et prouvé, dans la limite des sommes payées au cours des 12 derniers mois.
      </p>

      <h2>12. Données personnelles</h2>
      <p>Le traitement de tes données est décrit dans la politique de confidentialité.</p>

      <h2>13. Litiges</h2>
      <p>
        Ces conditions sont soumises au droit français. En cas de difficulté, écris d&apos;abord à {mail} : on cherche une
        solution à l&apos;amiable. Tu peux aussi recourir gratuitement à un médiateur de la consommation (articles L611-1 et
        suivants du Code de la consommation) ; ses coordonnées te sont communiquées sur simple demande. À défaut d&apos;accord, les
        tribunaux français sont compétents.
      </p>
    </>
  );
}
