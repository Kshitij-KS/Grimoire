import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/demo"],
        disallow: [
          "/dashboard",
          "/worlds/*",
          "/api/*",
          "/login",
          "/signup",
        ],
      },
    ],
    sitemap: "https://grimoire.pro/sitemap.xml",
  };
}
