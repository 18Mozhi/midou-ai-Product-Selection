import assert from "node:assert/strict";
import { createHash } from "node:crypto";

export const emptyMobileDriverHash =
  "7dce540367c137797d69305c5587c26f909683e34799ae2cf15cbb4037c0a07b";
export const currentEmptyMobileInsertion = `// Current-only replay: historical inverses are validated but never rendered.
replace('const capture = process.argv.includes("--capture");', 'const capture = false;');
replace('for (const mode of ["baseline", "review", "current"])', 'for (const mode of ["current"])');
replace('  previous = beforeAdapterEmptyMobile(source),', '  previous = beforeAdapterEmptyMobile(beforeAdapterPaginationFocus(source)),');
replace('  "scripts/verify-provider-adapter-empty-mobile.mjs",', '  "scripts/verify-provider-adapter-empty-mobile.mjs",\\n  "scripts/verify-provider-adapter-empty-mobile-current.mjs",\\n  "scripts/lib/ui-adapter-empty-mobile-current-runner.mjs",\\n  "scripts/lib/ui-phase2-adapter-pagination-focus-baseline.mjs",');
replace('      runs: runs.length,', '      runs: runs.length,\\n      currentOnly: true,\\n      currentSha: hash(source),\\n      outcomes: runs.map(({mode,width,scene,checks,requests}) => ({mode,width,scene,checks:checks.length,requests})),');
runner = 'import { beforeAdapterPaginationFocus } from "./lib/ui-phase2-adapter-pagination-focus-baseline.mjs";\\n' + runner;
`;

export function buildAdapterEmptyMobileCurrentRunner(source) {
  const original = source.replaceAll("\r\n", "\n");
  assert.equal(
    createHash("sha256").update(original).digest("hex"),
    emptyMobileDriverHash,
    "Original mobile driver changed",
  );
  const anchor = "runner = runner.replace(\n  /from";
  assert.equal(original.split(anchor).length, 2);
  return original.replace(anchor, currentEmptyMobileInsertion + anchor);
}

export function resolveEmptyMobileRunnerImports(runner, resolve, baseSource) {
  // Preserve the original wrapper's regex: it is code, not an import target.
  const pattern = String.raw`/from "([^"\n]+)"/g`;
  const marker = "__P47_NESTED_IMPORT_REGEX__";
  assert.equal(runner.split(pattern).length, 2);
  assert.ok(!runner.includes(marker));
  const masked = runner.replace(pattern, marker);
  const imports = {};
  for (const match of (masked + "\n" + baseSource).matchAll(/from "([^"\n]+)"/g)) {
    const resolved = resolve(match[1]);
    imports[match[1]] = resolved;
    imports[resolved] = resolved;
  }
  const prepared = masked
    .replace(
      /from "([^"\n]+)"/g,
      (_full, specifier) => "from " + JSON.stringify(imports[specifier]),
    )
    .replace(marker, pattern);
  assert.equal(prepared.split("import.meta.resolve(specifier)").length, 2);
  // The nested driver's package imports must also resolve from the real entry URL.
  return prepared.replace(
    "import.meta.resolve(specifier)",
    `((key) => { const imports = ${JSON.stringify(imports)}; assert.ok(Object.hasOwn(imports, key), "Unknown nested import"); return imports[key]; })(specifier)`,
  );
}
