/**
 * Quelques mots à la main (police Caveat), légèrement penchés, avec un trait qui se dessine en option.
 * À doser : un ou deux mots par écran, jamais un paragraphe.
 */
export function Hand({
  children,
  underline = false,
  tilt = "left",
  className = "",
}: {
  children: React.ReactNode;
  underline?: boolean;
  tilt?: "left" | "right" | "none";
  className?: string;
}) {
  const rotate = tilt === "left" ? "-rotate-2" : tilt === "right" ? "rotate-2" : "";
  return (
    <span className={`relative inline-block font-hand leading-none ${rotate} ${className}`}>
      {children}
      {underline ? (
        <svg
          aria-hidden="true"
          viewBox="0 0 200 12"
          preserveAspectRatio="none"
          className="absolute -bottom-1.5 left-0 h-2.5 w-full overflow-visible"
        >
          <path
            d="M2 8 C 40 3, 90 2, 130 5 S 185 9, 198 4"
            pathLength="1"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="stroke-draw"
          />
        </svg>
      ) : null}
    </span>
  );
}

/** Petite flèche dessinée à la main, qui se trace à l'apparition. */
export function HandArrow({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 60 40" className={`h-8 w-12 ${className}`}>
      <path
        d="M4 6 C 18 30, 36 34, 54 26"
        pathLength="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="stroke-draw"
      />
      <path
        d="M44 20 L 55 26 L 45 34"
        pathLength="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-draw [animation-delay:1.1s]"
      />
    </svg>
  );
}
