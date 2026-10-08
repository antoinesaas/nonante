import type { Metadata } from "next";
import { LegalArticle } from "@/components/LegalArticle";
import { isLocale } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { legalDocs } from "@/lib/legal-docs";

async function pick(lang?: string | string[]) {
  const locale = lang === "fr" ? "fr" : await getLocale();
  return legalDocs(isLocale(locale) ? locale : "fr");
}

export async function generateMetadata({ searchParams }: PageProps<"/legal/cgv">): Promise<Metadata> {
  const docs = await pick((await searchParams).lang);
  return { title: docs.cgv.title };
}

export default async function CgvPage({ searchParams }: PageProps<"/legal/cgv">) {
  const docs = await pick((await searchParams).lang);
  return <LegalArticle doc={docs.cgv} notice={docs.notice} frenchHref="/legal/cgv" />;
}
