import type { Metadata } from "next";
import Link from "next/link";
import { EDITOR } from "@/lib/legal";

export const metadata: Metadata = { title: "Conditions générales d'utilisation" };

const mail = <a href={`mailto:${EDITOR.email}`} className="underline underline-offset-4">{EDITOR.email}</a>;

export default function CguPage() {
  return (
    <>
      <h1>Conditions générales d&apos;utilisation</h1>
      <p className="text-sm text-mute">En vigueur au 7 octobre 2026.</p>
      <p>
        Ces conditions encadrent l&apos;utilisation du site et de l&apos;application Nonante, édités par {EDITOR.name},{" "}
        {EDITOR.address} (contact : {mail}). Les conditions de paiement sont dans les{" "}
        <Link href="/legal/cgv" className="underline underline-offset-4">
          conditions générales de vente
        </Link>
        , le traitement des données dans la{" "}
        <Link href="/legal/confidentialite" className="underline underline-offset-4">
          politique de confidentialité
        </Link>
        .
      </p>

      <h2>1. Le service</h2>
      <p>
        Nonante accompagne un arc de 90 jours : un objectif, des principes « si… alors… » personnalisés, des preuves
        quotidiennes, des statistiques de joueur, un classement et des escouades. Le questionnaire et la page des plans sont
        accessibles sans compte ; le reste demande un compte et un plan payé.
      </p>

      <h2>2. Accès et compte</h2>
      <ul>
        <li>Nonante est réservé aux personnes majeures (18 ans ou plus).</li>
        <li>
          Le compte se crée avec une adresse email, sans mot de passe : un lien et un code de connexion sont envoyés à chaque
          connexion. Tu es responsable de l&apos;accès à ta boîte email.
        </li>
        <li>Un compte par personne. Les adresses email jetables ne sont pas acceptées.</li>
        <li>
          Ton pseudo et ta photo de profil ne doivent ni usurper l&apos;identité de quelqu&apos;un, ni être injurieux,
          discriminatoires, sexuels ou contraires à la loi.
        </li>
      </ul>

      <h2>3. Les règles du jeu</h2>
      <p>
        Les règles (points, preuves, jokers, quêtes, niveaux, classement, arc tenu ou lâché) sont décrites dans l&apos;app et dans
        la{" "}
        <Link href="/faq" className="underline underline-offset-4">
          foire aux questions
        </Link>
        . Elles sont appliquées par le serveur, à l&apos;heure de Paris, de la même façon pour tout le monde. Nonante peut les
        ajuster pour corriger un déséquilibre ou une faille ; un changement ne retire jamais des points déjà gagnés honnêtement.
      </p>

      <h2>4. Les preuves</h2>
      <ul>
        <li>Une preuve doit correspondre à ce que tu as réellement fait, le jour même.</li>
        <li>
          Une partie des preuves faibles est contrôlée au hasard. Une preuve refusée entraîne les pénalités prévues par les
          règles du jeu et reste comptée sur ton profil.
        </li>
        <li>
          Interdit : contourner le minuteur, la caméra ou le code de réveil, réutiliser la preuve de quelqu&apos;un d&apos;autre,
          automatiser des validations, exploiter une faille au lieu de la signaler.
        </li>
        <li>
          Le comptage à la caméra se fait sur ton appareil, aucune image n&apos;est envoyée. Les photos de preuve que tu
          envoies sont privées et supprimées après 30 jours.
        </li>
      </ul>

      <h2>5. Tes contenus</h2>
      <p>
        Tu restes propriétaire de ce que tu publies (photo de profil, bio, preuves, liens). Tu autorises Nonante à les
        stocker, les afficher selon tes réglages (public ou privé) et les contrôler, uniquement pour faire fonctionner le
        service et pendant la durée nécessaire. Ne publie que des contenus dont tu as les droits, et aucune photo d&apos;une
        autre personne sans son accord.
      </p>

      <h2>6. Profils publics, classement et escouades</h2>
      <ul>
        <li>
          Si ton profil est public, ton pseudo, ta photo, ta carte de joueur, ton calendrier et tes succès sont visibles par
          tous ; ton objectif et ton portefeuille seulement si tu le choisis. En privé, tu apparais en « Anonyme ».
        </li>
        <li>
          Le classement, les niveaux et les succès ne donnent droit à aucun gain en argent ni en lot. Le portefeuille est un
          suivi personnel : Nonante ne verse, ne garde et ne transfère aucun argent.
        </li>
        <li>
          Chaque profil peut être signalé. Après examen, un profil peut être masqué et un compte suspendu ou fermé en cas de
          manquement à ces conditions. Tu peux contester une décision en écrivant à {mail}.
        </li>
      </ul>

      <h2>7. Santé et conseils</h2>
      <p>
        Les principes sportifs (pompes, squats, course…) et de sommeil se pratiquent sous ta responsabilité, selon ta condition
        physique ; demande l&apos;avis d&apos;un médecin en cas de doute. Les principes business et d&apos;études sont des
        méthodes d&apos;organisation, pas des conseils financiers, juridiques ou médicaux. Nonante ne garantit pas
        l&apos;atteinte de ton objectif : c&apos;est toi qui le tiens.
      </p>

      <h2>8. Disponibilité</h2>
      <p>
        Nonante fait de son mieux pour que le service soit disponible et sûr. Des interruptions peuvent survenir pour
        maintenance ou en cas de panne d&apos;un prestataire ; si une panne t&apos;empêche de valider une preuve, écris à {mail} :
        la journée peut être corrigée après vérification.
      </p>

      <h2>9. Propriété intellectuelle</h2>
      <p>
        La marque Nonante, le logo, les textes, les règles du jeu et le code de l&apos;application sont protégés. Les images
        viennent de sources libres de droits ou du domaine public, créditées sur la page{" "}
        <Link href="/art" className="underline underline-offset-4">
          Crédits photos
        </Link>
        .
      </p>

      <h2>10. Fin du compte</h2>
      <p>
        Tu peux exporter tes données et supprimer ton compte à tout moment depuis ton profil. La suppression efface ton
        profil, tes principes, tes preuves, tes points et tes photos ; les traces de paiement sont conservées, détachées de
        ton compte, pour les obligations comptables.
      </p>

      <h2>11. Modifications</h2>
      <p>
        Ces conditions peuvent évoluer. Les changements importants te sont annoncés dans l&apos;app au moins 15 jours avant de
        s&apos;appliquer ; si tu n&apos;es pas d&apos;accord, tu peux supprimer ton compte.
      </p>

      <h2>12. Droit applicable</h2>
      <p>
        Ces conditions sont soumises au droit français. En cas de désaccord, écris d&apos;abord à {mail} pour trouver une
        solution à l&apos;amiable ; les voies de recours prévues par les conditions générales de vente s&apos;appliquent.
      </p>
    </>
  );
}
