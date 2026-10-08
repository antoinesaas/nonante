import { BottomNav } from "@/components/BottomNav";
import { ServiceWorker } from "@/components/ServiceWorker";
import { navTabs } from "@/lib/nav";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const t = await navTabs();
  return (
    <>
      <div className="mx-auto w-full max-w-xl px-5 pt-6 pb-32 lg:max-w-5xl lg:px-8 lg:pt-24 lg:pb-16">{children}</div>
      <BottomNav wallet={t.wallet} grades={t.grades} />
      <ServiceWorker />
    </>
  );
}
