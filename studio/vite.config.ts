import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

const READABLE_PREFIXES = [
  "content/",
  "Assets/PreFabs/Entity/Enemy/Definitions/enemy_definitions.csv",
  "Assets/PreFabs/Scenes/Inventory/Items/item_data.csv",
  "Assets/PreFabs/Scenes/Inventory/Items/item_localization.csv",
  "Assets/Dialogues/",
];

const WRITABLE_PATHS = new Set([
  "Assets/PreFabs/Entity/Enemy/Definitions/enemy_definitions.csv",
  "Assets/PreFabs/Scenes/Inventory/Items/item_data.csv",
  "Assets/PreFabs/Scenes/Inventory/Items/item_localization.csv",
  "content/registries/flags_registry.json",
]);

function isReadable(rel: string): boolean {
  if (rel.includes("..")) return false;
  return READABLE_PREFIXES.some((p) => rel === p || rel.startsWith(p));
}

function readBody(req: import("http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/** Dev-only: read/write game content files in the monorepo. */
function contentApiPlugin() {
  return {
    name: "content-api",
    configureServer(server: import("vite").ViteDevServer) {
      server.middlewares.use("/api/content/validate", async (req, res) => {
        if (req.method !== "GET" && req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        try {
          const { validateContent } = await import(
            "../tools/content_pipeline/validate_content_lib.mjs"
          );
          const result = validateContent(repoRoot);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(result));
        } catch (e) {
          res.statusCode = 500;
          res.end(
            JSON.stringify({
              ok: false,
              errors: [String(e)],
              warnings: [],
              stats: { flags: 0, entities: 0, refs: 0 },
            })
          );
        }
      });

      server.middlewares.use("/api/content/write", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        try {
          const raw = await readBody(req);
          const body = JSON.parse(raw) as { path?: string; content?: string };
          const rel = body.path ?? "";
          const content = body.content ?? "";
          if (!WRITABLE_PATHS.has(rel)) {
            res.statusCode = 403;
            res.end("Path not writable");
            return;
          }
          const full = path.join(repoRoot, rel.replace(/\//g, path.sep));
          fs.mkdirSync(path.dirname(full), { recursive: true });
          fs.writeFileSync(full, content, "utf8");
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true, path: rel, bytes: content.length }));
        } catch (e) {
          res.statusCode = 500;
          res.end(String(e));
        }
      });

      server.middlewares.use("/api/content", (req, res) => {
        const url = req.url ?? "";
        const rel = decodeURIComponent(url.replace(/^\//, ""));
        if (!isReadable(rel)) {
          res.statusCode = 403;
          res.end("Forbidden");
          return;
        }
        const full = path.join(repoRoot, rel.replace(/\//g, path.sep));
        if (!fs.existsSync(full)) {
          res.statusCode = 404;
          res.end("Not found");
          return;
        }
        const ext = path.extname(full);
        res.setHeader(
          "Content-Type",
          ext === ".json" ? "application/json" : "text/plain; charset=utf-8"
        );
        res.end(fs.readFileSync(full));
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const isDemo = mode === "demo";
  const base = process.env.VITE_BASE ?? "/";

  return {
    base,
    plugins: [vue(), ...(isDemo ? [] : [contentApiPlugin()])],
    server: {
      fs: { allow: [repoRoot] },
    },
    resolve: {
      alias: {
        "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "src"),
      },
    },
  };
});
