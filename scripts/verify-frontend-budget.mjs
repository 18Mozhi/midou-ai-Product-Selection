import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../apps/web/dist/assets/", import.meta.url));
const limits = {
  entryJavaScript: 150 * 1024,
  routeJavaScript: 50 * 1024,
  stylesheet: 120 * 1024,
};
const entries = await readdir(root);
const failures = [];
for (const name of entries) {
  const size = (await stat(join(root, name))).size;
  if (name.endsWith(".css") && size > limits.stylesheet)
    failures.push(`${name}: ${size} > ${limits.stylesheet}`);
  if (!name.endsWith(".js")) continue;
  const limit = name.startsWith("index-")
    ? limits.entryJavaScript
    : limits.routeJavaScript;
  if (size > limit) failures.push(`${name}: ${size} > ${limit}`);
}
if (failures.length) {
  console.error("frontend_bundle_budget_failed");
  for (const failure of failures) console.error(failure);
  process.exit(1);
}
console.log(`frontend_bundle_budget_passed assets=${entries.length}`);
