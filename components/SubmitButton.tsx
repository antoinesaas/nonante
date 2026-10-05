"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingLabel,
  className,
  disabled = false,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} className={className}>
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

export function FormMessage({ message, ok = false }: { message: string | null; ok?: boolean }) {
  if (!message) return null;
  return (
    <p role={ok ? "status" : "alert"} className={`mt-3 text-sm ${ok ? "text-paper" : "text-paper"}`}>
      {message}
    </p>
  );
}
