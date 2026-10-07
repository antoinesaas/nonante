import type { Metadata } from "next";
import Link from "next/link";
import { EDITOR } from "@/lib/legal";

export const metadata: Metadata = { title: "Mentions légales" };

export default function MentionsPage() {
  return (
    <>
      <h1>Mentions légales</h1>

      <h2>Éditeur</h2>
      <p>
        Le site et l&apos;application Nonante sont édités par {EDITOR.name}, {EDITOR.address}.
      </p>
      <p>
        Contact : <a href={`mailto:${EDITOR.email}`} className="underline underline-offset-4">{EDITOR.email}</a>
      </p>

      <h2>Directeur de la publication</h2>
      <p>{EDITOR.name}.</p>

      <h2>Hébergement</h2>
      <p>
        Site hébergé par Vercel Inc., 440 N Barranca Avenue #4133, Covina, CA 91723, États-Unis (privacy@vercel.com).
      </p>
      <p>
        Base de données, authentification et fichiers hébergés par Supabase Pte. Ltd., 65 Chulia Street #38-02/03, OCBC
        Centre, Singapour 049513 (privacy@supabase.com).
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        La marque Nonante, les textes, le logo et le code de l&apos;application appartiennent à leur éditeur. Toute reproduction
        sans autorisation est interdite.
      </p>
      <p>
        Les images affichées sont des photographies sous licence CC0 ou marquées « domaine public », et des œuvres du domaine
        public. Leurs auteurs et sources sont indiqués sur la page{" "}
        <Link href="/art" className="underline underline-offset-4">
          Crédits photos
        </Link>
        . Les citations du jour viennent d&apos;auteurs du domaine public ; les traductions sont de Nonante.
      </p>

      <h2>Signaler un contenu</h2>
      <p>
        Chaque profil public a un bouton « Signaler ». Tu peux aussi écrire à{" "}
        <a href={`mailto:${EDITOR.email}`} className="underline underline-offset-4">{EDITOR.email}</a>.
      </p>
    </>
  );
}
