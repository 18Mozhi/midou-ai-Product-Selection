import assert from "node:assert/strict";
import {
  previewProviderSourceConfigurationStatesDialog,
  previewProviderSourceConfigurationStatesParent,
} from "./ui-phase2-provider-source-configuration-states-preview.mjs";

const once = (source, anchor, replacement, label) => {
  assert.equal(source.split(anchor).length, 2, label);
  return source.replace(anchor, replacement);
};

export const configurationReturnCopy = {
  saved: {
    refreshing: "设置已保存，正在更新来源目录",
    success: "设置已保存，来源目录已更新",
    failed: "设置已保存，但来源目录尚未更新",
  },
  partial: {
    refreshing: "停用配置已保存，正在更新来源目录",
    success: "停用配置已保存，来源目录已更新",
    failed: "停用配置已保存，但来源目录尚未更新",
  },
  conflict: {
    refreshing: "正在读取最新配置",
    success: "已读取最新配置",
    failed: "最新配置暂时未能读取",
  },
};

const returnState = `
type ConfigurationReturnState = "idle" | "refreshing" | "success" | "failed";
type ConfigurationReturnOutcome = "saved" | "partial" | "conflict";
const configurationReturnState = ref<ConfigurationReturnState>("idle");
const configurationReturnOutcome = ref<ConfigurationReturnOutcome>("saved");
const configurationReturnTitle = ref("");
const configurationReturnDescription = ref("");
const configurationReturnRequestId = ref("");
const configurationReturnHeading = ref<HTMLElement | null>(null);
const configurationReturnSourceName = ref("");

function configurationReturnCopy(
  outcome: ConfigurationReturnOutcome,
  state: Exclude<ConfigurationReturnState, "idle">,
) {
  const titles = {
    saved: {
      refreshing: "设置已保存，正在更新来源目录",
      success: "设置已保存，来源目录已更新",
      failed: "设置已保存，但来源目录尚未更新",
    },
    partial: {
      refreshing: "停用配置已保存，正在更新来源目录",
      success: "停用配置已保存，来源目录已更新",
      failed: "停用配置已保存，但来源目录尚未更新",
    },
    conflict: {
      refreshing: "正在读取最新配置",
      success: "已读取最新配置",
      failed: "最新配置暂时未能读取",
    },
  } as const;
  return titles[outcome][state];
}

async function focusConfigurationReturn(state: ConfigurationReturnState) {
  await nextTick();
  if (state === "failed")
    document
      .querySelector<HTMLElement>(".source-center .p48-source-configuration-return-retry")
      ?.focus({ preventScroll: true });
  else configurationReturnHeading.value?.focus({ preventScroll: true });
}

async function refreshAfterConfigurationResult() {
  const outcome = configurationReturnOutcome.value;
  configurationReturnState.value = "refreshing";
  configurationReturnTitle.value = configurationReturnCopy(outcome, "refreshing");
  configurationReturnDescription.value =
    outcome === "conflict"
      ? "正在从服务端重新读取当前版本，请稍候。"
      : "刚才的写入已经完成；正在同步目录中的最新状态。";
  configurationReturnRequestId.value = "";
  message.value = "";
  requestId.value = "";
  await focusConfigurationReturn("refreshing");
  const refreshed = await load();
  const failedMessage = message.value,
    failedRequestId = requestId.value;
  message.value = "";
  requestId.value = "";
  if (refreshed) {
    configurationReturnState.value = "success";
    configurationReturnTitle.value = configurationReturnCopy(outcome, "success");
    configurationReturnDescription.value =
      outcome === "conflict"
        ? \`\${configurationReturnSourceName.value} 已同步到服务端当前版本，可以重新打开编辑。\`
        : outcome === "partial"
          ? \`\${configurationReturnSourceName.value} 的停用配置已同步；处理来源问题后再重新启用。\`
          : \`\${configurationReturnSourceName.value} 的最新配置已经显示在目录中。\`;
    await focusConfigurationReturn("success");
    return;
  }
  configurationReturnState.value = "failed";
  configurationReturnTitle.value = configurationReturnCopy(outcome, "failed");
  configurationReturnDescription.value =
    outcome === "conflict"
      ? \`\${failedMessage || "来源目录暂时无法读取。"} 当前页面不会把旧内容当作最新配置。\`
      : \`刚才的写入不会撤销。\${failedMessage || "下方继续显示上次成功读取的来源目录。"}\`;
  configurationReturnRequestId.value = failedRequestId;
  await focusConfigurationReturn("failed");
}

async function acknowledgeConfigurationSave() {
  if (!editing.value || !["success", "partial", "conflict"].includes(configurationSaveStage.value))
    return;
  configurationReturnOutcome.value =
    configurationSaveStage.value === "success"
      ? "saved"
      : configurationSaveStage.value === "partial"
        ? "partial"
        : "conflict";
  configurationReturnSourceName.value = editing.value.name;
  editing.value = null;
  setConfigurationSaveFeedback("idle", "", "");
  await nextTick();
  await refreshAfterConfigurationResult();
}
`;

export function previewProviderSourceConfigurationReturnParent(source) {
  let review = previewProviderSourceConfigurationStatesParent(source);
  review = once(
    review,
    'import { computed, onMounted, reactive, ref, watch } from "vue";',
    'import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";',
    "nextTick import anchor must be unique",
  );
  review = once(
    review,
    'const configurationSaveRequestId = ref("");',
    `const configurationSaveRequestId = ref("");${returnState}`,
    "return state anchor must be unique",
  );
  review = once(
    review,
    `  setConfigurationSaveFeedback("idle", "", "");
  Object.assign(form, {`,
    `  setConfigurationSaveFeedback("idle", "", "");
  configurationReturnState.value = "idle";
  Object.assign(form, {`,
    "open clears return feedback anchor must be unique",
  );
  review = once(
    review,
    `    } else state.value = error instanceof ApiClientError ? failure(error.status) : "blocked";
  } finally {`,
    `    } else state.value = error instanceof ApiClientError ? failure(error.status) : "blocked";
    return false;
  } finally {`,
    "load failure return anchor must be unique",
  );
  review = once(
    review,
    `    } else if (preserve) message.value = \`已刷新 \${items.value.length} 个来源频道。\`;
  } catch (error) {`,
    `    } else if (preserve) message.value = \`已刷新 \${items.value.length} 个来源频道。\`;
    return true;
  } catch (error) {`,
    "load success return anchor must be unique",
  );
  review = once(
    review,
    `    <p v-if="message" class="source-message" role="status">
      {{ message }} <code v-if="requestId">{{ requestId }}</code>
    </p>`,
    `    <p v-if="message && configurationReturnState === 'idle'" class="source-message" role="status">
      {{ message }} <code v-if="requestId">{{ requestId }}</code>
    </p>
    <section
      v-if="configurationReturnState !== 'idle'"
      class="p48-source-configuration-return"
      :data-state="configurationReturnState"
      :data-outcome="configurationReturnOutcome"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      :aria-busy="configurationReturnState === 'refreshing'"
    >
      <p>{{ configurationReturnState === "refreshing" ? "正在同步" : "同步结果" }}</p>
      <h2 ref="configurationReturnHeading" tabindex="-1">{{ configurationReturnTitle }}</h2>
      <p>{{ configurationReturnDescription }}</p>
      <details v-if="configurationReturnState === 'failed' && configurationReturnRequestId">
        <summary>技术详情</summary>
        <code>{{ configurationReturnRequestId }}</code>
      </details>
      <button
        v-if="configurationReturnState === 'failed'"
        type="button"
        class="p48-source-configuration-return-retry"
        @click="refreshAfterConfigurationResult"
      >
        重新读取来源目录
      </button>
    </section>`,
    "page return feedback anchor must be unique",
  );
  review = once(
    review,
    `      @close-edit="editing = null"
      @save="save"`,
    `      @close-edit="editing = null"
      @acknowledge="acknowledgeConfigurationSave"
      @save="save"`,
    "acknowledge listener anchor must be unique",
  );
  return review;
}

export function previewProviderSourceConfigurationReturnDialog(source) {
  let review = previewProviderSourceConfigurationStatesDialog(source);
  review = once(
    review,
    "  closeEdit: [];\n  save: [];",
    "  closeEdit: [];\n  acknowledge: [];\n  save: [];",
    "acknowledge emit anchor must be unique",
  );
  review = once(
    review,
    `function closeEditDialog() {
  if (!props.saving) emit("closeEdit");
}`,
    `function closeEditDialog() {
  if (props.saving) return;
  if (["success", "partial", "conflict"].includes(props.saveStage)) emit("acknowledge");
  else emit("closeEdit");
}`,
    "terminal acknowledge anchor must be unique",
  );
  return review;
}
