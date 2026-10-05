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
          Adresse et email de contact de l&apos;éditeur.
        </p>
      </Todo>

      <h2>Directeur de la publication</h2>
      <p>Antoine Hofmann.</p>

      <h2>Hébergement</h2>
      <p>
        Site hébergé par Vercel Inc., 440 N Barranca Avenue #4133, Covina, CA 91723, États-Unis
        (privacy@vercel.com).
      </p>
      <p>
        Base de données, authentification et fichiers hébergés par Supabase Pte. Ltd., 65 Chulia Street
        #38-02/03, OCBC Centre, Singapour 049513 (privacy@supabase.com).
      </p>

      <h2>Images</h2>
      <p>
        Les œuvres d&apos;art affichées sur Nonante appartiennent au domaine public. Leurs crédits (titre,
        artiste, année, source) sont indiqués sous chaque image.
      </p>
    </>
  );
}
