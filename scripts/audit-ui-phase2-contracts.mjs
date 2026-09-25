import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { digest } from "./lib/ui-phase2-inventory.mjs";
import { parseContract, auditContracts, auditPageSpecs } from "./lib/ui-phase2-contract-audit.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const folder = "design-plans/ui-phase-2-2026-09-07";
// Explicit aliases transcribed from these documents, not guessed from matching signatures.
const aliases = {
  "account-home-contract-review.md": {
    T: "ThemeStudio",
    P: "PersonalCenter",
    A: "AccountShell",
    H: "HomeDashboard",
    O: "HomeAutomationOverview",
  },
  "identity-onboarding-contract-review.md": {
    L: "LocalIdentity",
    R: "LandingRedirect",
    T: "TenancyChooser",
    O: "OnboardingGuide",
  },
  "approval-notification-contract-review.md": {
    AW: "ApprovalWorkspace",
    AQ: "ApprovalQueuePanel",
    NC: "NotificationCenter",
  },
  "automation-report-contract-review.md": { AR: "AutomationRuleCenter", RP: "ReportCenter" },
  "collection-runtime-contract-review.md": {
    S: "CollectionRuntimeSurface",
    T: "CollectionTaskCenter",
    O: "CollectionOperationsConsole",
    R: "CollectionRuntimeCenter",
  },
  "organization-governance-contract-review.md": {
    C: "OrganizationAdminCenter",
    M: "OrganizationMemberPanel",
    W: "OrganizationWorkspacePanel",
    T: "OrganizationTeamPanel",
    A: "OrganizationApprovalPanel",
    F: "OrganizationApprovalFirstFailure",
    D: "OrganizationDataPanel",
    K: "OrganizationTokenPanel",
    U: "OrganizationAuditPanel",
  },
  "platform-account-contract-review.md": {
    D: "PlatformDashboard",
    C: "PlatformAccountCenter",
    O: "PlatformOrganizationRecords",
    M: "PlatformAdminRecords",
    W: "OrganizationCreationWizard",
    G: "PlatformOrganizationDetailDialog",
    R: "PlatformRoleComparison",
    A: "PlatformAccountDialogs",
    U: "PlatformUserRecords",
    V: "PlatformUserDetailDialog",
    F: "PlatformUserMembershipForm",
    S: "ResponsiveDataView",
    Q: "ResponsiveFilterDrawer",
    T: "TableViewControls",
    X: "TechnicalDetails",
  },
  "platform-user-design-contract.md": {
    U: "PlatformUserRecords",
    V: "PlatformUserDetailDialog",
    A: "PlatformAccountDialogs",
    F: "PlatformUserMembershipForm",
    M: "PlatformAdminRecords",
    R: "PlatformRoleComparison",
    G: "PlatformAccountGlobalRail",
  },
  "provider-definition-contract-review.md": {
    S: "ProviderRuntimeSurface",
    R: "ProviderRegistry",
    A: "ProviderAdapterCenter",
    D: "ResponsiveDataView",
    T: "TableViewControls",
    U: "UiStatePanel",
  },
  "source-channel-credential-contract-review.md": {
    S: "ProviderSourceCenter",
    D: "ProviderSourceDirectory",
    A: "Alibaba1688AcceptanceCenter",
    E: "ProviderAcceptanceExecution",
    C: "CredentialAssetCenter",
    F: "ProviderSourceConfigurationDialog",
    P: "ProviderParserSampleDialog",
    R: "ProviderParserSampleReview",
    M: "ProviderCompatibilityMatrixDialog",
  },
  "sourcing-cost-contract-review.md": {
    SW: "SourcingWorkspace",
    SD: "SourcingWorkspaceDialogs",
    SP: "SourcingComparisonPanel",
    SC: "SourcingCostConfirmationPanel",
    CR: "CostRuleConsole",
    PP: "OpportunityProfitPanel",
    RQ: "OpportunityCostReviewQueue",
  },
  "task-contract-review.md": {
    W: "TaskWorkspace",
    L: "TaskListPanel",
    D: "TaskDetailPanel",
    B: "TaskBatchActions",
  },
  "scoring-contract-review.md": { S: "ScoreRuleConsole" },
  "trend-contract-review.md": {
    W: "TrendDashboard",
    F: "TrendFilterPanel",
    D: "TrendDetailPanel",
    E: "TrendEvidenceTimeline",
    R: "TrendRuleDialog",
    G: "TrendChangeQueue",
  },
};
const defaults = {
  "competitor-contract-review.md": "CompetitorMonitor",
  "selection-journey-contract-review.md": "SelectionJourney",
};
// Explicit pre-fix snapshots or superseded location tables retained by the source documents.
const history = {
  "identity-onboarding-contract-review.md": {
    historicalSections: ["2.4 P08/P09旧源码身份归档（历史）"],
  },
  "scheduler-capacity-contract-review.md": {
    historicalSections: ["9. 已替代源码身份归档"],
  },
  "platform-user-design-contract.md": {
    historicalSections: ["PA43旧用户详情身份归档"],
  },
  "account-home-contract-review.md": {
    historicalSections: ["2. 51 个局部控件候选（历史源码快照）"],
  },
  "collection-runtime-contract-review.md": {
    historicalSections: [
      "7. 来源指纹",
      "8.1 P52已替代的旧O身份（历史）",
      "9.1 P51详情状态与关闭旧身份归档",
      "9.2 P53已替代的旧R身份（历史）",
    ],
  },
  "content-notification-evidence-contract-review.md": {
    historicalSections: [
      "apps/web/src/components/PlatformMessageWorkbench.vue",
      "6. 引用版本指纹",
      "7.1 PlatformMessageEditor 已替代候选身份（历史）",
      "15. P56/P57旧父组件签名归档（历史）",
      "16. P56/P57早期子组件身份归档（历史）",
    ],
  },
  "task-contract-review.md": {
    historicalSections: ["3. 局部候选→语义动作映射", "7. 01adf4d后的稳定源码映射"],
  },
  "scoring-contract-review.md": { historicalSections: ["2. 25个源码候选的完整局部映射"] },
  "selection-journey-contract-review.md": {
    historicalSections: [
      "2. 控件候选与表单输入",
      "8. 16f524b后的源码清单与证据刷新",
      "9. c31fddc7统一质量门后的当前源码映射",
      "SelectionJourney",
    ],
    historicalColumns: ["N03旧尾键"],
  },
  "state-recovery-contract-review.md": {
    historicalSections: ["1. 入口与源码事实", "2. 源候选到语义动作"],
  },
  "source-channel-credential-contract-review.md": {
    historicalSections: [
      "2. 逐候选对应",
      "7. 来源指纹与交付边界",
      "8. P50 早期当前源码映射（已由第15节替代）",
      "16. P50 凭证台账被替代的旧身份",
    ],
  },
  "platform-account-detail-contract-review.md": {
    historicalSections: ["5. 源码依据（LF SHA-256）"],
  },
  "P39-DIRECTORY-SOURCE-MAPPING.md": {
    historicalSections: ["历史候选（不计入当前覆盖）"],
  },
  "platform-account-contract-review.md": {
    historicalSections: [
      "7. 源码指纹（LF SHA-256）",
      "1.5 P42旧组织详情身份（历史）",
      "1.6 P39账号中心早期身份归档（历史）",
      "1.7 P41组织创建向导早期身份归档（历史）",
      "1.8 共享手机详情与筛选旧身份归档（历史）",
    ],
  },
  "provider-definition-contract-review.md": {
    historicalSections: ["7. 历史源指纹（LF SHA-256）", "PR46/PR47及共享详情旧身份归档"],
    historicalColumns: ["旧签名"],
  },
  "commercial-security-open-platform-contract-review.md": {
    historicalSections: ["6. 来源指纹与证据边界", "OpenPlatformCenter"],
  },
  "log-backup-release-contract-review.md": {
    historicalSections: [
      "BackupRecoveryCenter.vue 旧源码指纹（历史）",
      "6.1 P62 旧版日志中心指纹（2026-09-09）",
      "6.2 P65 旧版发布证据中心指纹（2026-09-09）",
      "11. P62/P64/P65 已替代源码身份",
    ],
  },
  "organization-governance-contract-review.md": {
    historicalSections: [
      "OrganizationApprovalPanel.vue 旧源码指纹（历史）",
      "OrganizationApprovalPanel",
    ],
  },
  "runtime-resilience-contract-review.md": {
    historicalSections: ["6. 历史源码指纹（LF SHA-256）", "P66旧身份归档", "P67旧身份归档"],
  },
};

export function runContractAudit(readOverride) {
  const read = (file) =>
    (readOverride
      ? readOverride(resolve(root, file))
      : readFileSync(resolve(root, file), "utf8")
    ).replaceAll("\r\n", "\n");
  const names = readdirSync(resolve(root, folder))
    .filter(
      (file) =>
        file.endsWith("contract-review.md") ||
        [
          "opportunity-candidate-map.md",
          "platform-user-design-contract.md",
          "P39-DIRECTORY-SOURCE-MAPPING.md",
          "P40-ORGANIZATION-LIST-SOURCE-MAPPING.md",
        ].includes(file),
    )
    .sort();
  const documents = names.map((name) =>
    parseContract(read(`${folder}/${name}`), {
      file: `${folder}/${name}`,
      aliases: aliases[name],
      defaultComponent: defaults[name],
      ...history[name],
    }),
  );
  const scopeFile = `${folder}/source-scope-review.json`,
    scopeText = read(scopeFile),
    scope = JSON.parse(scopeText);
  if (scope.schemaVersion !== 1 || !Array.isArray(scope.records))
    throw new Error("unsupported_source_scope_schema");
  documents.push({
    file: scopeFile,
    hash: digest(scopeText),
    hashes: Object.entries(scope.sources).map(([file, hash]) => ({ file, hash, line: null })),
    references: scope.records.map((record, index) => {
      if (
        typeof record.file !== "string" ||
        typeof record.candidateId !== "string" ||
        !record.candidateId.startsWith(`${record.file}#`) ||
        !/^[0-9a-f]{16}\.\d+$/.test(record.candidateId.slice(record.file.length + 1))
      )
        throw new Error("source_scope_identity_mismatch");
      return {
        document: scopeFile,
        documentLine: null,
        jsonPointer: `/records/${index}`,
        sourceFile: record.file,
        signature: record.candidateId.split("#")[1],
        recordedLine: null,
        recordedKind: null,
        temporalScope: "unclassified",
        claim: record.semanticActionId,
      };
    }),
  });
  const sources = new Map();
  function collect(directory) {
    for (const entry of readdirSync(resolve(root, directory), { withFileTypes: true }).sort(
      (a, b) => a.name.localeCompare(b.name, "en"),
    )) {
      if (entry.isSymbolicLink())
        throw new Error(`unexpected_source_link:${directory}/${entry.name}`);
      const file = `${directory}/${entry.name}`;
      if (entry.isDirectory()) collect(file);
      else if (/\.(vue|ts)$/.test(entry.name)) sources.set(file, read(file));
    }
  }
  collect("apps/web/src");
  const report = auditContracts({ documents, sources });
  const specs = new Map(
    readdirSync(resolve(root, folder, "page-specs"))
      .filter((name) => /^P\d{2}\.md$/.test(name))
      .map((name) => [name.slice(0, 3), read(`${folder}/page-specs/${name}`)]),
  );
  report.pages = auditPageSpecs({
    catalog: JSON.parse(read("config/route-catalog.json")),
    matrix: read(`${folder}/PAGES.md`),
    specs,
    exists: (_id, target) => existsSync(resolve(root, folder, "page-specs", target)),
  });
  const baseline = JSON.parse(read(`${folder}/baseline.json`));
  report.historicalBaseline = {
    sourceRevision: baseline.sourceRevision,
    changedWebFiles: baseline.sources
      .filter(
        (entry) => sources.has(entry.file) && digest(sources.get(entry.file)) !== entry.sha256,
      )
      .map((entry) => entry.file),
  };
  report.limitations = [
    "Only supported Markdown table source references and source-scope JSON records are bound; prose-only mentions and page-spec narratives are not candidate records.",
    "References are document source-site claims, not deduplicated business actions or runtime proof.",
    "Line-only rows remain unbound; identical labels/signatures in other files are never substituted.",
    "All historical and repeated references remain visible; repetition alone is not a conflict.",
    "Explicit historical sections/columns are counted separately and cannot satisfy current source-reference coverage; unclassified does not mean current approval.",
    "A current source-site signature does not prove its handler, API, role, state or modal variant was verified.",
    "Hash checks are LF-normalized; absent prose/inline hash bindings are reported as unrecorded, not current.",
    "Only apps/web/src Vue/TS are rescanned. Supporting backend/config hash claims are not-in-web-scan, not validated.",
    "Unreferenced means no resolved reference in the scanned contracts, not an unused route or safe removal.",
    "Input bindings, dynamic render conditions, explicit role/state expansion and semantic action merging still require review.",
    "No historical inventories, screenshots, approvals, database, network or production resources are changed.",
  ];
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== "--json"))
    throw new Error("Read-only audit accepts only --json; no write or approval mode.");
  const report = runContractAudit();
  console.log(
    JSON.stringify(
      args.length
        ? report
        : {
            status: report.status,
            summary: report.summary,
            pages: report.pages,
            changedBaselineFiles: report.historicalBaseline.changedWebFiles.length,
            limitations: report.limitations,
          },
      null,
      2,
    ),
  );
  if (report.pages.issues.length) process.exitCode = 1;
}
