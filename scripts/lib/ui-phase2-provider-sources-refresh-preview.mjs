import assert from "node:assert/strict";

const once = (source, anchor, replacement, label) => {
  assert.equal(source.split(anchor).length, 2, label);
  return source.replace(anchor, replacement);
};

export const refreshCopy = {
  refreshing: {
    eyebrow: "目录更新",
    title: "正在更新来源目录",
  },
  success: {
    eyebrow: "更新完成",
    title: "来源目录已更新",
  },
  blocked: {
    eyebrow: "服务状态",
    title: "来源目录暂时未能更新",
  },
  error: {
    eyebrow: "更新结果",
    title: "最新目录未能更新",
  },
};

export const refreshHandler = `async function handleSourceRefresh() {
  const pageHeading = document.querySelector<HTMLElement>(".source-center .source-guide h2");
  pageHeading?.focus({ preventScroll: true });
  await load();
  await nextTick();
  if (refreshFeedback.value === "failed")
    document
      .querySelector<HTMLElement>(".source-center .p48-source-refresh-primary")
      ?.focus({ preventScroll: true });
  else pageHeading?.focus({ preventScroll: true });
}
`;

export function previewProviderSourcesRefresh(source) {
  let review = once(
    source,
    'import { computed, onMounted, reactive, ref, watch } from "vue";',
    'import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";',
    "Vue import must be unique",
  );
  review = once(
    review,
    "const refreshing = ref(false);",
    `const refreshing = ref(false);
const refreshFeedback = ref<"idle" | "refreshing" | "success" | "failed">("idle");
const refreshFailureKind = ref<ViewState | null>(null);`,
    "refresh state anchor must be unique",
  );
  review = once(
    review,
    "  const preserve = items.value.length > 0;",
    `  const preserve = items.value.length > 0;
  refreshFeedback.value = preserve ? "refreshing" : "idle";
  refreshFailureKind.value = null;
  if (preserve) requestId.value = "";`,
    "load preserve anchor must be unique",
  );
  review = once(
    review,
    '    state.value = items.value.length ? "ready" : "empty";',
    `    state.value = items.value.length ? "ready" : "empty";
    refreshFeedback.value = preserve ? "success" : "idle";`,
    "load success anchor must be unique",
  );
  review = once(
    review,
    `    if (preserve) {
      state.value = "ready";
      message.value =`,
    `    if (preserve) {
      state.value = "ready";
      refreshFailureKind.value =
        error instanceof ApiClientError ? failure(error.status) : "blocked";
      refreshFeedback.value = ["expired", "forbidden"].includes(refreshFailureKind.value)
        ? "idle"
        : "failed";
      message.value =`,
    "preserved failure anchor must be unique",
  );
  review = once(
    review,
    "onMounted(load);",
    `${refreshHandler}\nonMounted(load);`,
    "mount anchor must be unique",
  );
  review = once(
    review,
    "        <h2>多平台、多国家来源已自动登记</h2>",
    '        <h2 tabindex="-1">多平台、多国家来源已自动登记</h2>',
    "page heading anchor must be unique",
  );
  review = once(
    review,
    `        <button type="button" :disabled="refreshing" @click="load">
          {{ refreshing ? "刷新中…" : "刷新来源" }}
        </button>`,
    `        <button type="button" :disabled="refreshing" @click="handleSourceRefresh">
          {{ refreshing ? "刷新中…" : "刷新来源" }}
        </button>`,
    "header refresh anchor must be unique",
  );
  review = once(
    review,
    `    <p v-if="message" class="source-message" role="status">
      {{ message }} <code v-if="requestId">{{ requestId }}</code>
    </p>`,
    `    <p v-if="message" class="source-message" role="status">
      {{ message }} <code v-if="requestId">{{ requestId }}</code>
    </p>
    <div
      class="p48-source-refresh-host"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      :aria-busy="refreshFeedback === 'refreshing'"
    >
      <section
        v-if="refreshFeedback !== 'idle'"
        class="p48-source-refresh-feedback"
        :data-kind="refreshFeedback"
        :data-failure-kind="refreshFailureKind || undefined"
        :aria-labelledby="\`p48-source-refresh-\${refreshFeedback}\`"
      >
        <p class="p48-source-refresh-eyebrow">{{
          refreshFeedback === "refreshing"
            ? "目录更新"
            : refreshFeedback === "success"
              ? "更新完成"
              : refreshFailureKind === "blocked"
                ? "服务状态"
                : "更新结果"
        }}</p>
        <h2 :id="\`p48-source-refresh-\${refreshFeedback}\`">{{
          refreshFeedback === "refreshing"
            ? "正在更新来源目录"
            : refreshFeedback === "success"
              ? "来源目录已更新"
              : refreshFailureKind === "blocked"
                ? "来源目录暂时未能更新"
                : "最新目录未能更新"
        }}</h2>
        <p class="p48-source-refresh-description">
          {{
            refreshFeedback === "refreshing"
              ? "下方继续显示上次成功加载的 " +
                items.length +
                " 个来源。刷新完成后会更新目录与最近刷新时间。"
              : message
          }}
        </p>
        <details
          v-if="refreshFeedback !== 'refreshing' && requestId"
          class="p48-source-refresh-technical"
        >
          <summary>技术详情</summary>
          <code>{{ requestId }}</code>
        </details>
        <button
          v-if="refreshFeedback === 'failed'"
          type="button"
          class="p48-source-refresh-primary"
          @click="handleSourceRefresh"
        >
          重新加载目录
        </button>
      </section>
    </div>`,
    "source message anchor must be unique",
  );
  return review;
}
