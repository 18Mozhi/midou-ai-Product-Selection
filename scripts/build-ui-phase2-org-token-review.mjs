import assert from "node:assert/strict";
import {
  assertCaptureSourceRevision,
  historicalTokenCopySource,
} from "./lib/ui-phase2-token-copy-baseline.mjs";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";
import ts from "typescript";
import { scanSource } from "./lib/ui-phase2-inventory.mjs";

export const base = "design-plans/ui-phase-2-2026-09-07";
export const parentFile = "apps/web/src/components/OrganizationAdminCenter.vue";
export const childFile = "apps/web/src/components/OrganizationTokenPanel.vue";
export const reasonFile = "apps/web/src/components/AuditedReasonDialog.vue";
export const dependencies = [parentFile, childFile];
const pkg = "org-token-direction-c",
  text = (f) => readFileSync(f, "utf8").replaceAll("\r\n", "\n"),
  hash = (s) => createHash("sha256").update(s).digest("hex");
const C = (...ids) => ids.map((id) => `${parentFile}#${id}`),
  K = (...ids) => ids.map((id) => `${childFile}#${id}`),
  R = (...ids) => ids.map((id) => `${reasonFile}#${id}`);
const remaining = "源码/独立图关联，不是完整C、父级生命周期、真实权限/API或生产验收。";
const scene = (name) => ({ package: pkg, scene: name });
const definitions = [
  [
    "OG-REFRESH",
    "刷新令牌数据",
    "read",
    C("b11692c0597885e3.1"),
    ["OG-REFRESH"],
    "loading或refreshing禁用",
    "load({background:true})读取summary和tokens；真实GET会处理到期状态，不是数据库纯读",
    "normal",
  ],
  [
    "OG-RETRY",
    "重新读取",
    "read",
    C("97ed4772fb320d6c.1"),
    ["OG-RETRY"],
    "父error/blocked/expired/forbidden/rate_limited/conflict分支",
    "load()重读，保留原重试策略；不套用P34专有白区",
    "error",
  ],
  [
    "EX-P34-RETRY",
    "审批专有转发排除",
    "excluded",
    C("5ae31bc55551b1dc.1", "08a59be6f793cde6.1"),
    ["OG-RETRY"],
    "仅approvals首次500/429",
    "P36不挂载这两个专有失败组件",
    "normal",
  ],
  [
    "EX-P29-PROFILE",
    "资料表单排除",
    "excluded",
    C("d6b520278ab3dd57.1", "1cbd108c64b5230c.1", "5878e30377f290ae.1"),
    ["OG-PROFILE-SAVE", "OG-PROFILE-LOGO浏览器有效性"],
    "仅summary",
    "保存资料/Logo检查不属本页",
    "normal",
  ],
  [
    "EX-P30-MEMBERS",
    "成员转发排除",
    "excluded",
    C("6a563eeaa67fea90.1"),
    ["P30全部成员事件父转发，复用M语义"],
    "仅members",
    "不计成员邀请、角色或成员变更",
    "normal",
  ],
  [
    "EX-P31-ROLES",
    "资源授权转发排除",
    "excluded",
    C("b09d7923228aabe6.1"),
    ["P31资源授权父转发，复用已有合同"],
    "仅roles",
    "不计资源授权创建/延期/撤销",
    "normal",
  ],
  [
    "EX-GENERIC-REASON",
    "他页原因入口排除",
    "excluded",
    C("ab6191688d424055.1"),
    ["D-OG-REASON通用成员/邀请/工作区/团队及P31调用"],
    "非tokenAction路径",
    "令牌调用独立ask入口，不复用通用初始原因action值",
    "normal",
  ],
  [
    "W-K-REASON",
    "原因窗父转发",
    "wiring",
    C("773c2105d1d0d008.1", "35233f910d34fac6.1"),
    ["D-OG-REASON提交/取消父转发", "D-OG-REASON组件调用"],
    "共享窗口挂载",
    "submit/cancel解析等待的原因请求，取消不发令牌POST",
    "reason_rotate",
  ],
  [
    "W-K-ASK",
    "轮换/撤销原因调用",
    "wiring",
    C("e828f4ab0fdb0415.1"),
    ["D-OG-REASON令牌轮换/撤销调用"],
    "tokenAction调用",
    "initialValue空，未覆写minimumLength；分别标题/描述后复用原POST",
    "reason_revoke",
  ],
  [
    "OG-K-COPY",
    "复制明文",
    "local",
    K("6d8d1a59210a6ea0.1"),
    ["OG-K-COPY"],
    "secret非空",
    "copySecret调用浏览器剪贴板；旧Promise反馈归属问题OG-G05仍待，不从提案推断已修复",
    "copy_success",
  ],
  [
    "OG-K-DISMISS",
    "关闭本次明文",
    "local",
    K("b3a4e8d62ca470a9.1"),
    ["OG-K-DISMISS"],
    "secret非空",
    "dismissSecret→dismissTokenSecret增加generation并清secret，不是服务器撤销",
    "secret_dismissed",
  ],
  [
    "OG-K-CREATE",
    "创建组织令牌",
    "write",
    K("ed5969fa99d64044.1", "073eb5c8ded40aa0.1"),
    ["OG-K-CREATE"],
    "原生required/范围及scope自校验；submit由busy禁用",
    "submitCreate调用createToken精确name/scopes/ttl_days/reason；失败留草稿，成功重置90和空scope",
    "create_draft",
  ],
  [
    "OG-K-SCOPE",
    "选择读取范围",
    "local",
    K("ab0838b07b48fd2a.1"),
    ["OG-K-SCOPE四种"],
    "四固定复选框，等待时仍可编辑",
    "toggleScope只编辑草稿scope数组，不直接发授权请求",
    "create_all_scopes",
  ],
  [
    "OG-K-TTL",
    "有效期快捷选择",
    "local",
    K("ee181e5ac85b01ec.1"),
    ["OG-K-TTL四快捷"],
    "30/90/180/365与aria-pressed",
    "只赋createForm.ttl_days，等待仍可编辑",
    "create",
  ],
  [
    "OG-K-FILTER",
    "重置筛选",
    "local",
    K("66725db5db9a8fe8.1"),
    ["OG-K-FILTER重置"],
    "本地四条件，等待可用",
    "resetFilters清四条件；条件变化watch才回第一页，默认条件不强制翻页",
    "search",
  ],
  [
    "OG-TECH",
    "技术详情",
    "local",
    K("1c008f867673db60.1"),
    ["OG-TECH"],
    "可见记录的原生details",
    "展示记录ID/版本/时间，不请求、复制或打开业务弹窗",
    "technical",
  ],
  [
    "OG-K-ROTATE",
    "轮换密钥",
    "write",
    K("00a635020f530ba8.1"),
    ["OG-K-ROTATE"],
    "active且非busy",
    "performTokenAction(item,'rotate')→tokenAction；原因确认后POST action/expected_version/reason",
    "reason_rotate",
  ],
  [
    "OG-K-REVOKE",
    "撤销访问",
    "write",
    K("5b6c117ef94cbbb0.1"),
    ["OG-K-REVOKE"],
    "active且非busy",
    "performTokenAction(item,'revoke')→tokenAction；取消返回false，不发POST",
    "reason_revoke",
  ],
  [
    "OG-K-PAGE",
    "前后分页",
    "local",
    K("d27cb4f69e0d30d7.1", "169268616bd2a69a.1"),
    ["OG-K-PAGE"],
    "首尾按钮禁用",
    "本地6条一页，更新原URL，不新增服务端分页",
    "page_two",
  ],
];
const parentInputs = [
  "form.name",
  "form.logo_url",
  "form.timezone",
  "form.data_retention_days",
  "form.default_workspace_id",
  "form.reason",
];
const meanings = {
  tokenQuery: "搜索名称/前缀/中文状态/scope，不搜索ID；本地无maxlength，URL初读200",
  statusFilter: "all/active/expiring/never_used/revoked/rotated/expired；按已返回数据计算",
  scopeFilter: "全部及四固定scope，只筛选已有数据不更改授权",
  tokenSort: "created_desc/expires_asc/last_used_desc/name_asc/status_asc，完整数组先排序再分页",
  "createForm.name": "名称required/max120，提交trim；等待仍可编辑",
  "createForm.ttl_days": "number模型，required/min1/max365；默认90，四快捷只改草稿",
  "createForm.reason": "创建原因required/max500，提交trim；不等于共享原因窗上限",
};
const controlAction = {
  reset: "OG-K-FILTER",
  technical: "OG-TECH",
  page: "OG-K-PAGE",
  create: "OG-K-CREATE",
  ttl: "OG-K-TTL",
  scope: "OG-K-SCOPE",
  copy: "OG-K-COPY",
  dismiss: "OG-K-DISMISS",
};
export const externalPaths = {
  controls: "output/playwright/p36-controls-review/evidence.json",
  fields: "output/playwright/p36-fields-review/evidence.json",
  implementation: "output/playwright/p36-mobile-filters-vue/evidence.json",
};
const sharedFiles = [
  reasonFile,
  "apps/web/src/use-audited-reason.ts",
  "apps/web/src/use-modal-dialog.ts",
];
const serializeReview = (review) => {
  const lines = JSON.stringify(review, null, 2).split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const opener = /^(\s*.*?:\s*)\[$/u.exec(lines[index]);
    if (!opener) continue;
    const prefix = opener[1];
    const indent = /^\s*/u.exec(lines[index])[0];
    const values = [];
    let end = index + 1;
    for (; end < lines.length; end += 1) {
      if (lines[end] === `${indent}]` || lines[end] === `${indent}],`) break;
      if (!lines[end].startsWith(`${indent}  `)) break;
      try {
        const value = JSON.parse(lines[end].trim().replace(/,$/u, ""));
        if (value !== null && typeof value === "object") break;
        values.push(value);
      } catch {
        break;
      }
    }
    if (!values.length || end >= lines.length || !lines[end].trim().startsWith("]")) continue;
    const compact = `[${values.map((value) => JSON.stringify(value)).join(", ")}]`;
    if (compact.length + indent.length > 100) continue;
    lines.splice(
      index,
      end - index + 1,
      `${prefix}${compact}${lines[end].trim().endsWith(",") ? "," : ""}`,
    );
  }
  return `${lines.join("\n")}\n`;
};
export function readOrgTokenReviewInputs() {
  return {
    sources: Object.fromEntries([...dependencies, ...sharedFiles].map((f) => [f, text(f)])),
    packages: new Map([[pkg, JSON.parse(text(`${base}/design/${pkg}/evidence.json`))]]),
    external: Object.fromEntries(
      Object.entries(externalPaths).map(([k, f]) => [k, JSON.parse(text(f))]),
    ),
  };
}
export function buildOrgTokenReview({ sources, external }) {
  const sourceHashes = Object.fromEntries(dependencies.map((f) => [f, hash(sources[f])])),
    candidates = dependencies.flatMap((f) => scanSource(sources[f], f).candidates);
  const actions = structuredClone(definitions).map(
    ([
      actionId,
      label,
      kind,
      sourceCandidateIds,
      sourceContractKeys,
      condition,
      handler,
      sceneName,
    ]) => ({
      actionId,
      label,
      kind,
      sourceCandidateIds,
      sourceContractKeys,
      contractAliasReason: "复用F04完整合同单元格，变体不重复计源动作。",
      condition,
      handler,
      variants: ["source-current"],
      scenes: [scene(sceneName)],
      visualStates: Object.fromEntries(
        ["default", "hover", "focus", "pressed", "disabled", "busy"].map((s) => [
          s,
          kind === "excluded"
            ? "not-applicable-excluded"
            : kind === "wiring"
              ? "not-applicable-wiring"
              : "not-mapped",
        ]),
      ),
      testReferences: [
        {
          file: "scripts/verify-ui-phase2-org-token-controls.mjs",
          evidenceType: "offline-proposal-check-not-Vue",
        },
      ],
      remaining,
    }),
  );
  for (const a of actions.filter((a) => a.kind === "wiring")) {
    a.forwardsTo = ["OG-K-ROTATE", "OG-K-REVOKE"];
    a.forwardBindings = a.sourceCandidateIds.flatMap((id) =>
      Object.entries(candidates.find((c) => c.candidateId === id).events ?? {}).map(
        ([event, handler]) => ({ candidateId: id, event, handler, targets: [...a.forwardsTo] }),
      ),
    );
  }
  const images = (key, predicate) =>
    external[key].screenshots.filter(predicate).map((s) => ({
      file: `${path.posix.dirname(externalPaths[key])}/${s.file}`,
      width: s.width,
      sha256: s.sha256,
    }));
  const binding = (c) => {
    if (c.proposalOnly) return { actionId: null, sourceCandidateIds: [], sharedSourceIds: [] };
    if (c.sharedReason) {
      const suffix = c.id.split("-").at(-1);
      return {
        actionId: c.tokenAction === "rotate" ? "OG-K-ROTATE" : "OG-K-REVOKE",
        sourceCandidateIds: [],
        sharedSourceIds: R(
          ...(suffix === "close"
            ? ["f850a4abcc7ccc3a.1"]
            : suffix === "cancel"
              ? ["8724bc1f65aaf63a.1"]
              : ["e7e63c4215a43738.1"]),
        ),
      };
    }
    const actionId = c.parentReference
      ? c.id === "refresh"
        ? "OG-REFRESH"
        : "OG-RETRY"
      : c.action === "open-reason"
        ? c.tokenAction === "rotate"
          ? "OG-K-ROTATE"
          : "OG-K-REVOKE"
        : controlAction[c.action];
    const a = actions.find((a) => a.actionId === actionId);
    assert.ok(a, `Unmapped control ${c.id}`);
    return {
      actionId,
      sourceCandidateIds:
        c.action === "page"
          ? K(c.id.startsWith("previous") ? "d27cb4f69e0d30d7.1" : "169268616bd2a69a.1")
          : a.sourceCandidateIds,
      sharedSourceIds: [],
    };
  };
  const inputs = [
    ...parentInputs.map((binding) => ({
      file: parentFile,
      binding,
      meaning: "P29资料分支，本页排除",
      remaining,
    })),
    ...Object.entries(meanings).map(([binding, meaning]) => {
      const f = external.fields.fields.find((f) => f.model === binding);
      assert.ok(f);
      return {
        file: childFile,
        binding,
        meaning,
        remaining,
        fieldEvidence: {
          id: f.id,
          selector: `#${f.id}`,
          screenshots: images("fields", (s) => s.fieldId === f.id),
        },
      };
    }),
  ];
  const container = (file, tag, ordinal, shape, sourceBehavior, variants) => ({
    file,
    tag,
    ordinal,
    shape,
    sourceBehavior,
    remaining,
    variants: variants.map(([name, evidenceScope, sceneNames, exclusionReason]) => ({
      name,
      evidenceScope,
      scenes: sceneNames.map(scene),
      remaining,
      ...(exclusionReason ? { exclusionReason } : {}),
    })),
  });
  return structuredClone({
    schemaVersion: 1,
    pageId: "P36",
    route: "/org-admin/tokens",
    status: "source-reviewed-not-runtime-accepted",
    approval: "pending-user-review",
    contract: `${base}/organization-governance-contract-review.md`,
    sourceHashes,
    actions,
    dialogs: {
      kind: "local-callers-and-listed-shared-only",
      remaining:
        "内联创建表单，不是创建弹窗；原共享原因窗用于轮换/撤销两种上下文。共享控件单列，不按两次消费翻倍计全站源。",
    },
    inputs: {
      "OrganizationAdminCenter.vue": parentInputs,
      "OrganizationTokenPanel.vue": Object.keys(meanings),
    },
    propBindings: [
      {
        component: "OrganizationTokenPanel",
        condition: "view === 'tokens'",
        props: {
          tokens: "Array.isArray(data) ? data : []",
          secret: "secret",
          busy: "busy || refreshing",
          "format-time": "fmt",
          "create-token": "createOrganizationToken",
          "perform-token-action": "tokenAction",
          "dismiss-secret": "dismissTokenSecret",
        },
        events: [],
      },
    ],
    functionProps: [
      {
        prop: "createToken",
        parentHandler: "createOrganizationToken",
        actions: ["OG-K-CREATE"],
        effect: "清旧secret后POST /org/admin/tokens，原value和preserveForm:true",
      },
      {
        prop: "performTokenAction",
        parentHandler: "tokenAction",
        actions: ["OG-K-ROTATE", "OG-K-REVOKE"],
        effect:
          "空初始原因，确认后POST /org/admin/tokens/:id/actions含action/expected_version/reason",
      },
      {
        prop: "dismissSecret",
        parentHandler: "dismissTokenSecret",
        actions: ["OG-K-DISMISS"],
        effect: "generation加一并清明文，不请求服务器",
      },
    ],
    externalEvidence: Object.fromEntries(
      Object.entries(externalPaths).map(([k, f]) => [k, { file: f, sha256: hash(text(f)) }]),
    ),
    externalControlBindings: external.controls.controls.map((c) => ({
      id: c.id,
      selector: c.selector,
      widths: c.widths,
      states: c.states,
      proposalOnly: !!c.proposalOnly,
      sharedReason: !!c.sharedReason,
      parentReference: !!c.parentReference,
      ...binding(c),
      screenshots: images("controls", (s) => s.controlId === c.id),
      scope: "独立控件原生图，不是全组适用性/实际Vue或批准",
    })),
    externalControlCompositions: images("controls", (s) => !!s.composition),
    externalFieldCompositions: images("fields", (s) => !!s.composition),
    externalImplementationImages: images("implementation", () => true),
    actualVueMobileFilters: {
      evidence: externalPaths.implementation,
      review: "P36-MOBILE-FILTER-VUE-REVIEW.md",
      scope: "仅已批准手机筛选区的真实子Vue；290检查/10图，不是父级/API/生产验收",
      approval: "仅手机四字段/帮助/底部重置局部批准；其他状态和整页待审",
    },
    nonModelFields: [
      {
        file: childFile,
        binding: "createForm.scopes",
        kind: "checked/change-not-v-model",
        actionId: "OG-K-SCOPE",
        meaning: "固定四种scope，非静默默认；原草稿等待可编辑，独立稿busy锁定只是提案",
        fieldEvidence: {
          id: "field-scopes",
          selector: "#field-scopes",
          screenshots: images("fields", (s) => s.fieldId === "field-scopes"),
        },
      },
    ],
    sharedReasonReview: {
      sourceHashes: Object.fromEntries(sharedFiles.map((f) => [f, hash(sources[f])])),
      scope: "P36消费上下文，不将共享源加入本页唯一按钮分母",
      sourceSites: scanSource(sources[reasonFile], reasonFile).candidates.map((c) => ({
        candidateId: c.candidateId,
        tag: c.tag,
        kind: c.kind,
        events: c.events ?? {},
      })),
      input: {
        file: reasonFile,
        binding: "reason",
        minimum: 2,
        maxlength: null,
        initialValue: "",
        meaning: "当前Vue没有maxlength；原提案500上限未获业务批准",
      },
      contexts: ["rotate", "revoke"].map((action) => ({
        action,
        fieldId: `reason-${action}`,
        selector: "#reason-input",
        screenshots: images("fields", (s) => s.fieldId === `reason-${action}`),
      })),
      remaining:
        "原生窗口开合/焦点/取消来自共享组件和useModalDialog；不是共享组件全调用方生命周期验收。",
    },
    surfaceReview: {
      status: "source-reviewed-not-runtime-accepted",
      files: dependencies,
      includeStructuralContainers: true,
      dependencyHashes: sourceHashes,
      inputs,
      containers: [
        container(parentFile, "form", 1, "form-container", "summary资料表单排除", [
          ["summary-excluded", "route-excluded-reference", ["normal"], "仅summary非tokens"],
        ]),
        container(
          parentFile,
          "AuditedReasonDialog",
          1,
          "native-reason-dialog",
          "tokenAction等待同一共享窗，轮换/撤销空初始值",
          [
            ["rotate", "matching-dialog-scene", ["reason_rotate"]],
            ["revoke", "matching-dialog-scene", ["reason_revoke"]],
          ],
        ),
        container(childFile, "aside", 1, "inline-aside", "顶部固定只读scope和明文边界说明", [
          ["security", "related-scene-only", ["normal"]],
        ]),
        container(childFile, "aside", 2, "inline-aside", "组织权限说明，非弹窗/关闭通知", [
          ["truth", "related-scene-only", ["normal"]],
        ]),
        container(
          childFile,
          "form",
          1,
          "form-container",
          "始终行内创建，实际busy只禁submit不锁草稿",
          [
            ["draft", "matching-inline-form-scene", ["create_draft"]],
            ["busy-proposal-differs", "proposal-shape-differs", ["create_busy"]],
            ["failure", "matching-inline-form-scene", ["create_failure"]],
          ],
        ),
        container(
          childFile,
          "aside",
          3,
          "inline-aside",
          "创建预览只解释草稿范围和预计到期，不是真实响应",
          [["preview", "related-scene-only", ["create_draft"]]],
        ),
      ],
      sharedRemaining: [
        "6处caller结构不等于6个业务弹窗；共享原生原因窗仅两种上下文。",
        "共享reason字段和6个源位置单独登记，原提案max500、busy草稿锁与复制归属保护不冒充实际Vue。",
      ],
    },
    approvalRecords: ["P36-MOBILE-FILTER-COMPOSITION-APPROVAL.md"],
    compositionGaps: [
      "本页仅手机四筛选字段/帮助/底部重置获局部批准并有真实子Vue证据；创建及其他控件问题仍待答。",
      "原662PNG与10实图分别关联，独立schema不强充统一六态slot，72个路由动作槽仍not-mapped。",
      "父级完整错误/刷新、URL历史、路由/组织/KeepAlive生命周期、OG-G05、真实MySQL/权限/审计/幂等与全73页部署验收仍待。",
      "既有P35颜色门失败仍未获修复授权；不以本登记通过代替完整测试或自动提交。",
    ],
    limits: [remaining, "本登记不改生产代码/API/env/依赖/权限或数据库，不授予批准。"],
  });
}
export function validateOrgTokenBindings(review, inputs) {
  const expected = buildOrgTokenReview(inputs);
  assert.deepEqual(review, expected, "P36 registry drift");
  const nodes = [];
  function walk(n) {
    if (n.type === 1 && n.tag === "OrganizationTokenPanel") nodes.push(n);
    for (const c of n.children ?? []) walk(c);
  }
  walk(baseParse(parse(inputs.sources[parentFile]).descriptor.template.content));
  assert.equal(nodes.length, 1);
  const node = nodes[0],
    prop = review.propBindings[0];
  assert.equal(
    node.props.find((p) => p.type === 7 && p.name === "else-if").exp.content,
    prop.condition,
  );
  assert.deepEqual(
    Object.fromEntries(
      node.props
        .filter((p) => p.type === 7 && p.name === "bind")
        .map((p) => [p.arg.content, p.exp.content]),
    ),
    prop.props,
  );
  assert.deepEqual(
    node.props.filter((p) => p.type === 7 && p.name === "on"),
    prop.events,
  );
  const ast = ts.createSourceFile(
    "parent.ts",
    parse(inputs.sources[parentFile]).descriptor.scriptSetup.content,
    ts.ScriptTarget.Latest,
    true,
  );
  const fn = (name) => {
    const matches = ast.statements.filter(
      (n) => ts.isFunctionDeclaration(n) && n.name?.text === name,
    );
    assert.equal(matches.length, 1, `parent handler ${name}`);
    return matches[0].getText(ast).replace(/\s+/g, " ");
  };
  assert.match(
    fn("createOrganizationToken"),
    /secret\.value = ""; return Boolean\(await submit\("\/org\/admin\/tokens", value, "POST", \{ preserveForm: true \}\)\);/,
  );
  assert.match(fn("tokenAction"), /initialValue: "",/);
  assert.match(fn("tokenAction"), /if \(!reason\) return false;/);
  assert.match(
    fn("tokenAction"),
    /submit\( `\/org\/admin\/tokens\/\$\{item.id\}\/actions`, \{ action, expected_version: item.version, reason, \}, "POST", \{ preserveForm: true \}, \)/,
  );
  assert.match(fn("dismissTokenSecret"), /tokenSecretGeneration \+= 1; secret\.value = "";/);
  assert.match(inputs.sources[childFile], /props\.createToken\(\{/);
  assert.match(inputs.sources[childFile], /@click="performTokenAction\(item, 'rotate'\)"/);
  assert.match(inputs.sources[childFile], /@click="performTokenAction\(item, 'revoke'\)"/);
  assert.match(inputs.sources[childFile], /@click="dismissSecret"/);
  for (const [key, e] of Object.entries(inputs.external)) {
    for (const [f, sha] of Object.entries(e.sourceHashes))
      // External captures remain historical; action mapping above uses actual current sources.
      assertCaptureSourceRevision(f, text(f), sha);
    for (const s of e.screenshots)
      assert.equal(
        hash(readFileSync(`${path.posix.dirname(externalPaths[key])}/${s.file}`)),
        s.sha256,
        s.file,
      );
  }
  const controls = review.externalControlBindings;
  assert.equal(controls.length, 44);
  for (const c of controls) {
    assert.equal(c.screenshots.length, c.states.length * c.widths.length);
    if (c.proposalOnly) {
      assert.equal(c.actionId, null);
      assert.equal(c.sourceCandidateIds.length, 0);
      continue;
    }
    assert.ok(
      review.actions.some(
        (a) => a.actionId === c.actionId && !["excluded", "wiring"].includes(a.kind),
      ),
    );
    if (c.sharedReason)
      assert.ok(
        c.sharedSourceIds.every((id) =>
          review.sharedReasonReview.sourceSites.some((s) => s.candidateId === id),
        ),
      );
    else
      assert.ok(
        c.sourceCandidateIds.every((id) =>
          review.actions.find((a) => a.actionId === c.actionId).sourceCandidateIds.includes(id),
        ),
      );
  }
  assert.deepEqual(
    [...new Set(controls.flatMap((c) => c.sourceCandidateIds))].sort(),
    review.actions
      .filter((a) => !["excluded", "wiring"].includes(a.kind))
      .flatMap((a) => a.sourceCandidateIds)
      .sort(),
  );
  const p36ReasonCall = inputs.sources[parentFile]
    .match(/<AuditedReasonDialog\b[\s\S]*?\/>/gu)
    ?.find((tag) => tag.includes("auditedReasonOpen"));
  assert.ok(p36ReasonCall, "P36 shared reason dialog caller remains present");
  assert.doesNotMatch(p36ReasonCall, /maximum(?:-|_)?length|maximumLength/u);
  return {
    sourceSites: review.actions.flatMap((a) => a.sourceCandidateIds).length,
    semanticGroups: review.actions.length,
    routeActions: review.actions.filter((a) => !["excluded", "wiring"].includes(a.kind)).length,
    writeKinds: review.actions.filter((a) => a.kind === "write").length,
    functionProps: review.functionProps.length,
    childControlVariants: controls.filter(
      (c) => !c.sharedReason && !c.parentReference && !c.proposalOnly,
    ).length,
    parentControlVariants: controls.filter((c) => c.parentReference).length,
    sharedReasonControlVariants: controls.filter((c) => c.sharedReason).length,
    proposals: controls.filter((c) => c.proposalOnly).length,
    localFields: review.surfaceReview.inputs.filter((f) => f.file === childFile).length,
    nonModelGroups: review.nonModelFields.length,
    sharedReasonContexts: review.sharedReasonReview.contexts.length,
    callerContainers: review.surfaceReview.containers.length,
    controlImages: inputs.external.controls.screenshots.length,
    fieldImages: inputs.external.fields.screenshots.length,
    implementationImages: review.externalImplementationImages.length,
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.ok(process.argv.slice(2).every((a) => ["--check", "--write"].includes(a)));
  const inputs = readOrgTokenReviewInputs(),
    review = buildOrgTokenReview(inputs),
    result = validateOrgTokenBindings(review, inputs),
    target = `${base}/action-reviews/P36.json`;
  const gallery = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P36 手机筛选真实Vue证据</title>
<style>body{font:16px/1.6 "Microsoft YaHei",sans-serif;background:#edf1f6;color:#202c3d;margin:24px}article{background:white;padding:20px;margin:24px 0}img{max-width:100%}</style>
<h1>P36 手机筛选 · 实际子Vue</h1><p>10张测试样例实图；仅手机筛选区域局部获批，其他状态与整页仍待审。不是父级/API/权限或生产证明。</p>
${inputs.external.implementation.screenshots.map((s) => `<article><h2>${s.scene} · ${s.width}px</h2><img src="${s.file}" alt="${s.scene} ${s.width}px" loading="lazy"></article>`).join("\n")}
</html>\n`;
  const galleryPath = `${path.posix.dirname(externalPaths.implementation)}/index.html`;
  if (process.argv.includes("--write")) {
    writeFileSync(target, serializeReview(review));
    writeFileSync(galleryPath, gallery);
  } else {
    assert.equal(text(target), serializeReview(review));
    assert.equal(text(galleryPath), gallery);
  }
  console.log(JSON.stringify({ pageId: "P36", ...result, approval: review.approval }));
}
