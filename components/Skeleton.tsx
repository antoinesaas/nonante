/** Squelette affiché pendant le chargement d'une page : la navigation répond tout de suite. */
export function Skeleton({ variant = "page" }: { variant?: "page" | "focus" }) {
  const bar = "rounded-xs bg-surface animate-breathe";
  if (variant === "focus") {
    return (
      <div aria-hidden="true" className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center px-5 pt-16">
        <span className={`h-3 w-2/3 ${bar}`} />
        <span className="my-auto size-64 animate-breathe rounded-full border-2 border-surface" />
        <span className={`mb-12 h-14 w-full ${bar}`} />
      </div>
    );
  }
  return (
    <div aria-hidden="true" className="space-y-6">
      <div className="flex items-center gap-4">
        <span className="size-13 animate-breathe rounded-full bg-surface" />
        <div className="flex-1 space-y-2">
          <span className={`block h-5 w-1/3 ${bar}`} />
          <span className={`block h-3 w-1/2 ${bar}`} />
        </div>
      </div>
      <span className={`block h-3 w-1/4 ${bar}`} />
      <span className={`block h-14 w-2/3 ${bar}`} />
      <span className={`block h-24 w-full ${bar}`} />
      <span className={`block h-24 w-full ${bar}`} />
      <span className={`block h-24 w-full ${bar}`} />
    </div>
  );
}
