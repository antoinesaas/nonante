import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: { default: m.common.nav.today, template: "%s · Nonante" }, robots: { index: false } };
}

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  await requireUser("/app");
  return children;
}
