import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  validateRuntimeDocumentation,
  verifyRuntimeDocumentation,
} from "../../scripts/verify-runtime-doc-consistency.mjs";

const root = process.cwd();
const read = (path) => readFile(resolve(root, path), "utf8");

async function fixture() {
  const [
    manifest,
    deployScript,
    featureMap,
    readme,
    baotaReadme,
    blueprint,
    releaseArchitecture,
    releaseRunbook,
    deploymentArchitecture,
    deploymentRunbook,
    schedulerRunbook,
    capacityRunbook,
  ] = await Promise.all([
    read("infra/baota/service-manifest.json").then(JSON.parse),
    read("scripts/deploy-baota.py"),
    read("docs/feature-map.json").then(JSON.parse),
    read("README.md"),
    read("infra/baota/README.md"),
    read("new-product-enterprise-blueprint.md"),
    read("docs/architecture/m07-05-release-rollout.md"),
    read("docs/runbooks/m07-05-release-rollout.md"),
    read("docs/architecture/m07-03-baota-deployment.md"),
    read("docs/runbooks/m07-03-baota-deployment.md"),
    read("docs/runbooks/m08-05-crawler-single-host-scheduler.md"),
    read("docs/runbooks/m08-06-capacity-boundary.md"),
  ]);
  return {
    manifest,
    deployScript,
    featureMap,
    documents: {
      readme,
      baotaReadme,
      blueprint,
      releaseArchitecture,
      releaseRunbook,
      deploymentArchitecture,
      deploymentRunbook,
      schedulerRunbook,
      capacityRunbook,
    },
  };
}

test("runtime documentation matches the fixed single-Node BaoTa manifest", async () => {
  assert.deepEqual(await verifyRuntimeDocumentation({ root }), {
    nodeProject: "ai选品",
    pythonProject: "ai选品-python",
    nodePort: 4101,
  });
});

test("runtime documentation rejects an active instruction that recreates the retired candidate backend", async () => {
  const input = await fixture();
  input.documents.releaseRunbook = input.documents.releaseRunbook.replace(
    "当前操作步骤如下：",
    "当前操作步骤如下：\n\n在宝塔创建 product-scout-api-canary 并设置 APP_PORT=4103。",
  );
  assert.throws(() => validateRuntimeDocumentation(input), /已停用双槽拓扑的当前操作指令/);
});

test("runtime documentation rejects a second Node project in the production manifest", async () => {
  const input = await fixture();
  input.manifest = {
    ...input.manifest,
    objects: [
      ...input.manifest.objects,
      {
        ...input.manifest.objects.find((entry) => entry.kind === "baota-node-project"),
        name: "unexpected-node",
      },
    ],
  };
  assert.throws(() => validateRuntimeDocumentation(input), /只能包含一个宝塔 Node 项目/);
});
