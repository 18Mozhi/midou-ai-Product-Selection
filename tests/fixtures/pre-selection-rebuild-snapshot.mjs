import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Historical test input only. Never feed these bytes to the current app or use
// the old UI review to claim acceptance of the automatic-selection rebuild.
export const preSelectionRebuildRevision = "c26e2b522bc616cbc2a67b01185d832f93789174";
const root = fileURLToPath(new URL("../../", import.meta.url));
let snapshot;

function loadSnapshot() {
  const files = execFileSync(
    "git",
    [
      "ls-tree",
      "-rz",
      "--name-only",
      preSelectionRebuildRevision,
      "--",
      "apps/web/src",
      "tests/e2e",
      "config",
      "design-plans/ui-phase-2-2026-09-07",
    ],
    { cwd: root, maxBuffer: 16 * 1024 * 1024 },
  )
    .toString("utf8")
    .split("\0")
    .filter(
      (file) =>
        (file.startsWith("apps/web/src/") && /\.(vue|ts|css|json|js|mjs)$/.test(file)) ||
        (file.startsWith("tests/e2e/") && file.endsWith(".ts")) ||
        file === "config/route-catalog.json" ||
        /^design-plans\/ui-phase-2-2026-09-07\/(?:[^/]+\.md|(?:baseline|actions|dialogs|source-scope-review|source-scope-revalidation)\.json|page-specs\/P\d+\.md)$/.test(
          file,
        ),
    );
  assert.ok(files.length);
  assert.ok(files.every((file) => !file.includes("\n")));
  const bytes = execFileSync("git", ["cat-file", "--batch"], {
    cwd: root,
    input: files.map((file) => `${preSelectionRebuildRevision}:${file}\n`).join(""),
    maxBuffer: 128 * 1024 * 1024,
  });
  const result = new Map();
  let offset = 0;
  for (const file of files) {
    const end = bytes.indexOf(10, offset);
    assert.ok(end >= offset, "Missing historical blob header");
    const match = /^[a-f0-9]{40,64} blob (\d+)$/.exec(bytes.subarray(offset, end).toString("utf8"));
    assert.ok(match, "Unexpected historical object");
    const size = Number(match[1]);
    offset = end + 1;
    assert.ok(Number.isSafeInteger(size) && size >= 0 && offset + size < bytes.length);
    assert.equal(bytes[offset + size], 10, "Missing historical blob terminator");
    result.set(
      file,
      bytes
        .subarray(offset, offset + size)
        .toString("utf8")
        .replaceAll("\r\n", "\n"),
    );
    offset += size + 1;
  }
  assert.equal(offset, bytes.length, "Trailing historical bytes");
  return result;
}

export function readPreSelectionRebuild(file) {
  const absolute = file instanceof URL ? fileURLToPath(file) : resolve(file);
  const name = relative(root, absolute).replaceAll("\\", "/");
  assert.ok(
    name && !isAbsolute(name) && !name.startsWith("../") && !name.startsWith("/"),
    "Source outside repository",
  );
  snapshot ??= loadSnapshot();
  // New files can remain visible as unreferenced current inventory entries.
  // Existing historical claims must still match their exact old source hashes.
  return snapshot.get(name) ?? readFileSync(absolute, "utf8").replaceAll("\r\n", "\n");
}

export function preSelectionRebuildSourceFiles() {
  snapshot ??= loadSnapshot();
  return [...snapshot.keys()].filter(
    (file) => file.startsWith("apps/web/src/") && /\.(vue|ts)$/.test(file),
  );
}
