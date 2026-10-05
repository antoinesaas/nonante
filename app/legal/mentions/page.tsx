import type { Metadata } from "next";
import { Todo } from "@/components/Todo";

export const metadata: Metadata = { title: "Mentions légales" };

export default function MentionsPage() {
  return (
    <>
      <h1>Mentions légales</h1>
      <p className="text-sm text-mute">Gabarit à compléter avant toute mise en production.</p>

      <h2>Éditeur</h2>
      <Todo>
        <p>
          Nom ou raison sociale, forme juridique, capital social, adresse du siège, numéro SIRET et RCS,
          numéro de TVA intracommunautaire, email et téléphone de contact.
        </p>
      </Todo>

      <h2>Directeur de la publication</h2>
      <Todo>
        <p>Nom et qualité du directeur de la publication.</p>
      </Todo>

      <h2>Hébergement</h2>
      <Todo>
        <p>
          Hébergeur du site (Vercel) et de la base de données (Supabase) : raison sociale, adresse,
          téléphone. Vérifier les informations sur les sites de ces prestataires.
        </p>
      </Todo>

      <h2>Images</h2>
      <p>
        Les œuvres d&apos;art affichées sur Nonante appartiennent au domaine public. Leurs crédits (titre,
        artiste, année, source) sont indiqués sous chaque image.
      </p>
    </>
  );
}
