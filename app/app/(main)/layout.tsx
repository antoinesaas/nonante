import { BottomNav } from "@/components/BottomNav";
import { ServiceWorker } from "@/components/ServiceWorker";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="mx-auto w-full max-w-xl px-5 pt-6 pb-28">{children}</div>
      <BottomNav />
      <ServiceWorker />
    </>
  );
}
