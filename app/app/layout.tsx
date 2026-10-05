import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Aujourd'hui", robots: { index: false } };

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  await requireUser("/app");
  return children;
}
