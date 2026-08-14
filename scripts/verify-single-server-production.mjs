import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { validateSingleServerEvidence } from "./single-server-evidence.mjs";

const mode = process.argv[2] ?? "--preflight";
const manifest = JSON.parse(await readFile(new URL("../infra/baota/single-server-manifest.json", import.meta.url), "utf8"));
if (manifest.schemaVersion !== 1 || manifest.module !== "M08-01" || manifest.manager !== "baota" || manifest.topology !== "single_host" || manifest.loadBalancingEnabled !== false || manifest.expectedHostCount !== 1) throw new Error("single_server_manifest_invalid");
if (manifest.backupServerUsed !== false || manifest.multiNodeClaim !== false || manifest.capacityClaim !== "unverified") throw new Error("single_server_manifest_claim_invalid");

if (mode === "--preflight") {
  console.log(JSON.stringify({module: "M08-01", status: "preflight_passed", manager: "baota", topology: "single_host", loadBalancingEnabled: false, capacityClaim: "unverified"}));
  process.exit(0);
}
if (mode !== "--production") throw new Error("single_server_verification_mode_invalid");

const evidencePath = process.env.SINGLE_SERVER_PRODUCTION_EVIDENCE_FILE?.trim() || "./.artifacts/verification/m08-01-single-server-production-evidence.json";
let source;
try { source = await readFile(evidencePath); }
catch (error) {
  if (error?.code !== "ENOENT") throw error;
  console.error(JSON.stringify({module: "M08-01", status: "blocked", code: "production_evidence_missing", action_hint: "通过当前惠州单机的宝塔有限任务签发同提交运行证据。"}));
  process.exit(1);
}
const evidence = JSON.parse(source.toString("utf8"));
const head = execFileSync("git", ["rev-parse", "HEAD"], {encoding: "utf8"}).trim();
const result = validateSingleServerEvidence({evidence, manifest, head});
const digest = createHash("sha256").update(source).digest("hex");
console.log(JSON.stringify({module: "M08-01", status: "passed", buildSha: head, topology: "single_host", hostId: result.hostId, activeApiInstances: result.activeApiInstances, loadBalancingEnabled: false, evidenceSha256: digest, capacityClaim: "unverified"}));
