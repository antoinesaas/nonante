import type { Metadata } from "next";
import { Todo } from "@/components/Todo";

export const metadata: Metadata = { title: "Conditions générales de vente" };

export default function CgvPage() {
  return (
    <>
      <h1>Conditions générales de vente</h1>
      <p className="text-sm text-mute">
        Gabarit à compléter et à faire valider par un professionnel avant toute mise en production.
      </p>

      <h2>Le service</h2>
      <p>
        Nonante propose des arcs de 90 jours qui démarrent à dates fixes. Le pass d&apos;arc donne accès à
        l&apos;application pendant l&apos;arc acheté : principes, preuves, calendrier, classement.
      </p>
      <p>Le vendeur est Antoine Hofmann (voir les mentions légales).</p>
      <Todo>
        <p>Statut et coordonnées complètes du vendeur, description contractuelle du service.</p>
      </Todo>

      <h2>Prix et paiement</h2>
      <p>
        Le prix du pass est affiché toutes taxes comprises sur la page d&apos;accueil au moment de
        l&apos;achat. Un prix early bird s&apos;applique tant que l&apos;arc n&apos;a pas démarré. Le
        paiement est unique, sans abonnement, et traité par Stripe : Nonante n&apos;a jamais accès aux
        numéros de carte.
      </p>
      <Todo>
        <p>Régime de TVA applicable et mentions de facturation.</p>
      </Todo>

      <h2>Préventes</h2>
      <Todo>
        <p>
          Conditions des préventes : rattachement du pass au compte créé avec la même adresse email, et
          ce qui se passe si l&apos;arc est reporté ou annulé.
        </p>
      </Todo>

      <h2>Droit de rétractation</h2>
      <Todo>
        <p>
          Délai, modalités d&apos;exercice et éventuelles exceptions applicables à un service numérique
          dont l&apos;exécution commence à une date fixe. À faire valider.
        </p>
      </Todo>

      <h2>Classement</h2>
      <p>
        Le classement ne rapporte que des points, des succès et des œuvres d&apos;art à afficher sur
        son profil.
      </p>

      <h2>Mise sur soi</h2>
      <p>
        Cette option n&apos;est pas proposée actuellement. Si elle l&apos;est un jour : la mise est
        remboursée intégralement à qui tient son arc, et reversée à une association sinon. Elle
        n&apos;est jamais conservée par Nonante ni redistribuée aux autres participants.
      </p>
      <Todo>
        <p>Règles détaillées de la mise, à faire valider par un professionnel avant toute activation.</p>
      </Todo>

      <h2>Responsabilité, litiges et médiation</h2>
      <Todo>
        <p>
          Limitation de responsabilité, droit applicable, médiateur de la consommation (coordonnées) et
          juridiction compétente.
        </p>
      </Todo>
    </>
  );
}
