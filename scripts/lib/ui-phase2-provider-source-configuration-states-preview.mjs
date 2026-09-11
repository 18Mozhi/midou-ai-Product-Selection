import assert from "node:assert/strict";
import { previewProviderSourceConfiguration } from "./ui-phase2-provider-source-configuration-preview.mjs";

const once = (source, anchor, replacement, label) => {
  assert.equal(source.split(anchor).length, 2, label);
  return source.replace(anchor, replacement);
};

export const configurationSaveCopy = {
  saving: {
    title: "正在保存采集设置",
    description: "正在生成新的配置版本，请稍候。",
  },
  saving_disabled: {
    title: "正在先保存停用配置",
    description: "来源继续保持停用；保存完成后才会执行真实页面烟测。",
  },
  smoke_testing: {
    title: "停用配置已保存，正在进行真实页面烟测",
    description: "来源仍处于停用状态。烟测通过后才会继续启用。",
  },
  enabling: {
    title: "烟测已通过，正在启用来源",
    description: "正在把刚才验证过的配置写为启用状态。",
  },
  success: {
    title: "采集设置已保存",
  },
  partial: {
    title: "停用配置已保存，来源尚未启用",
  },
  failed: {
    title: "采集设置未能保存",
  },
  conflict: {
    title: "配置已经更新，请重新读取",
  },
};

const parentState = `
type ConfigurationSaveStage =
  | "idle"
  | "saving"
  | "saving_disabled"
  | "smoke_testing"
  | "enabling"
  | "success"
  | "partial"
  | "failed"
  | "conflict";
const configurationSaveStage = ref<ConfigurationSaveStage>("idle");
const configurationSaveTitle = ref("");
const configurationSaveDescription = ref("");
const configurationSaveRequestId = ref("");

function setConfigurationSaveFeedback(
  stage: ConfigurationSaveStage,
  title: string,
  description: string,
  technicalRequestId = "",
) {
  configurationSaveStage.value = stage;
  configurationSaveTitle.value = title;
  configurationSaveDescription.value = description;
  configurationSaveRequestId.value = technicalRequestId;
  message.value = "";
}
`;

const beginEdit = `function beginEdit(item: SourceItem) {
  if (!item.provisioned) return;
  editing.value = item;
  setConfigurationSaveFeedback("idle", "", "");
  Object.assign(form, {
    schedule_minutes: item.provisioned.schedule_minutes,
    timeout_ms: item.provisioned.timeout_ms,
    retry_limit: item.provisioned.retry_limit,
    status: item.provisioned.status === "enabled" ? "enabled" : "disabled",
    reason: "调整来源采集配置",
  });
}`;

const save = `async function save() {
  if (!editing.value?.provisioned || saving.value) return;
  const editingSnapshot = editing.value,
    source = editingSnapshot.provisioned,
    formSnapshot = { ...form },
    isAutomatic = editingSnapshot.availability === "automatic",
    requiresPublicSmoke =
      source.status !== "enabled" &&
      formSnapshot.status === "enabled" &&
      ["public_page", "public_rss"].includes(editingSnapshot.access_mode);
  saving.value = true;
  message.value = "";
  requestId.value = "";
  let stagedDisabled = false;
  try {
    setConfigurationSaveFeedback(
      requiresPublicSmoke ? "saving_disabled" : "saving",
      requiresPublicSmoke ? "正在先保存停用配置" : "正在保存采集设置",
      requiresPublicSmoke
        ? "来源继续保持停用；保存完成后才会执行真实页面烟测。"
        : "正在生成新的配置版本，请稍候。",
    );
    let saved = await api<any>(\`/platform/provider-sources/\${source.id}/configuration\`, {
      method: "PUT",
      body: JSON.stringify({
        ...formSnapshot,
        status: requiresPublicSmoke ? "disabled" : formSnapshot.status,
        expected_version: source.version,
      }),
    });
    if (requiresPublicSmoke) {
      stagedDisabled = true;
      Object.assign(source, saved);
      setConfigurationSaveFeedback(
        "smoke_testing",
        "停用配置已保存，正在进行真实页面烟测",
        "来源仍处于停用状态。烟测通过后才会继续启用。",
      );
      let smoke;
      try {
        smoke = await api<any>(\`/platform/provider-adapters/\${source.id}/health-check\`, {
          method: "POST",
        });
      } catch {
        setConfigurationSaveFeedback(
          "partial",
          "停用配置已保存，来源尚未启用",
          \`真实页面烟测暂时无法完成。\${message.value || "请稍后重新打开并重试。"}\`,
          requestId.value,
        );
        return;
      }
      if (smoke?.health_status !== "ready") {
        setConfigurationSaveFeedback(
          "partial",
          "停用配置已保存，来源尚未启用",
          \`真实页面烟测未通过：\${smoke?.last_error_code ?? "来源暂不可用"}。处理来源问题后再重新启用。\`,
          requestId.value,
        );
        return;
      }
      setConfigurationSaveFeedback(
        "enabling",
        "烟测已通过，正在启用来源",
        "正在把刚才验证过的配置写为启用状态。",
      );
      try {
        saved = await api<any>(\`/platform/provider-sources/\${source.id}/configuration\`, {
          method: "PUT",
          body: JSON.stringify({ ...formSnapshot, expected_version: saved.version }),
        });
      } catch {
        setConfigurationSaveFeedback(
          "partial",
          "停用配置已保存，来源尚未启用",
          \`烟测已经通过，但启用状态没有写入。\${message.value || "请重新读取最新配置后再试。"}\`,
          requestId.value,
        );
        return;
      }
      Object.assign(source, saved);
    } else Object.assign(source, saved);
    setConfigurationSaveFeedback(
      "success",
      requiresPublicSmoke ? "烟测通过，来源已启用" : "采集设置已保存",
      requiresPublicSmoke
        ? "停用配置和启用状态都已写入，并保留了新的配置版本。"
        : isAutomatic
          ? "频率、超时、重试和启停状态已写入新的配置版本。"
          : "设置已写入新的配置版本；完成网页登录和可用性检查前，来源不会进入自动采集。",
      requestId.value,
    );
  } catch (error) {
    const conflict = error instanceof ApiClientError && error.status === 409;
    setConfigurationSaveFeedback(
      stagedDisabled ? "partial" : conflict ? "conflict" : "failed",
      stagedDisabled
        ? "停用配置已保存，来源尚未启用"
        : conflict
          ? "配置已经更新，请重新读取"
          : "采集设置未能保存",
      stagedDisabled
        ? \`停用配置已经保留。\${message.value || "后续步骤没有完成。"}\`
        : conflict
          ? "其他操作已经产生了新版本。关闭此窗并重新读取后，再基于最新配置修改。"
          : message.value || "请检查当前状态后重新保存。",
      requestId.value,
    );
  } finally {
    saving.value = false;
  }
}`;

export function previewProviderSourceConfigurationStatesParent(source) {
  let review = once(
    source,
    "const saving = ref(false);",
    `const saving = ref(false);${parentState}`,
    "saving state anchor must be unique",
  );
  const beginStart = review.indexOf("function beginEdit(item: SourceItem) {");
  const saveStart = review.indexOf("async function save() {");
  const versionsStart = review.indexOf("async function loadConfigurationVersions(item: SourceItem) {");
  assert.ok(beginStart >= 0 && saveStart > beginStart && versionsStart > saveStart, "save boundaries");
  review = review.slice(0, beginStart) + beginEdit + "\n\n" + save + "\n" + review.slice(versionsStart);
  review = once(
    review,
    `      :saving="saving"
      :version-source="versionSource"`,
    `      :saving="saving"
      :save-stage="configurationSaveStage"
      :save-title="configurationSaveTitle"
      :save-description="configurationSaveDescription"
      :save-request-id="configurationSaveRequestId"
      :version-source="versionSource"`,
    "configuration props anchor must be unique",
  );
  return review;
}

export function previewProviderSourceConfigurationStatesDialog(source) {
  let review = previewProviderSourceConfiguration(source);
  review = once(
    review,
    "  saving: boolean;\n  versionSource: ProviderSourceItem | null;",
    `  saving: boolean;
  saveStage: string;
  saveTitle: string;
  saveDescription: string;
  saveRequestId: string;
  versionSource: ProviderSourceItem | null;`,
    "save props anchor must be unique",
  );
  review = once(
    review,
    "const editTitle = ref<HTMLElement | null>(null);",
    `const editTitle = ref<HTMLElement | null>(null);
const saveFeedbackTitle = ref<HTMLElement | null>(null);`,
    "feedback ref anchor must be unique",
  );
  review = once(
    review,
    "onBeforeUnmount(() => setEditBackgroundInert(false));",
    `watch(
  () => props.saveStage,
  async (stage) => {
    if (!["success", "partial", "failed", "conflict"].includes(stage)) return;
    await nextTick();
    saveFeedbackTitle.value?.focus({ preventScroll: true });
  },
  { flush: "post" },
);

onBeforeUnmount(() => setEditBackgroundInert(false));`,
    "feedback focus anchor must be unique",
  );
  review = once(
    review,
    "      </header>\n\n      <section class=\"p48-source-configuration-section\"",
    `      </header>

      <section
        v-if="saveStage !== 'idle'"
        class="p48-source-configuration-save-feedback"
        :data-stage="saveStage"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        :aria-busy="['saving', 'saving_disabled', 'smoke_testing', 'enabling'].includes(saveStage)"
      >
        <p>{{ ['saving', 'saving_disabled', 'smoke_testing', 'enabling'].includes(saveStage) ? '正在处理' : '处理结果' }}</p>
        <h4 ref="saveFeedbackTitle" tabindex="-1">{{ saveTitle }}</h4>
        <p>{{ saveDescription }}</p>
        <details v-if="saveRequestId && ['partial', 'failed', 'conflict'].includes(saveStage)">
          <summary>技术详情</summary>
          <code>{{ saveRequestId }}</code>
        </details>
      </section>

      <section class="p48-source-configuration-section"`,
    "feedback template anchor must be unique",
  );
  for (const id of ["source-edit-schedule", "source-edit-timeout", "source-edit-retry"])
    review = once(
      review,
      `              id="${id}"\n              :value=`,
      `              id="${id}"\n              :disabled="saving"\n              :value=`,
      `${id} disabled anchor`,
    );
  review = once(
    review,
    `              id="source-edit-status"
              :value="form.status"`,
    `              id="source-edit-status"
              :disabled="saving"
              :value="form.status"`,
    "status disabled anchor",
  );
  review = once(
    review,
    `            id="source-edit-reason"
            :value="form.reason"`,
    `            id="source-edit-reason"
            :disabled="saving"
            :value="form.reason"`,
    "reason disabled anchor",
  );
  review = once(
    review,
    `        <p>{{ requiresSmokeTest(editing, form) ? "将先保存停用版，再进行烟测" : "保存后会生成新的配置版本" }}</p>`,
    `        <p>{{
          saveStage === "success"
            ? "结果已确认，关闭后返回来源目录"
            : saveStage === "partial"
              ? "已保留停用配置，关闭后处理来源问题"
              : saveStage === "conflict"
                ? "当前内容已过期，关闭后重新读取"
                : saveStage === "failed"
                  ? "字段保持不变，可以重新保存"
                  : requiresSmokeTest(editing, form)
                    ? "将先保存停用版，再进行烟测"
                    : "保存后会生成新的配置版本"
        }}</p>`,
    "state footer note anchor must be unique",
  );
  review = once(
    review,
    `          <button :disabled="saving">
            {{ saving ? "处理中…" : requiresSmokeTest(editing, form) ? "烟测并启用" : "保存配置" }}
          </button>`,
    `          <button
            v-if="['success', 'partial', 'conflict'].includes(saveStage)"
            type="button"
            @click="closeEditDialog"
          >
            {{ saveStage === "success" ? "完成" : saveStage === "conflict" ? "关闭后重新读取" : "关闭" }}
          </button>
          <button v-else :disabled="saving">
            {{
              saving
                ? saveStage === "smoke_testing"
                  ? "正在烟测…"
                  : saveStage === "enabling"
                    ? "正在启用…"
                    : "正在保存…"
                : saveStage === "idle"
                  ? requiresSmokeTest(editing, form)
                    ? "烟测并启用"
                    : "保存配置"
                  : "重新保存"
            }}
          </button>`,
    "state action anchor must be unique",
  );
  return review;
}
