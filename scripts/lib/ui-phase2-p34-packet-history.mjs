import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseProviderCaptureBlobs } from "./ui-phase2-provider-historical-capture.mjs";

const refreshed = new Map([
  [
    "output/playwright/p34-parent-read-states/evidence.json",
    {
      revision: "3acb8da5a58f7f5926fb55fc89bca1047378e173",
      currentHash: "28809f6617ecec7f77268deaf863e96b3adba228d262adfa9c1d1f79f83f4265",
    },
  ],
  [
    "design-plans/ui-phase-2-2026-09-07/design/org-approvals-parent-direction-c/evidence.json",
    {
      revision: "9468ded7bd05900eb22a9726893e5a8bb89d2d15",
      currentHash: "c64e205f4ed8826d114bfe586c796948af425a0fc6835e1c3067666ec89d4bcf",
    },
  ],
]);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

// Verify both generations independently. Never rewrite an old capture manifest
// or substitute historical sources into the current application or renderer.
export function assertP34HistoricalPacket(file, expected) {
  const refresh = refreshed.get(file);
  const current = readFileSync(file);
  const original = refresh
    ? execFileSync("git", ["show", `${refresh.revision}:${file}`], { maxBuffer: 8 * 1024 * 1024 })
    : current;
  assert.equal(hash(original), expected, file);
  if (refresh) {
    assert.equal(hash(current), refresh.currentHash, `Refreshed packet changed: ${file}`);
    for (const image of JSON.parse(current).screenshots)
      assert.equal(
        hash(readFileSync(file.replace(/evidence\.json$/u, image.file))),
        image.sha256,
        image.file,
      );
  }
  const images = JSON.parse(original).screenshots;
  const paths = images.map((image) => file.replace(/evidence\.json$/u, image.file));
  const archived = refresh
    ? parseProviderCaptureBlobs(
        execFileSync("git", ["cat-file", "--batch"], {
          input: paths.map((path) => `${refresh.revision}:${path}\n`).join(""),
          maxBuffer: 128 * 1024 * 1024,
        }),
        paths,
      )
    : null;
  for (const [index, image] of images.entries())
    assert.equal(
      hash(archived ? archived.get(paths[index]) : readFileSync(paths[index])),
      image.sha256,
      paths[index],
    );
}
