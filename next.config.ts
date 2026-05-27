import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Force browsers to revalidate the HTML on every visit so deploys
        // propagate immediately. CDNs (Hostinger / s-maxage) still cache
        // for a year, but each browser will check with the origin before
        // re-using its local copy. Hashed _next/static/* chunks keep
        // their own `immutable` cache headers untouched.
        source: "/",
        headers: [
          {
            key: "Cache-Control",
            value:
              "public, s-maxage=31536000, max-age=0, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
