import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return ["", "/abonnement", "/classement", "/art", "/legal/cgv", "/legal/confidentialite", "/legal/mentions"].map((path) => ({
    url: `${base}${path}`,
  }));
}
