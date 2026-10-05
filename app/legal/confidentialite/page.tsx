import type { Metadata } from "next";
import { Todo } from "@/components/Todo";

export const metadata: Metadata = { title: "Confidentialité" };

export default function ConfidentialitePage() {
  return (
    <>
      <h1>Confidentialité</h1>
      <p className="text-sm text-mute">
        Gabarit à compléter et à faire valider avant toute mise en production.
      </p>

      <h2>Responsable du traitement</h2>
      <p>Antoine Hofmann, éditeur de Nonante.</p>
      <Todo>
        <p>Adresse postale et email de contact pour les données personnelles.</p>
      </Todo>

      <h2>Données collectées</h2>
      <ul>
        <li>Ton adresse email, si tu rejoins la liste d&apos;attente ou si tu achètes un pass.</li>
        <li>La source qui t&apos;a amené ici (paramètres utm_source et utm_campaign).</li>
        <li>
          Les données de paiement, traitées par Stripe. Nonante ne voit jamais ton numéro de carte.
        </li>
        <li>
          Une empreinte chiffrée de ton adresse IP, pour limiter les abus. L&apos;adresse IP elle-même
          n&apos;est pas enregistrée.
        </li>
      </ul>
      <p>Quand l&apos;application ouvrira, s&apos;y ajouteront :</p>
      <ul>
        <li>ton pseudo, ton année de naissance, ton objectif et tes réponses à l&apos;inscription ;</li>
        <li>tes validations et tes points ;</li>
        <li>les photos de preuve, privées et supprimées après 30 jours ;</li>
        <li>
          le comptage des répétitions à la caméra, fait entièrement sur ton téléphone : aucune image ne
          quitte l&apos;appareil.
        </li>
      </ul>

      <h2>Finalités, bases légales et durées de conservation</h2>
      <Todo>
        <p>Pour chaque traitement : finalité, base légale et durée de conservation.</p>
      </Todo>

      <h2>Prestataires</h2>
      <Todo>
        <p>
          Supabase (base de données), Stripe (paiement), Resend (emails), Vercel (hébergement) : rôle,
          localisation des données et garanties en cas de transfert hors de l&apos;Union européenne.
        </p>
      </Todo>

      <h2>Cookies</h2>
      <p>
        Nonante n&apos;utilise aucun cookie publicitaire ni de mesure d&apos;audience tiers. Un cookie
        first-party, nonante_utm, garde 30 jours la source qui t&apos;a amené, pour savoir quelle vidéo
        ou quel partenaire a généré une vente.
      </p>
      <Todo>
        <p>Vérifier que ce cookie d&apos;attribution entre dans les exemptions de consentement de la CNIL.</p>
      </Todo>

      <h2>Tes droits</h2>
      <p>
        Tu peux accéder à tes données, les rectifier, les supprimer, les exporter ou t&apos;opposer à
        leur traitement. Tu peux aussi adresser une réclamation à la CNIL.
      </p>
      <Todo>
        <p>Adresse de contact pour exercer ces droits.</p>
      </Todo>
    </>
  );
}
