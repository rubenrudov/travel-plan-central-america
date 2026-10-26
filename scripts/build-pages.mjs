import nextEnv from "@next/env";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
nextEnv.loadEnvConfig(process.cwd());
const env = {
  ...process.env,
  NEXT_PUBLIC_STORAGE_MODE: "supabase",
  NEXT_PUBLIC_BASE_PATH:
    process.env.NEXT_PUBLIC_BASE_PATH ?? "/travel-plan-central-america",
};
if (
  !env.NEXT_PUBLIC_SUPABASE_URL ||
  !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
) {
  throw Error(
    "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY before building GitHub Pages. See docs/DEPLOYMENT.md.",
  );
}
const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
if (url.protocol !== "https:" || url.username || url.password)
  throw Error("Use an HTTPS Supabase project URL without credentials.");
const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (key.startsWith("sb_secret_"))
  throw Error("Never publish a Supabase secret key. Use a publishable key.");
if (!key.startsWith("sb_publishable_")) {
  try {
    if (
      JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString())
        .role !== "anon"
    )
      throw Error();
  } catch {
    throw Error(
      "Use a Supabase publishable key or legacy anon key, never service_role.",
    );
  }
}
if (
  env.NEXT_PUBLIC_BASE_PATH &&
  !/^\/[a-zA-Z0-9_-]+$/.test(env.NEXT_PUBLIC_BASE_PATH)
)
  throw Error("Base path must be empty or a single /repository-name segment.");
const result = spawnSync(
  process.execPath,
  ["node_modules/next/dist/bin/next", "build"],
  { env, stdio: "inherit" },
);
if (result.status !== 0) process.exit(result.status || 1);
writeFileSync("out/.nojekyll", "");
