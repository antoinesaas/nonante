import { BottomNav } from "@/components/BottomNav";
import { ServiceWorker } from "@/components/ServiceWorker";
import { navTabs } from "@/lib/nav";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const t = await navTabs();
  return (
    <>
      <div className="relative isolate mx-auto w-full max-w-xl overflow-x-clip px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-36 sm:px-5 lg:max-w-5xl lg:px-8 lg:pt-24 lg:pb-16">
        {children}
      </div>
      <BottomNav wallet={t.wallet} grades={t.grades} />
      <ServiceWorker />
    </>
  );
}
