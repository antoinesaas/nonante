import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return ["", "/onboarding", "/abonnement", "/faq", "/classement", "/art", "/legal/cgu", "/legal/cgv", "/legal/confidentialite", "/legal/mentions"].map((path) => ({
    url: `${base}${path}`,
  }));
}
