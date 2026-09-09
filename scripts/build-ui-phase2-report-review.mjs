import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const base = "design-plans/ui-phase-2-2026-09-07";
export const sourceFile = "apps/web/src/components/ReportCenter.vue";
const parent = "report-direction-c",
  controls = "report-controls-direction-c";
const remaining =
  "仅独立图稿及当前源码核对；完整组合、真实Vue生命周期/服务/下载字节、主题密度、用户批准和生产验收未完成。";
// Hand-reviewed semantics and exact contract aliases. Never infer business actions from labels.
const definitions = [
  [
    "RP-CREATE",
    "导出当前报表 CSV",
    "write",
    ["97351e6d4fd4cc45.1"],
    ["RP-CREATE；CSV入队"],
    "busy禁用按钮；空报表仍可导出",
    "createExport：POST /report-exports，{report_type:type,format:csv}；202只确认入队，不确认文件可用；现函数无busy早退",
    ["opportunity", "trend", "team", "empty", "create_busy", "create_error"],
  ],
  [
    "RP-TYPE",
    "切换报表类型",
    "navigation",
    ["333b03bc402fcd48.1"],
    ["RP-TYPE；三类报表URL"],
    "三种类型；aria-pressed表示当前选择，不是禁用",
    "choose：相同类型早退；不同类型更新report query后监听load；机会默认省略参数，无日期参数",
    ["opportunity", "trend", "team"],
  ],
  [
    "RP-TECH",
    "技术详情",
    "local",
    ["1c008f867673db60.1", "1c008f867673db60.2"],
    ["RP-TECH；请求关联标识", "RP-TECH；导出错误码"],
    "页面notice且requestId，或详情last_error_code",
    "原生details/summary展开，不产生HTTP；页面和详情是两个源位置",
    ["download_error", "technical", "detail_dead"],
  ],
  [
    "RP-LOAD",
    "重新加载",
    "read",
    ["97ed4772fb320d6c.1"],
    ["RP-LOAD；错误重读"],
    "error/expired/forbidden/rate_limited/blocked",
    "load()并发报表与导出GET；序号只保护外层结果，内部诊断和详情回执归属尚未完备",
    ["error", "expired", "forbidden", "rate_limited", "blocked"],
  ],
  [
    "RP-REFRESH",
    "刷新状态",
    "read",
    ["aa7c04ce54cf7cb5.1"],
    ["RP-REFRESH；后台保留显示"],
    "refreshing禁用按钮并显示正在刷新",
    "refresh设置refreshing，load(true)保留报告；finally清除，重入/旧finally保护仍待",
    ["opportunity", "refreshing", "refresh_error"],
  ],
  [
    "RP-TASKS",
    "在任务中心查看",
    "navigation",
    ["48c7e8b38910554f.1"],
    ["RP-TASKS；导出任务视图"],
    "固定站内导航，无禁用状态",
    "RouterLink /tasks?view=exports；不写入业务tasks表",
    ["opportunity"],
  ],
  [
    "RP-DOWNLOAD",
    "下载文件",
    "read",
    ["6008f8ab717efc14.1"],
    ["RP-DOWNLOAD；有效文件GET"],
    "列表succeeded且未到期；仅本行下载按钮禁用，但函数会拦截任一在途下载",
    "download：带请求/追踪ID和Accept的GET原始字节，blob/object URL/filename/click/revoke；非导出创建事务",
    [
      "opportunity",
      "download_busy",
      "download_error",
      "download_409",
      "download_410",
      "download_503",
    ],
  ],
  [
    "RP-REGENERATE",
    "重新生成",
    "write",
    ["2c6e73d043155b49.1", "7ca6d136d071985b.1"],
    ["RP-REGENERATE；列表重建", "RP-REGENERATE；详情重建"],
    "列表和详情按canRegenerate；expired标签/时间到期或dead_letter；同ID按钮禁用，函数无重入保护",
    "regenerate：bodyless POST后load，再replace export为replacement.id；旧记录不覆盖；服务仅时间到期或最终失败允许，状态过期但时间未到仍拒绝",
    [
      "detail_expired",
      "detail_dead",
      "detail_boundary",
      "detail_status_mismatch",
      "regenerate_busy",
      "regenerate_error",
      "regenerated",
    ],
  ],
  [
    "RP-DETAIL",
    "查看详情",
    "read",
    ["9455978516828e94.1"],
    ["RP-DETAIL；export深链"],
    "导出列表每条记录；无busy禁用",
    "openDetail写export query，监听syncDetailFromRoute GET；错误清选中/参数，404特定提示；晚到/跨页保护仍待",
    ["detail_succeeded", "detail_queued", "detail_not_found", "detail_forbidden"],
  ],
  [
    "RP-CLOSE",
    "关闭导出详情",
    "local",
    ["ec6fb3ba685c67a6.1"],
    ["RP-CLOSE；关闭按钮"],
    "详情打开时；按钮与Escape归同一关闭动作",
    "closeDetail清selectedExport及export query，保留report和其他query；不取消已发送事务",
    ["detail_succeeded", "detail_expired"],
  ],
  [
    "D-RP-EXPORT",
    "导出详情模态接线",
    "wiring",
    ["771186d2cb192900.1", "92b76ba5cca9c487.1"],
    ["D-RP-EXPORT；导出生命周期", "RP-CLOSE；Escape"],
    "selectedExport时唯一原生dialog",
    "@cancel=handleDetailCancel，经useModalDialog到closeDetail；定义与事件不计两个窗口或写动作",
    ["detail_succeeded", "detail_queued", "detail_expired"],
  ],
];
export function buildReportReview(source, evidence) {
  const sha = createHash("sha256").update(source.replaceAll("\r\n", "\n")).digest("hex");
  assert.equal(
    evidence.sourceHashes[sourceFile],
    sha,
    "verify current proposal before registering source",
  );
  const ids = (values) => values.map((id) => `${sourceFile}#${id}`);
  const actions = definitions.map(
    ([actionId, label, kind, signatures, sourceContractKeys, condition, handler, scenes]) => {
      const action = {
        actionId,
        label,
        kind,
        sourceCandidateIds: ids(signatures),
        sourceContractKeys,
        contractAliasReason:
          "沿用F03合同完整末列；列表/详情同义动作显式合并，dialog定义与cancel另列接线。",
        condition,
        handler,
        variants: scenes,
        scenes: scenes.map((scene) => ({ package: parent, scene })),
        visualStates: Object.fromEntries(
          ["default", "hover", "focus", "pressed", "disabled", "busy"].map((state) => [
            state,
            kind === "wiring" ? "not-applicable-wiring" : "not-mapped",
          ]),
        ),
        testReferences: [
          "scripts/verify-ui-phase2-report-c.mjs",
          "scripts/verify-ui-phase2-report-controls-c.mjs",
        ].map((file) => ({ file, evidenceType: "offline-proposal-check-not-Vue" })),
        remaining,
      };
      if (kind === "wiring") {
        action.forwardsTo = ["RP-CLOSE"];
        action.forwardBindings = [
          {
            candidateId: ids(["92b76ba5cca9c487.1"])[0],
            event: "@cancel",
            handler: "handleDetailCancel",
            targets: ["RP-CLOSE"],
          },
        ];
        return action;
      }
      const ref = evidence.actionVisualReferences[actionId];
      assert.ok(ref, actionId);
      action.visualStateReferences = {};
      for (const [state, scene] of Object.entries(ref.states)) {
        action.visualStates[state] = "scene-reference-not-acceptance";
        action.visualStateReferences[state] = { package: controls, scene, selector: ref.selector };
        if (!action.scenes.some((r) => r.package === controls && r.scene === scene))
          action.scenes.push({ package: controls, scene });
      }
      const absent = ["disabled", "busy"].filter(
        (state) => action.visualStates[state] === "not-mapped",
      );
      if (absent.length) {
        assert.ok(["navigation", "local", "read"].includes(kind));
        for (const state of absent)
          action.visualStates[state] =
            kind === "navigation"
              ? "not-applicable-navigation-only"
              : "not-applicable-source-unrepresented";
        if (kind !== "navigation")
          action.sourceStateApplicability = {
            scope: "current-source-presentation-only-not-runtime-or-approval",
            states: absent,
            reason: "上述源button/summary无disabled/aria-busy/loading属性；不补造在途禁用图。",
            handlerBoundary: handler,
            sourceCandidateIds: action.sourceCandidateIds,
            renderedControlIds: action.sourceCandidateIds,
            sourceHashes: { [sourceFile]: sha },
          };
      }
      const variants = Object.entries(evidence.controlVariantReferences).filter(
        ([, v]) => v.actionId === actionId,
      );
      if (variants.length)
        action.additionalControlVariants = variants.map(([key, ref]) => {
          for (const scene of Object.values(ref.states))
            if (!action.scenes.some((r) => r.package === controls && r.scene === scene))
              action.scenes.push({ package: controls, scene });
          return {
            key,
            scope: "additional-control-variant-not-new-action",
            package: controls,
            selector: ref.selector,
            states: ref.states,
          };
        });
      return action;
    },
  );
  const dialogScenes = [
    "detail_succeeded",
    "detail_queued",
    "detail_leased",
    "detail_retry",
    "detail_no_sample",
    "detail_expired",
    "detail_dead",
    "detail_unknown",
    "detail_zero",
    "detail_boundary",
    "detail_status_mismatch",
    "regenerate_busy",
    "regenerate_error",
    "regenerated",
    "technical",
  ];
  return {
    schemaVersion: 1,
    pageId: "P28",
    route: "/reports",
    status: "source-reviewed-not-runtime-accepted",
    contract: `${base}/automation-report-contract-review.md`,
    sourceHashes: { [sourceFile]: sha },
    dialogs: {
      kind: "local-callers-and-listed-shared-only",
      remaining: "1原生dialog；无form或自定义日期输入；17关联状态不是17个窗口。",
    },
    inputs: { "ReportCenter.vue": [] },
    actions,
    surfaceReview: {
      status: "source-reviewed-not-runtime-accepted",
      files: [sourceFile],
      includeStructuralContainers: true,
      dependencyHashes: { [sourceFile]: sha },
      inputs: [],
      containers: [
        {
          file: sourceFile,
          tag: "dialog",
          ordinal: 1,
          shape: "native-dialog",
          sourceBehavior: "selectedExport唯一生命周期窗；再生成/技术区条件显示，没有详情下载按钮。",
          remaining,
          variants: [
            ...dialogScenes.map((name) => ({
              name,
              evidenceScope: "matching-dialog-scene",
              scenes: [{ package: parent, scene: name }],
              remaining,
            })),
            ...["detail_not_found", "detail_forbidden"].map((name) => ({
              name,
              evidenceScope: "route-excluded-reference",
              exclusionReason:
                "源读取错误清selectedExport与export query，以页面notice反馈，没有记录窗。",
              scenes: [{ package: parent, scene: name }],
              remaining,
            })),
          ],
        },
      ],
      sharedRemaining: [
        "useModalDialog仅此调用方接线核对，不是全部焦点/跨缓存生命周期验收。",
        "RP-G01–G04和F03-G05仍待；全部输入为空不代表统计口径、文件或权限已获准。",
      ],
    },
    compositionGaps: [
      "当前全新图与真实Vue未整合；业务接口、SQL口径及既有回执缺口未改。",
      "208图覆盖10代表控件和14明确变体，不是全部导出记录/状态/主题/密度/角色/缩放组合。",
    ],
    approval: "pending-user-review",
    limits: [
      "只有C总体方向已选择，P28未获得整页或按钮批准。",
      "实际下载字节、Worker/数据库与宝塔部署另验，不将原型请求意图当成功。",
    ],
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.ok(process.argv.slice(2).every((arg) => ["--write", "--check"].includes(arg)));
  const value = buildReportReview(
    readFileSync(sourceFile, "utf8"),
    JSON.parse(readFileSync(`${base}/design/${controls}/evidence.json`, "utf8")),
  );
  const target = `${base}/action-reviews/P28.json`;
  if (process.argv.includes("--write"))
    writeFileSync(target, JSON.stringify(value, null, 2) + "\n");
  else assert.deepEqual(JSON.parse(readFileSync(target, "utf8")), value);
  console.log(
    JSON.stringify({
      pageId: value.pageId,
      semanticGroups: value.actions.length,
      approval: value.approval,
    }),
  );
}
