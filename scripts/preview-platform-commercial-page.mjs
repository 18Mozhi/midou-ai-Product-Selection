import assert from "node:assert/strict";
import { readFile, mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createHash } from "node:crypto";
import { createServer } from "vite";
import {
  commercialPagePlugin,
  commercialPageSources,
} from "./lib/platform-commercial-page-preview.mjs";
import { includeImportedStyleSources } from "./lib/ui-imported-style-sources.mjs";

// Local review host only: fixed existing test data; no API proxy or mutation support.
const args = process.argv.slice(2);
assert.ok(
  args.length === 0 || (args.length === 1 && args[0] === "--capture-review"),
  "Only --capture-review is accepted",
);
const capture = args.includes("--capture-review");
const output = path.resolve("output/playwright/p58-page-composition-r1");
if (capture) await mkdir(output); // Exclusive: never overwrite a completed review packet.
const fixtureFile = "tests/e2e/m06-06-commercial.spec.ts";
const ast = ts.createSourceFile(
  fixtureFile,
  await readFile(fixtureFile, "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
const dataNode = ast.statements
  .filter(ts.isVariableStatement)
  .flatMap((s) => [...s.declarationList.declarations])
  .filter((d) => d.name.getText(ast) === "data");
assert.equal(dataNode.length, 1);
const navigation = [];
function visit(node) {
  if (
    ts.isObjectLiteralExpression(node) &&
    ["shell", "platform_capabilities", "guard_reason"].every((key) =>
      node.properties.some((p) => p.name?.getText(ast) === key),
    )
  )
    navigation.push(node.getText(ast));
  ts.forEachChild(node, visit);
}
visit(ast);
assert.equal(navigation.length, 1);
const evaluate = (text) =>
  JSON.parse(JSON.stringify(vm.runInNewContext(`(${text})`, {}, { timeout: 1000 })));
const fixture = evaluate(dataNode[0].initializer.getText(ast)),
  nav = evaluate(navigation[0]);
const requests = [];
const envelope = (data) => ({ data, request_id: "m06-06-e2e", trace_id: "m06-06-e2e" });
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  plugins: [
    commercialPagePlugin(),
    {
      name: "commercial-local-read-only-fixtures",
      configureServer(host) {
        host.middlewares.use((req, res, next) => {
          const url = new URL(req.url, "http://127.0.0.1");
          if (!url.pathname.startsWith("/api/")) return next();
          const key = `${req.method} ${url.pathname}`;
          requests.push({ key, search: url.search });
          const send = (status, data) => {
            res.statusCode = status;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(data));
          };
          if (key === "GET /api/v1/auth/session-status")
            return send(200, envelope({ authenticated: true }));
          if (key === "GET /api/v1/me/navigation") return send(200, envelope(nav));
          if (key === "GET /api/v1/me/ui-preferences")
            return send(503, { error: { code: "fixture_theme_unavailable" } });
          if (key === "GET /api/v1/platform/commercial") {
            const data = structuredClone(fixture);
            if (!url.searchParams.get("organization_id"))
              Object.assign(data, {
                organization: null,
                assignment: null,
                adjustments: [],
                usage: {},
                effective_quotas: {},
                scope: { organization_id: null },
                adjustment_pagination: { ...data.adjustment_pagination, total: 0 },
              });
            else if (url.searchParams.get("organization_id") !== "o1")
              return send(400, {
                error: { code: "fixture_scope_not_supported", message: "本地样例仅支持 o1" },
              });
            if (url.searchParams.get("query") === "no-match-review") {
              data.plans = [];
              data.pagination.total = 0;
            }
            return send(200, envelope(data));
          }
          return send(405, { error: { code: "review_write_or_unknown_request_blocked" } });
        });
      },
    },
  ],
  server: { host: "127.0.0.1", port: 5174, strictPort: true, proxy: {}, hmr: false, open: false },
});
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  try {
    if (!capture) return;
    const files = new Set([
      fixtureFile,
      "scripts/preview-platform-commercial-page.mjs",
      "scripts/lib/platform-commercial-page-browser-checks.js",
      "scripts/lib/ui-imported-style-sources.mjs",
      "apps/web/index.html",
      "apps/web/vite.config.ts",
      "package-lock.json",
      ...commercialPageSources,
    ]);
    for (const mod of server.moduleGraph.idToModuleMap.values())
      if (
        mod.file?.replaceAll("\\", "/").includes("/apps/web/src/") &&
        /\.(vue|ts|css|json)$/.test(mod.file)
      )
        files.add(path.relative(process.cwd(), mod.file).replaceAll("\\", "/"));
    await includeImportedStyleSources(files, (file) => readFile(file, "utf8"));
    const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
    const sources = Object.fromEntries(
      await Promise.all([...files].sort().map(async (file) => [file, hash(await readFile(file))])),
    );
    const images = await Promise.all(
      (await readdir(output))
        .filter((file) => file.endsWith(".png"))
        .sort()
        .map(async (file) => ({
          file,
          sha256: hash(await readFile(path.join(output, file))),
          approval: "pending-user-review",
        })),
    );
    await writeFile(
      path.join(output, "manifest.json"),
      JSON.stringify(
        {
          scope:
            "Review-only C shell and P58 two-task template/CSS; original business handlers retained. Local fixture, not production or real permission/write acceptance.",
          fixtureDerivations: [
            "No organization clears organization data",
            "query=no-match-review empties plans but retains global summary",
            "Synthetic authenticated session; preferences unavailable",
            "Original o1/p1/a1 fixture IDs are not valid business UUIDs",
          ],
          sources,
          images,
          requests,
        },
        null,
        2,
      ) + "\n",
    );
  } finally {
    await server.close();
    console.log("p58_review_host_closed");
  }
}
process.on("SIGINT", () => void close());
process.on("SIGTERM", () => void close());
try {
  await server.listen();
  console.log("p58_review=http://127.0.0.1:5174/platform-admin/commercial");
} catch (error) {
  await close();
  throw error;
}
