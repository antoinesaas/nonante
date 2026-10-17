/** Squelette affiché pendant le chargement d'une page : formes de l'écran avec un reflet qui passe, jamais de noir. */
export function Skeleton({ variant = "page" }: { variant?: "page" | "focus" | "list" }) {
  if (variant === "focus") {
    return (
      <div aria-hidden="true" className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <span className="skeleton h-9 w-9 self-start rounded-full" />
        <span className="skeleton mt-10 h-4 w-2/3 rounded-full" />
        <span className="skeleton my-auto size-64 rounded-full" />
        <span className="skeleton mb-[max(2rem,env(safe-area-inset-bottom))] h-14 w-full rounded-full" />
      </div>
    );
  }
  if (variant === "list") {
    return (
      <div aria-hidden="true" className="space-y-4 pt-2">
        <span className="skeleton block h-9 w-1/2 rounded-xl" />
        <span className="skeleton block h-4 w-2/3 rounded-full" />
        <span className="skeleton mt-6 block h-40 w-full rounded-[1.75rem]" />
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="skeleton block h-16 w-full rounded-2xl" />
        ))}
      </div>
    );
  }
  return (
    <div aria-hidden="true" className="space-y-5 pt-2">
      <div className="flex items-center gap-3">
        <span className="skeleton size-11 rounded-full" />
        <div className="flex-1 space-y-2">
          <span className="skeleton block h-4 w-1/3 rounded-full" />
          <span className="skeleton block h-3 w-1/4 rounded-full" />
        </div>
        <span className="skeleton h-9 w-16 rounded-full" />
      </div>
      <span className="skeleton block h-56 w-full rounded-[1.75rem]" />
      <span className="skeleton block h-5 w-1/3 rounded-full" />
      {[0, 1, 2].map((i) => (
        <span key={i} className="skeleton block h-20 w-full rounded-3xl" />
      ))}
    </div>
  );
}
