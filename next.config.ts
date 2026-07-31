import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@earendil-works/pi-coding-agent", "better-sqlite3"],
};

export default nextConfig;
