import type { MetadataRoute } from "next";

const siteUrl = "https://ldrivingacademy.co.uk";

const publicRoutes = [
  { path: "/", priority: 1, changeFrequency: "weekly" as const },
  { path: "/lesson-now", priority: 0.95, changeFrequency: "weekly" as const },
  { path: "/smart-match", priority: 0.9, changeFrequency: "weekly" as const },
  { path: "/instructor", priority: 0.85, changeFrequency: "monthly" as const },
  { path: "/about", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/contact", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/learner-plus", priority: 0.8, changeFrequency: "weekly" as const },
  { path: "/instructor-plus", priority: 0.8, changeFrequency: "weekly" as const },
  { path: "/social", priority: 0.75, changeFrequency: "weekly" as const },
  { path: "/roadworthy", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "/theory-test", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "/practical-test", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "/support/guest", priority: 0.5, changeFrequency: "monthly" as const },
  { path: "/privacy", priority: 0.4, changeFrequency: "yearly" as const },
  { path: "/terms", priority: 0.4, changeFrequency: "yearly" as const },
  { path: "/cookies", priority: 0.4, changeFrequency: "yearly" as const },
  { path: "/accessibility", priority: 0.4, changeFrequency: "yearly" as const },
  { path: "/data-requests", priority: 0.4, changeFrequency: "yearly" as const },
  { path: "/cancellation-policy", priority: 0.4, changeFrequency: "yearly" as const }
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return publicRoutes.map((route) => ({
    url: `${siteUrl}${route.path}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority
  }));
}
