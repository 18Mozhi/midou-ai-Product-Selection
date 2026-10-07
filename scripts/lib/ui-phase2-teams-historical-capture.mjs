import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseProviderCaptureBlobs } from "./ui-phase2-provider-historical-capture.mjs";

const revision = "df4b7263b1684e94e4ecc8d46c856c202fd9ee7b";
const base = "design-plans/ui-phase-2-2026-09-07/design";
const manifests = Object.freeze({
  "teams-direction-c": "6e0c46f381fbb064bc6b289dee6e958838708f2435aef1a6b3966f845af6b684",
  "teams-controls-direction-c": "b208df4321f013f4d1f51f4c155b4f5914e5948ececebd2fbf30c4ab4538d239",
  "teams-fields-direction-c": "4f9ce8529347282c71384f223654f7d5349a46b3e0b476b03770cd1ba1a5a547",
});
const dialog = "apps/web/src/components/AuditedReasonDialog.vue";
const currentSourceHashes = Object.freeze({
  [dialog]: "0d144160f6e5209a71ccef1eaa4e8313f734039db7b10a75f789917bc37d7af9",
  "apps/web/src/use-audited-reason.ts":
    "90ecbeee533b314296e49d6a6769f498af3671659135ef8e477a3b4246b15007",
  "tests/e2e/m06-01-organization-admin.spec.ts":
    "8751561100b8dd01b51e86baabb3f7fc562c012e3592bd39fea0bb508af18cef",
  "scripts/lib/ui-phase2-teams-design-data.mjs":
    "a688df5e899deb362efbea2e8633327e6a3ce1559c89bb9db83746033434adbc",
  "apps/web/src/components/OrganizationAdminCenter.vue":
    "08ca45c702c440b88d10157e3695e74fcffcde236833db43e534db72df0598b2",
  "apps/web/src/components/OrganizationTeamPanel.vue":
    "2135e9325188348639af75445aa5b8d4066ed401f9fda3663c096aa915c97eee",
  "design-plans/ui-phase-2-2026-09-07/design/teams-direction-c/teams.css":
    "f2e0a1b9cb007f20390d9b0311a01e8cdb326f98510fd50169d5786718c7298e",
  "design-plans/ui-phase-2-2026-09-07/design/teams-direction-c/teams.js":
    "33f8d88f0035b49792d2b4b1d99ca02d18da25027e10251266b8a3012bc07cb9",
  "scripts/verify-ui-phase2-teams-c.mjs":
    "5019720322f6b8b633051145a4251d6128a83d329bc10e47819505a90fa66252",
  "design-plans/ui-phase-2-2026-09-07/design/teams-controls-direction-c/controls.js":
    "9c83d4555d358c3e895a29cfa9136521aaebd7efb1a81d62aa372cea2d04d866",
  "scripts/verify-ui-phase2-teams-controls-c.mjs":
    "c2aca69e143120f79c7e5508fedcfac0f683672bba76dfbaf6683dae318e562a",
  "scripts/verify-ui-phase2-teams-fields-c.mjs":
    "67044958c03df9293e4c5e5974b1cf895572c1a81edf82f64bea4b3c1a34ca69",
});
const normalize = (value) => value.toString("utf8").replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const cache = new Map();

// Test-only provenance for offline proposals. Never substitute this source in the app.
export function teamsHistoricalCapture(name) {
  assert.ok(Object.hasOwn(manifests, name), "Unknown P33 capture");
  const file = `${base}/${name}/evidence.json`;
  if (!cache.has(name)) {
    const manifest = normalize(
      execFileSync("git", ["show", `${revision}:${file}`], { maxBuffer: 8 * 1024 * 1024 }),
    );
    assert.equal(hash(manifest), manifests[name], "Pinned historical P33 manifest changed");
    const evidence = JSON.parse(manifest);
    const folder = `${base}/${name}`;
    const imagePaths = evidence.screenshots.map((shot) => `${folder}/${shot.file}`);
    const paths = [...Object.keys(evidence.sourceHashes), ...imagePaths];
    assert.ok(paths.length > 0 && paths.every((path) => !/[\r\n]/.test(path)));
    const blobs = parseProviderCaptureBlobs(
      execFileSync("git", ["cat-file", "--batch"], {
        input: paths.map((path) => `${revision}:${path}\n`).join(""),
        maxBuffer: 128 * 1024 * 1024,
      }),
      paths,
    );
    const sources = new Map();
    for (const [path, sha] of Object.entries(evidence.sourceHashes)) {
      const source = normalize(blobs.get(path));
      assert.equal(hash(source), sha, `Original P33 source mismatch: ${path}`);
      sources.set(path, source);
    }
    const images = new Map();
    for (const shot of evidence.screenshots) {
      const file = `${folder}/${shot.file}`;
      const image = Buffer.from(blobs.get(file));
      assert.equal(hash(image), shot.sha256, `Original P33 image mismatch: ${shot.file}`);
      images.set(shot.file, image);
    }
    cache.set(name, { manifest, sources, images });
  }
  const { manifest, sources, images } = cache.get(name);
  return {
    revision,
    manifest,
    source(path) {
      assert.ok(sources.has(path), `Source absent from P33 capture: ${path}`);
      return sources.get(path);
    },
    image(file) {
      assert.ok(images.has(file), `Image absent from P33 capture: ${file}`);
      return Buffer.from(images.get(file));
    },
  };
}

// Current checks remain separate: every source still matches, except the exact opt-in
// maximumLength revision. Its default and caller contract is rendered in a separate test.
export function assertTeamsCurrentSources(name, read = (file) => readFileSync(file)) {
  const evidence = JSON.parse(teamsHistoricalCapture(name).manifest);
  for (const [file, capturedHash] of Object.entries(evidence.sourceHashes)) {
    assert.equal(
      hash(normalize(read(file))),
      currentSourceHashes[file] ?? capturedHash,
      `Unverified current P33 source: ${file}`,
    );
  }
}
