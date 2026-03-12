import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent bundling of server-side email packages — they must run in Node.js directly
  serverExternalPackages: ["@react-email/render", "@react-email/components", "resend"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
