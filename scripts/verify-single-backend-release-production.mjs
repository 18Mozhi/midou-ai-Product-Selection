import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { validateSingleBackendReleaseEvidence } from "./single-backend-release-evidence.mjs";
const manifest = JSON.parse(
  await readFile("infra/baota/single-backend-release-manifest.json", "utf8"),
);
const services = JSON.parse(await readFile("infra/baota/service-manifest.json", "utf8"));
if (
  manifest.module !== "M07-05" ||
  manifest.candidateInstances !== 0 ||
  manifest.topology !== "single_backend_fixed_directories" ||
  manifest.root !== "/www/wwwroot/ai选品" ||
  services.objects.filter((x) => x.kind === "baota-node-project").length !== 1
)
  throw new Error("single_backend_release_manifest_invalid");
if (!process.argv.includes("--production")) {
  console.log(
    JSON.stringify({ module: "M07-05", status: "preflight_passed", productionVerified: false }),
  );
} else {
  const source = await readFile(manifest.evidenceFile);
  const evidence = JSON.parse(source);
  if (evidence.migrationVersion !== manifest.migrationVersion)
    throw new Error("single_backend_release_migration_drift");
  const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  validateSingleBackendReleaseEvidence(evidence, head);
  for (const path of ["version", "ready", "available"]) {
    const response = await fetch(`https://midouai.medouai.com/api/v1/health/${path}`, {
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error("single_backend_release_current_health_failed");
    const body = await response.json(),
      data = body.data ?? body;
    if (
      path === "version"
        ? data.build_sha !== head
        : !["ready", "healthy", "available"].includes(data.status)
    )
      throw new Error("single_backend_release_current_health_failed");
  }
  console.log(
    JSON.stringify({
      module: "M07-05",
      ...validateSingleBackendReleaseEvidence(evidence, head),
      evidenceSha256: createHash("sha256").update(source).digest("hex"),
    }),
  );
}
