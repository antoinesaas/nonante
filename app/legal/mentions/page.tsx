import type { Metadata } from "next";
import { Todo } from "@/components/Todo";

export const metadata: Metadata = { title: "Mentions légales" };

export default function MentionsPage() {
  return (
    <>
      <h1>Mentions légales</h1>
      <p className="text-sm text-mute">Gabarit à compléter avant toute mise en production.</p>

      <h2>Éditeur</h2>
      <p>Le site Nonante est édité par Antoine Hofmann.</p>
      <Todo>
        <p>
          Statut (entrepreneur individuel, société…), adresse, numéro SIRET et RCS si applicable, numéro de
          TVA intracommunautaire si applicable, email et téléphone de contact.
        </p>
      </Todo>

      <h2>Directeur de la publication</h2>
      <p>Antoine Hofmann.</p>

      <h2>Hébergement</h2>
      <p>
        Site hébergé par Vercel Inc. Base de données, authentification et fichiers hébergés par Supabase Inc.
      </p>
      <Todo>
        <p>Adresse et téléphone de chaque hébergeur, à recopier depuis leurs mentions légales officielles.</p>
      </Todo>

      <h2>Images</h2>
      <p>
        Les œuvres d&apos;art affichées sur Nonante appartiennent au domaine public. Leurs crédits (titre,
        artiste, année, source) sont indiqués sous chaque image.
      </p>
    </>
  );
}
