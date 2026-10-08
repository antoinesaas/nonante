import { Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-xl px-5 pt-10 lg:max-w-3xl lg:pt-24">
      <Skeleton />
    </div>
  );
}
