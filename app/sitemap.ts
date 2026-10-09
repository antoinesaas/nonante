import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";

// Pages publiques indexables. Le questionnaire (/onboarding) est exclu, comme dans robots.txt.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return ["", "/abonnement", "/faq", "/classement", "/art", "/legal/cgu", "/legal/cgv", "/legal/confidentialite", "/legal/mentions"].map((path) => ({
    url: `${base}${path}`,
  }));
}
