import { Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-5 lg:max-w-3xl lg:pt-24">
      <Skeleton variant="list" />
    </div>
  );
}
