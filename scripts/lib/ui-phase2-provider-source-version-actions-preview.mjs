import assert from "node:assert/strict";
import { previewProviderSourceVersions } from "./ui-phase2-provider-source-versions-preview.mjs";

const once = (source, anchor, replacement, label) => {
  assert.equal(source.split(anchor).length, 2, label);
  return source.replace(anchor, replacement);
};

export const versionActionCopy = {
  submitting: {
    title: "正在生成新的当前版本",
    description: "恢复请求正在处理；完成前不会再次提交或关闭任务窗。",
  },
  success: {
    title: "已生成新的当前版本",
    description: "目标设置已写成新版本，原有历史保持不变。",
  },
  conflict: {
    title: "当前版本已经变化",
    description: "配置没有修改。请读取最新版本后，再选择需要恢复的版本。",
  },
  forbidden: {
    title: "当前权限还不能恢复配置",
    description: "配置没有修改。权限调整后，可以重新读取历史再操作。",
  },
  failed: {
    title: "尚未确认生成新版本",
    description: "请保留当前原因并核对服务状态，再决定是否重新提交。",
  },
  syncFailed: {
    title: "新版本已生成，配置历史尚未更新",
    description: "本窗仍显示操作前历史，不会把旧内容当作最新结果。",
  },
  readFailed: {
    title: "配置历史暂时未能读取",
    description: "来源目录仍可使用；可以在此重新读取配置历史。",
  },
};

const parentState = `
type VersionActionStage =
  | "idle"
  | "submitting"
  | "reloading"
  | "success"
  | "conflict"
  | "forbidden"
  | "failed"
  | "sync_failed"
  | "read_failed";
const versionActionStage = ref<VersionActionStage>("idle");
const versionActionTitle = ref("");
const versionActionDescription = ref("");
const versionActionRequestId = ref("");
const versionLastTarget = ref<number | null>(null);
const versionWriteConfirmed = ref(false);
let versionOwnership = 0;

function setVersionActionFeedback(
  stage: VersionActionStage,
  title: string,
  description: string,
  technicalRequestId = "",
) {
  versionActionStage.value = stage;
  versionActionTitle.value = title;
  versionActionDescription.value = description;
  versionActionRequestId.value = technicalRequestId;
  message.value = "";
  requestId.value = "";
}

function ownsVersionOperation(token: number, providerId: string) {
  return token === versionOwnership && versionSource.value?.provisioned?.id === providerId;
}

function configurationVersionFailure(error: unknown, mode: "read" | "rollback") {
  const failure = error instanceof ApiClientError ? error : null;
  if (mode === "read") {
    if (failure?.kind === "expired")
      return ["read_failed", "登录状态已失效", "重新登录后，可以再次读取配置历史。"] as const;
    if (failure?.kind === "forbidden")
      return [
        "read_failed",
        "当前权限还不能查看配置历史",
        "权限调整后，可以在此重新读取。",
      ] as const;
    if (failure?.kind === "rate_limited")
      return ["read_failed", "读取请求较多，请稍后再试", failure.actionHint] as const;
    return [
      "read_failed",
      "配置历史暂时未能读取",
      failure?.actionHint ?? "来源目录仍可使用；可以在此重新读取配置历史。",
    ] as const;
  }
  if (failure?.kind === "conflict")
    return [
      "conflict",
      "当前版本已经变化",
      "配置没有修改。请读取最新版本后，再选择需要恢复的版本。",
    ] as const;
  if (failure?.kind === "forbidden")
    return [
      "forbidden",
      "当前权限还不能恢复配置",
      "配置没有修改。权限调整后，可以重新读取历史再操作。",
    ] as const;
  if (failure?.kind === "expired")
    return ["failed", "登录状态已失效", "尚未确认生成新版本。重新登录并核对历史后再操作。"] as const;
  return [
    "failed",
    "尚未确认生成新版本",
    "请保留当前原因并核对服务状态，再决定是否重新提交。",
  ] as const;
}

async function fetchConfigurationVersions(item: SourceItem) {
  try {
    const response = await request<any>(
      \`/platform/provider-sources/\${item.provisioned?.id}/configuration/versions\`,
    );
    const currentVersion = Number(response.data?.current_version);
    if (!Number.isInteger(currentVersion) || currentVersion < 1)
      return {
        ok: false as const,
        title: "配置历史响应不完整",
        description: "当前版本编号无效；本窗不会把这次响应显示为有效历史。",
        requestId: response.request_id,
      };
    return {
      ok: true as const,
      currentVersion,
      versions: (response.data?.versions ?? []) as ConfigurationVersion[],
      requestId: response.request_id,
    };
  } catch (error) {
    const [, title, description] = configurationVersionFailure(error, "read");
    return {
      ok: false as const,
      title,
      description,
      requestId: error instanceof ApiClientError ? error.requestId : "",
    };
  }
}

function applyConfigurationVersions(
  result: { currentVersion: number; versions: ConfigurationVersion[] },
) {
  versionCurrentVersion.value = result.currentVersion;
  versionHistory.value = result.versions;
}

function closeConfigurationVersions() {
  if (rollingBack.value !== null) return;
  versionOwnership += 1;
  versionSource.value = null;
  versionActionStage.value = "idle";
  versionActionRequestId.value = "";
  versionLastTarget.value = null;
  versionWriteConfirmed.value = false;
}

onBeforeUnmount(() => {
  versionOwnership += 1;
});
`;

const versionFunctions = `async function loadConfigurationVersions(item: SourceItem) {
  if (!item.provisioned) return;
  const token = ++versionOwnership,
    providerId = item.provisioned.id;
  versionSource.value = item;
  versionLoading.value = true;
  versionHistory.value = [];
  versionCurrentVersion.value = null;
  rollbackReason.value = "恢复已验证的来源采集设置";
  versionLastTarget.value = null;
  versionWriteConfirmed.value = false;
  setVersionActionFeedback("idle", "", "");
  const result = await fetchConfigurationVersions(item);
  if (!ownsVersionOperation(token, providerId)) return;
  versionLoading.value = false;
  if (result.ok) {
    applyConfigurationVersions(result);
    return;
  }
  setVersionActionFeedback(
    "read_failed",
    result.title,
    result.description,
    result.requestId,
  );
}

async function reloadVersionSurfaces(
  token: number,
  sourceSnapshot: SourceItem,
  successTitle: string,
  successDescription: string,
) {
  const providerId = sourceSnapshot.provisioned?.id;
  if (!providerId) return false;
  const catalogLoaded = await load();
  if (!ownsVersionOperation(token, providerId)) return false;
  const catalogFailure = message.value,
    catalogRequestId = requestId.value;
  message.value = "";
  requestId.value = "";
  if (!catalogLoaded) {
    setVersionActionFeedback(
      "sync_failed",
      versionWriteConfirmed.value
        ? "新版本已生成，来源目录尚未更新"
        : "最新来源目录暂时未能读取",
      versionWriteConfirmed.value
        ? "本窗仍显示操作前历史，不会把旧内容当作最新结果。"
        : catalogFailure || "当前页面不会把旧内容当作最新配置。",
      catalogRequestId,
    );
    return false;
  }
  const refreshed = items.value.find((item) => item.code === sourceSnapshot.code);
  if (!refreshed?.provisioned) {
    setVersionActionFeedback(
      "sync_failed",
      versionWriteConfirmed.value ? "新版本已生成，来源目录尚未找到该来源" : "当前目录未找到该来源",
      "本窗保留已知历史，但不会把它标记为最新结果。",
    );
    return false;
  }
  versionSource.value = refreshed;
  const result = await fetchConfigurationVersions(refreshed);
  if (!ownsVersionOperation(token, providerId)) return false;
  if (!result.ok) {
    setVersionActionFeedback(
      "sync_failed",
      versionWriteConfirmed.value
        ? "新版本已生成，配置历史尚未更新"
        : "最新配置历史暂时未能读取",
      versionWriteConfirmed.value
        ? "本窗仍显示操作前历史，不会把旧内容当作最新结果。"
        : result.description,
      result.requestId,
    );
    return false;
  }
  applyConfigurationVersions(result);
  setVersionActionFeedback("success", successTitle, successDescription, result.requestId);
  return true;
}

async function rollbackConfiguration(version: ConfigurationVersion) {
  const sourceSnapshot = versionSource.value,
    source = sourceSnapshot?.provisioned,
    expectedVersion = versionCurrentVersion.value,
    reason = rollbackReason.value.trim();
  if (!sourceSnapshot || !source || expectedVersion === null || !version.rollback_available) return;
  const token = ++versionOwnership,
    providerId = source.id;
  rollingBack.value = version.version;
  versionLastTarget.value = version.version;
  versionWriteConfirmed.value = false;
  setVersionActionFeedback(
    "submitting",
    "正在生成新的当前版本",
    \`正在把第 \${version.version} 版的安全设置写成新版本；完成前不会再次提交。\`,
  );
  try {
    const response = await request(
      \`/platform/provider-sources/\${providerId}/configuration/rollbacks\`,
      {
        method: "POST",
        body: JSON.stringify({
          target_version: version.version,
          expected_version: expectedVersion,
          reason,
        }),
      },
    );
    if (!ownsVersionOperation(token, providerId)) return;
    versionWriteConfirmed.value = true;
    setVersionActionFeedback(
      "reloading",
      "新版本已生成，正在核对目录与历史",
      "写入结果已经确认；正在读取新的当前版本。",
      response.request_id,
    );
    await reloadVersionSurfaces(
      token,
      sourceSnapshot,
      "已生成新的当前版本",
      \`已从第 \${version.version} 版恢复；原有历史保持不变。\`,
    );
  } catch (error) {
    if (!ownsVersionOperation(token, providerId)) return;
    const [stage, title, description] = configurationVersionFailure(error, "rollback");
    setVersionActionFeedback(
      stage,
      title,
      description,
      error instanceof ApiClientError ? error.requestId : "",
    );
  } finally {
    if (ownsVersionOperation(token, providerId)) rollingBack.value = null;
  }
}

async function retryConfigurationVersions() {
  const sourceSnapshot = versionSource.value,
    providerId = sourceSnapshot?.provisioned?.id;
  if (!sourceSnapshot || !providerId || rollingBack.value !== null) return;
  if (versionActionStage.value === "read_failed") {
    await loadConfigurationVersions(sourceSnapshot);
    return;
  }
  const token = ++versionOwnership,
    wroteVersion = versionWriteConfirmed.value;
  setVersionActionFeedback(
    "reloading",
    wroteVersion ? "正在重新核对目录与历史" : "正在读取最新版本",
    wroteVersion ? "不会再次提交回滚，只进行安全读取。" : "正在读取服务端当前版本。",
  );
  await reloadVersionSurfaces(
    token,
    sourceSnapshot,
    wroteVersion ? "新的当前版本已确认" : "已读取最新版本",
    wroteVersion
      ? \`第 \${versionLastTarget.value ?? "—"} 版已恢复为新的当前版本，原有历史保持不变。\`
      : "配置历史已更新，可以重新选择需要恢复的版本。",
  );
}`;

export function previewProviderSourceVersionActionsParent(source) {
  let review = once(
    source,
    'import { computed, onMounted, reactive, ref, watch } from "vue";',
    'import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";',
    "parent Vue import anchor must be unique",
  );
  review = once(
    review,
    'const rollbackReason = ref("恢复已验证的来源采集设置");',
    `const rollbackReason = ref("恢复已验证的来源采集设置");${parentState}`,
    "version state anchor must be unique",
  );
  review = once(
    review,
    `    } else if (preserve) message.value = \`已刷新 \${items.value.length} 个来源频道。\`;
  } catch (error) {`,
    `    } else if (preserve) message.value = \`已刷新 \${items.value.length} 个来源频道。\`;
    return true;
  } catch (error) {`,
    "load success result anchor must be unique",
  );
  review = once(
    review,
    `    } else state.value = error instanceof ApiClientError ? failure(error.status) : "blocked";
  } finally {`,
    `    } else state.value = error instanceof ApiClientError ? failure(error.status) : "blocked";
    return false;
  } finally {`,
    "load failure result anchor must be unique",
  );
  const start = review.indexOf("async function loadConfigurationVersions(item: SourceItem) {");
  const end = review.indexOf("async function testSource(item: SourceItem) {", start);
  assert.ok(start >= 0 && end > start, "version action function boundaries");
  review = review.slice(0, start) + versionFunctions + "\n\n" + review.slice(end);
  review = once(
    review,
    `      :rollback-reason="rollbackReason"
      @close-edit="editing = null"`,
    `      :rollback-reason="rollbackReason"
      :version-action-stage="versionActionStage"
      :version-action-title="versionActionTitle"
      :version-action-description="versionActionDescription"
      :version-action-request-id="versionActionRequestId"
      :version-last-target="versionLastTarget"
      @close-edit="editing = null"`,
    "version action props anchor must be unique",
  );
  review = once(
    review,
    `      @close-versions="versionSource = null"
      @rollback="rollbackConfiguration"`,
    `      @close-versions="closeConfigurationVersions"
      @retry-versions="retryConfigurationVersions"
      @rollback="rollbackConfiguration"`,
    "version action events anchor must be unique",
  );
  return review;
}

export function previewProviderSourceVersionActionsDialog(source) {
  let review = previewProviderSourceVersions(source);
  review = once(
    review,
    "  rollbackReason: string;\n}>();",
    `  rollbackReason: string;
  versionActionStage: string;
  versionActionTitle: string;
  versionActionDescription: string;
  versionActionRequestId: string;
  versionLastTarget: number | null;
}>();`,
    "version action props declaration anchor must be unique",
  );
  review = once(
    review,
    "  closeVersions: [];\n  rollback: [version: ConfigurationVersion];",
    "  closeVersions: [];\n  retryVersions: [];\n  rollback: [version: ConfigurationVersion];",
    "version retry emit anchor must be unique",
  );
  review = once(
    review,
    "const versionTitle = ref<HTMLElement | null>(null);",
    `const versionTitle = ref<HTMLElement | null>(null);
const versionFeedbackTitle = ref<HTMLElement | null>(null);`,
    "version feedback ref anchor must be unique",
  );
  review = once(
    review,
    "onBeforeUnmount(() => setVersionBackgroundInert(false));",
    `watch(
  () => props.versionActionStage,
  async (stage) => {
    if (stage === "idle") return;
    await nextTick();
    if (["success", "conflict", "forbidden", "failed", "sync_failed", "read_failed"].includes(stage))
      versionFeedbackTitle.value?.focus();
    if (window.matchMedia("(max-width: 760px)").matches)
      versionDialog.value?.querySelector<HTMLElement>(".p48-source-versions-panel")?.scrollTo({ top: 0 });
  },
  { flush: "post" },
);

onBeforeUnmount(() => setVersionBackgroundInert(false));`,
    "version feedback watch anchor must be unique",
  );
  review = once(
    review,
    `        <p class="p48-source-versions-privacy">这里只显示采集频率、超时、重试和启停状态；凭证、Cookie 与受限配置不会进入历史详情。</p>

        <section`,
    `        <p class="p48-source-versions-privacy">这里只显示采集频率、超时、重试和启停状态；凭证、Cookie 与受限配置不会进入历史详情。</p>

        <section
          v-if="versionActionStage !== 'idle'"
          class="p48-source-version-action-feedback"
          :data-stage="versionActionStage"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          :aria-busy="['submitting', 'reloading'].includes(versionActionStage)"
        >
          <p>{{ ['submitting', 'reloading'].includes(versionActionStage) ? '正在处理' : '处理结果' }}</p>
          <h4 ref="versionFeedbackTitle" tabindex="-1">{{ versionActionTitle }}</h4>
          <p>{{ versionActionDescription }}</p>
          <p v-if="versionLastTarget !== null && versionActionStage === 'success'">
            恢复目标：第 {{ versionLastTarget }} 版
          </p>
          <details
            v-if="versionActionRequestId && !['submitting', 'reloading', 'success'].includes(versionActionStage)"
          >
            <summary>技术详情</summary>
            <code>关联编号：{{ versionActionRequestId }}</code>
          </details>
          <button
            v-if="['conflict', 'sync_failed', 'read_failed'].includes(versionActionStage)"
            type="button"
            @click="$emit('retryVersions')"
          >
            {{
              versionActionStage === 'conflict'
                ? '读取最新版本'
                : versionActionStage === 'read_failed'
                  ? '重新读取配置历史'
                  : '重新核对目录与历史'
            }}
          </button>
        </section>

        <section`,
    "version feedback template anchor must be unique",
  );
  review = once(
    review,
    `              :value="rollbackReason"
              minlength="2"`,
    `              :value="rollbackReason"
              :disabled="rollingBack !== null"
              minlength="2"`,
    "rollback reason disabled anchor must be unique",
  );
  review = once(
    review,
    `:disabled="rollingBack === version.version || rollbackReason.trim().length < 2"`,
    `:disabled="rollingBack !== null || rollbackReason.trim().length < 2"`,
    "all rollback actions disabled anchor must be unique",
  );
  return review;
}
