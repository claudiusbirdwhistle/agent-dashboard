import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const expressUrl = process.env.EXPRESS_URL || "http://localhost:3000";
    return [
      {
        source: "/api/status",
        destination: `${expressUrl}/api/status`,
      },
      {
        source: "/api/toggle",
        destination: `${expressUrl}/api/toggle`,
      },
      {
        source: "/api/file",
        destination: `${expressUrl}/api/file`,
      },
      {
        source: "/api/documents",
        destination: `${expressUrl}/api/documents`,
      },
      {
        source: "/api/state",
        destination: `${expressUrl}/api/state`,
      },
      {
        source: "/api/live",
        destination: `${expressUrl}/api/live`,
      },
      {
        source: "/api/logs",
        destination: `${expressUrl}/api/logs`,
      },
      {
        source: "/api/journal",
        destination: `${expressUrl}/api/journal`,
      },
      {
        source: "/api/directives",
        destination: `${expressUrl}/api/directives`,
      },
      {
        source: "/api/directives/:id",
        destination: `${expressUrl}/api/directives/:id`,
      },
    ];
  },
};

export default nextConfig;
