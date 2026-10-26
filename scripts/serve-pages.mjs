import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname } from "node:path";
const root = resolve("out"),
  base = process.env.NEXT_PUBLIC_BASE_PATH ?? "/travel-plan-central-america";
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".txt": "text/plain",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};
createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    if (base && path !== base && !path.startsWith(base + "/")) {
      res.writeHead(404).end();
      return;
    }
    let file = resolve(root, "." + (path.slice(base.length) || "/"));
    if (file !== root && !file.startsWith(root + "/")) {
      res.writeHead(403).end();
      return;
    }
    if ((await stat(file)).isDirectory()) file += "/index.html";
    const data = await readFile(file);
    res
      .writeHead(200, {
        "Content-Type": types[extname(file)] || "application/octet-stream",
        "Cache-Control": "no-store",
      })
      .end(data);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(4173, "127.0.0.1", () =>
  console.log(
    `Static Pages preview ready on port 4173 with base path ${base || "/"}`,
  ),
);
