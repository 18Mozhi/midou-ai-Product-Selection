import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { loadConfigFromFile } from "vite";

const root = fileURLToPath(new URL("../../", import.meta.url));
const appPath = fileURLToPath(new URL("../../apps/web/src/App.vue", import.meta.url));
const configPath = fileURLToPath(new URL("../../apps/web/vite.config.ts", import.meta.url));
const names = [
  "VerificationFramework",
  "UiStateShowcase",
  "ConfigBoundary",
  "RedisFoundation",
  "MySqlFoundation",
  "ApiFoundation",
  "FileAuditFoundation",
  "DeploymentFoundation",
];
async function plugin(command = "build", mode = "production") {
  const loaded = await loadConfigFromFile({ command, mode }, configPath, root, "silent");
  return loaded.config.plugins.find(
    (item) => item && item.name === "scoutops-strip-internal-surfaces",
  );
}

test("production strips development imports while preserving real account and administration surfaces", async () => {
  const gate = await plugin();
  const source = await readFile(appPath, "utf8");
  const result = gate.transform(source, appPath);
  for (const name of names) {
    assert.ok(result.includes(`const ${name} = null;`));
    assert.ok(!result.includes(`./components/${name}.vue`));
  }
  for (const name of [
    "ThemeStudio",
    "NavigationShell",
    "LocalIdentity",
    "AuditSecurityCenter",
    "AccountShell",
  ])
    assert.ok(result.includes(`./components/${name}.vue`));
  assert.equal(
    result.slice(result.indexOf("<template>")),
    source.slice(source.indexOf("<template>")),
  );
  assert.equal(gate.transform(source, appPath.replace("App.vue", "Other.vue")), null);
});

test("production rejects missing development guards rather than shipping internal imports", async () => {
  const gate = await plugin();
  const source = await readFile(appPath, "utf8");
  for (const name of names) {
    const unguarded = source.replace(`const ${name} = import.meta.env.DEV`, `const ${name} = true`);
    assert.throws(
      () => gate.transform(unguarded, appPath),
      /internal_surface_production_strip_contract_missing/,
    );
  }
});

test("bundle validation rejects all internal chunks without deleting them and retains real operations", async () => {
  const gate = await plugin();
  for (const name of names) {
    const bundle = {
      "internal.js": { type: "chunk", facadeModuleId: `C:\\project\\src\\components\\${name}.vue` },
    };
    assert.throws(
      () => gate.generateBundle({}, bundle),
      /internal_surface_production_chunk_remaining/,
    );
    assert.ok(bundle["internal.js"]);
  }
  assert.doesNotThrow(() =>
    gate.generateBundle(
      {},
      {
        "admin.js": {
          type: "chunk",
          facadeModuleId: "/project/src/components/NavigationShell.vue",
        },
        "theme.js": { type: "chunk", facadeModuleId: "/project/src/components/ThemeStudio.vue" },
        "style.css": { type: "asset" },
      },
    ),
  );
});

test("development keeps internal diagnostic surfaces available", async () => {
  assert.equal(await plugin("serve", "development"), undefined);
  assert.equal(await plugin("build", "development"), undefined);
});
