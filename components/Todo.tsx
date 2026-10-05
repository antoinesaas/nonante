/** Bloc « À COMPLÉTER » des gabarits légaux. Ne jamais publier en production sans les remplir. */
export function Todo({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xs border border-dashed border-mute p-4 text-sm">
      <p className="text-xs font-medium tracking-[0.2em] uppercase">À compléter</p>
      <div className="mt-2 space-y-2 text-mute">{children}</div>
    </div>
  );
}
