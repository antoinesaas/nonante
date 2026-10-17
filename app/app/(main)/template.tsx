import { ViewTransition } from "react";

/**
 * Chaque onglet de l'app se remonte à la navigation (template) : l'ancien écran s'efface vite, le nouveau monte
 * doucement (View Transitions). La barre d'onglets reste immobile.
 */
export default function MainTemplate({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div>{children}</div>
    </ViewTransition>
  );
}
