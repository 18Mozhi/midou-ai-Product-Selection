import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const historicalMarker = "## 历史双槽审计资料（不可执行）";

function assertContract(condition, message) {
  if (!condition) throw new Error(message);
}

function activeSection(document, file) {
  const markerIndex = document.indexOf(historicalMarker);
  assertContract(markerIndex >= 0, `${file} 缺少历史双槽不可执行分界`);
  return document.slice(0, markerIndex);
}

export function validateRuntimeDocumentation({ manifest, deployScript, featureMap, documents }) {
  const nodeProjects =
    manifest.objects?.filter((entry) => entry.kind === "baota-node-project") ?? [];
  const pythonProjects =
    manifest.objects?.filter((entry) => entry.kind === "baota-python-project") ?? [];
  assertContract(nodeProjects.length === 1, "生产清单必须且只能包含一个宝塔 Node 项目");
  assertContract(pythonProjects.length === 1, "生产清单必须且只能包含一个宝塔 Python 项目");

  const node = nodeProjects[0];
  const python = pythonProjects[0];
  assertContract(node.name === "ai选品", "Node 项目名称必须为 ai选品");
  assertContract(
    node.workingDirectory === "/www/wwwroot/ai选品/backend",
    "Node 项目目录与固定拓扑不一致",
  );
  assertContract(node.port === 4101 && node.bind === "127.0.0.1", "Node 项目必须仅监听本机 4101");
  assertContract(
    JSON.stringify(node.managedChildren) === JSON.stringify(["api", "worker"]),
    "统一 Node 后端必须监督 API 与 Worker",
  );
  assertContract(
    node.startCommand ===
      "node --env-file=/www/wwwroot/ai选品/config/product_scout.env --env-file=/www/wwwroot/ai选品/config/release.env apps/backend/dist/server.js",
    "Node 启动命令与固定拓扑不一致",
  );
  assertContract(python.name === "ai选品-python", "Python 项目名称必须为 ai选品-python");
  assertContract(
    python.workingDirectory === "/www/wwwroot/ai选品/python",
    "Python 项目目录与固定拓扑不一致",
  );
  assertContract(
    python.startCommand ===
      "python -m scoutops_crawler --env-file=/www/wwwroot/ai选品/config/product_scout.env",
    "Python 启动命令与固定拓扑不一致",
  );

  for (const token of [
    'PROJECT_ROOT = "/www/wwwroot/ai选品"',
    'NODE_PROJECT = "ai选品"',
    'PYTHON_PROJECT = "ai选品-python"',
    "apps/backend/dist/server.js",
    "python -m scoutops_crawler",
  ])
    assertContract(deployScript.includes(token), `部署脚本与服务清单不一致：${token}`);
  assertContract(
    !/PROJECT_ROOT\s*=\s*["'][^"']*(?:current|releases)/.test(deployScript),
    "部署脚本仍把 current/releases 作为生产根目录",
  );

  const currentReleaseDocs = [
    [
      "docs/architecture/m07-05-release-rollout.md",
      activeSection(documents.releaseArchitecture, "docs/architecture/m07-05-release-rollout.md"),
    ],
    [
      "docs/runbooks/m07-05-release-rollout.md",
      activeSection(documents.releaseRunbook, "docs/runbooks/m07-05-release-rollout.md"),
    ],
    ["docs/runbooks/m07-03-baota-deployment.md", documents.deploymentRunbook],
    ["docs/runbooks/m08-05-crawler-single-host-scheduler.md", documents.schedulerRunbook],
    ["docs/runbooks/m08-06-capacity-boundary.md", documents.capacityRunbook],
  ];
  const retiredInstructions = [
    /product-scout-api-canary/,
    /APP_PORT=4103|RELEASE_CANDIDATE_API_PORT/,
    /run-baota-release-rollout\.mjs\s+--run/,
    /创建[^\n。]*第二[^\n。]*Node/,
    /启动[^\n。]*(?:候选 API|4103)/,
    /重启候选\s*`ai选品`/,
  ];
  for (const [file, document] of currentReleaseDocs) {
    assertContract(
      retiredInstructions.every((pattern) => !pattern.test(document)),
      `${file} 仍包含已停用双槽拓扑的当前操作指令`,
    );
  }

  assertContract(
    documents.readme.includes("/www/wwwroot/ai选品") &&
      ["frontend", "backend", "python"].every((token) => documents.readme.includes(token)),
    "README.md 缺少固定生产根目录或运行子目录",
  );
  assertContract(
    documents.deploymentArchitecture.includes("/www/wwwroot/ai选品") &&
      documents.deploymentArchitecture.includes("frontend/backend/python/config/runtime/backups"),
    "docs/architecture/m07-03-baota-deployment.md 缺少固定生产目录合同",
  );
  for (const [file, document] of [["infra/baota/README.md", documents.baotaReadme]]) {
    for (const token of [
      "/www/wwwroot/ai选品/frontend",
      "/www/wwwroot/ai选品/backend",
      "/www/wwwroot/ai选品/python",
    ]) {
      assertContract(document.includes(token), `${file} 缺少固定生产目录：${token}`);
    }
  }

  const rollout = featureMap.implementation?.releaseRollout;
  assertContract(
    rollout?.executionStatus === "historical_disabled_by_single_node_topology",
    "Feature Map 未将旧双槽执行器标记为停用历史能力",
  );
  assertContract(
    rollout?.currentDeploymentEntrypoint === "../scripts/deploy-baota.py",
    "Feature Map 当前部署入口与固定拓扑不一致",
  );
  assertContract(
    rollout?.currentRuntimeManifest === "../infra/baota/service-manifest.json",
    "Feature Map 缺少当前运行清单引用",
  );
  assertContract(
    rollout?.currentTopology?.nodeProjects === 1 &&
      rollout.currentTopology?.nodeProjectName === "ai选品" &&
      rollout.currentTopology?.nodePort === 4101,
    "Feature Map 当前 Node 拓扑与服务清单不一致",
  );
  assertContract(
    rollout?.currentTopology?.pythonProjects === 1 &&
      rollout.currentTopology?.pythonProjectName === "ai选品-python",
    "Feature Map 当前 Python 拓扑与服务清单不一致",
  );
  assertContract(
    documents.blueprint.includes("python scripts/deploy-baota.py"),
    "产品总纲未声明当前固定目录部署入口",
  );
  assertContract(
    !documents.blueprint.includes(
      "M07-05 发布合同以 `infra/baota/release-rollout-manifest.json` 锁定 4101 稳定 API、4103 同机候选 API",
    ),
    "产品总纲仍把历史双槽描述为当前发布合同",
  );
}

export async function verifyRuntimeDocumentation({ root = process.cwd() } = {}) {
  const read = (path) => readFile(resolve(root, path), "utf8");
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
  validateRuntimeDocumentation({
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
  });
  return { nodeProject: "ai选品", pythonProject: "ai选品-python", nodePort: 4101 };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await verifyRuntimeDocumentation();
  console.log("Runtime documentation consistency gate passed.");
}
