import type { NextConfig } from "next";
const cloud = process.env.NEXT_PUBLIC_STORAGE_MODE === "supabase";
const config: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  pageExtensions: cloud ? ["ts", "tsx"] : ["server.ts", "ts", "tsx"],
  ...(cloud
    ? {
        output: "export",
        trailingSlash: true,
        basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
        images: { unoptimized: true },
      }
    : {}),
};
export default config;
