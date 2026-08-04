import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/marketplace/job-posting";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/stories",
          "/settings",
          "/connect",
          "/create",
          "/admin",
          "/api/",
          "/dev/",
        ],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
