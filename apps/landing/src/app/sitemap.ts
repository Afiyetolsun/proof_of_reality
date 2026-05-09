import type { MetadataRoute } from "next";

const BASE = "https://realityproof.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: BASE,
      lastModified: new Date("2026-05-01"),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE}/contact`,
      lastModified: new Date("2026-05-01"),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE}/terms`,
      lastModified: new Date("2026-05-01"),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE}/privacy`,
      lastModified: new Date("2026-05-01"),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE}/cookies`,
      lastModified: new Date("2026-05-01"),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
