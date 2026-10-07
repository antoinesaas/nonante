import type { Metadata } from "next";
import { EDITOR } from "@/lib/legal";

export const metadata: Metadata = { title: "Confidentialité" };

const mail = <a href={`mailto:${EDITOR.email}`} className="underline underline-offset-4">{EDITOR.email}</a>;

export default function ConfidentialitePage() {
  return (
    <>
      <h1>Confidentialité</h1>
      <p className="text-sm text-mute">En vigueur au 7 octobre 2026.</p>

      <h2>Responsable du traitement</h2>
      <p>
        {EDITOR.name}, {EDITOR.address}. Pour toute question sur tes données : {mail}.
      </p>

      <h2>Ce qui est collecté, et pourquoi</h2>
      <ul>
        <li>Ton adresse email : pour te connecter (sans mot de passe) et t&apos;envoyer les messages liés au service.</li>
        <li>Ton pseudo, ton année de naissance (vérifier que tu as 18 ans), ta photo de profil et ta bio si tu les ajoutes.</li>
        <li>
          Tes réponses au questionnaire (objectif, points faibles, rythme, jour 1) : elles construisent ton arc. Si tu les
          donnes avant d&apos;avoir un compte, elles sont gardées avec ton email au plus 3 jours, le temps que tu te connectes,
          puis supprimées.
        </li>
        <li>Ton objectif, tes principes, tes validations, tes sessions, tes points et tes statistiques : c&apos;est le jeu.</li>
        <li>
          Tes preuves : photos prises dans l&apos;app, captures d&apos;écran, liens. Elles servent aux contrôles et restent
          privées.
        </li>
        <li>Ton portefeuille : montants, sources, libellés et captures des revenus que tu notes.</li>
        <li>Ta photo avant / après, si tu la prends : visible par toi seul.</li>
        <li>
          Le paiement : traité par Stripe. Nonante reçoit le plan, le montant et l&apos;état de l&apos;abonnement, jamais ta carte.
        </li>
        <li>La source de ta visite (paramètres utm_source et utm_campaign), pour savoir quelle publication t&apos;a amené.</li>
        <li>
          Une empreinte chiffrée de ton adresse IP, pour limiter les abus (trop de tentatives). L&apos;adresse elle-même n&apos;est
          pas enregistrée.
        </li>
        <li>L&apos;adresse technique de ton navigateur si tu actives les notifications.</li>
      </ul>
      <p>
        Le comptage des répétitions à la caméra se fait entièrement sur ton téléphone : aucune image de la caméra n&apos;est
        envoyée, seuls le nombre et la durée des répétitions le sont.
      </p>

      <h2>Bases légales</h2>
      <ul>
        <li>L&apos;exécution du contrat : faire fonctionner ton compte, ton arc, tes preuves et ton abonnement.</li>
        <li>L&apos;intérêt légitime : contrôles anti-triche, sécurité, statistiques internes de fréquentation et de ventes.</li>
        <li>L&apos;obligation légale : conserver les traces de paiement (comptabilité).</li>
        <li>Ton choix : profil public, objectif ou revenus affichés, notifications. Tu peux changer d&apos;avis à tout moment.</li>
      </ul>

      <h2>Qui y a accès</h2>
      <p>
        Toi, et l&apos;éditeur pour l&apos;administration du service (chaque consultation d&apos;une preuve est journalisée). Ce que
        tu rends public (pseudo, carte de joueur, calendrier, succès, objectif ou revenus si tu le choisis) est visible par tous.
        Prestataires techniques, qui traitent les données pour le compte de Nonante :
      </p>
      <ul>
        <li>Supabase : base de données, authentification et fichiers.</li>
        <li>Vercel : hébergement du site (États-Unis).</li>
        <li>Stripe : paiement.</li>
        <li>Resend : envoi d&apos;emails, s&apos;il est activé.</li>
        <li>Les services de notification de ton navigateur (Apple, Google, Mozilla, Microsoft), si tu actives les notifications.</li>
      </ul>
      <p>
        Les transferts hors de l&apos;Union européenne sont encadrés par les clauses contractuelles types de la Commission
        européenne ou par le cadre de protection des données UE–États-Unis, selon le prestataire.
      </p>

      <h2>Durées de conservation</h2>
      <ul>
        <li>Photos et captures de preuve : supprimées 30 jours après leur envoi.</li>
        <li>Photo avant / après : jusqu&apos;à ce que tu la remplaces ou supprimes ton compte.</li>
        <li>Compte, jeu, portefeuille : tant que ton compte existe. Supprime-le quand tu veux, depuis ton profil.</li>
        <li>Paiements : 10 ans (obligation comptable), détachés de ton compte s&apos;il est supprimé.</li>
      </ul>

      <h2>Cookies</h2>
      <p>
        Nonante n&apos;utilise ni publicité ni pistage tiers. Deux cookies seulement : celui de ta session de connexion,
        indispensable, et celui qui garde la source de ta visite pendant 30 jours, propre à Nonante et jamais partagé.
      </p>

      <h2>Tes droits</h2>
      <p>
        Tu peux accéder à tes données, les rectifier, les supprimer, les exporter ou t&apos;opposer à leur traitement.
        L&apos;export et la suppression du compte se font directement depuis ton profil ; pour le reste, écris à {mail}. Tu peux
        aussi adresser une réclamation à la CNIL (cnil.fr).
      </p>
    </>
  );
}
