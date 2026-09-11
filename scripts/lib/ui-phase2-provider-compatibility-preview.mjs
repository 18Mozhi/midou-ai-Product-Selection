import assert from "node:assert/strict";

const once = (source, anchor, replacement, label) => {
  assert.equal(source.split(anchor).length, 2, label);
  return source.replace(anchor, replacement);
};

export const compatibilityCopy = {
  description: "比较保留期内的页面版本与对应解析器观测，只显示指纹和结果，不读取页面内容。",
  boundary: "矩阵只反映已留存证据的历史观测，不会自动改变来源状态。",
};

const behavior = `
const compatibilityDialog = ref<HTMLElement | null>(null);
const compatibilityDialogTitle = ref<HTMLElement | null>(null);
let compatibilityDialogTrigger: HTMLElement | null = null;
const compatibilityDialogInerted = new Map<HTMLElement, boolean>();
const statusCounts = computed(() => ({
  compatible: props.rows.filter((row) => row.status === "compatible").length,
  incompatible: props.rows.filter((row) => row.status === "incompatible").length,
  mixed: props.rows.filter((row) => row.status === "mixed").length,
  unverified: props.rows.filter((row) => row.status === "unverified").length,
}));
const compatibilitySummaryTitle = computed(() =>
  statusCounts.value.incompatible
    ? "存在解析不兼容的页面版本"
    : statusCounts.value.mixed
      ? "存在结果不一致的页面版本"
      : statusCounts.value.unverified
        ? "仍有页面版本待验证"
        : "留存观测均显示兼容",
);

const compatibilityFocusable = () =>
  Array.from(
    compatibilityDialog.value?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), summary, [href], [tabindex]:not([tabindex="-1"])',
    ) ?? [],
  ).filter((element) => element.getClientRects().length > 0);

function setCompatibilityBackgroundInert(active: boolean) {
  if (!active) {
    for (const [element, wasInert] of compatibilityDialogInerted)
      if (!wasInert) element.removeAttribute("inert");
    compatibilityDialogInerted.clear();
    return;
  }
  const modal = compatibilityDialog.value;
  if (!modal?.parentElement) return;
  for (const child of Array.from(modal.parentElement.children)) {
    if (!(child instanceof HTMLElement) || child === modal || child.classList.contains("source-modal"))
      continue;
    compatibilityDialogInerted.set(child, child.hasAttribute("inert"));
    child.setAttribute("inert", "");
  }
}

function closeCompatibilityDialog() {
  emit("close");
}

function handleCompatibilityKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    closeCompatibilityDialog();
    return;
  }
  if (event.key !== "Tab") return;
  const focusable = compatibilityFocusable();
  if (!focusable.length) return;
  const first = focusable[0],
    last = focusable[focusable.length - 1],
    active = document.activeElement;
  if (!focusable.includes(active as HTMLElement)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  } else if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

onMounted(async () => {
  compatibilityDialogTrigger =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;
  await nextTick();
  setCompatibilityBackgroundInert(true);
  compatibilityDialogTitle.value?.focus({ preventScroll: true });
});

onBeforeUnmount(() => {
  setCompatibilityBackgroundInert(false);
  compatibilityDialogTrigger?.focus({ preventScroll: true });
  compatibilityDialogTrigger = null;
});
`;

const template = `<template>
  <div
    ref="compatibilityDialog"
    class="source-modal p48-compatibility-modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="compatibility-title"
    aria-describedby="compatibility-description"
    @keydown="handleCompatibilityKeydown"
  >
    <section class="compatibility-panel p48-compatibility-panel">
      <header class="p48-compatibility-identity">
        <div>
          <p>来源采集 / 页面兼容性</p>
          <h3 id="compatibility-title" ref="compatibilityDialogTitle" tabindex="-1">
            解析兼容矩阵 · {{ sourceName }}
          </h3>
          <p id="compatibility-description">
            比较保留期内的页面版本与对应解析器观测，只显示指纹和结果，不读取页面内容。
          </p>
          <div class="p48-compatibility-meta" aria-label="兼容矩阵概览">
            <span>{{ rows.length }} 个页面版本</span>
            <span v-if="adapterVersion">采集程序 {{ adapterVersion }}</span>
            <span v-else>采集程序版本未提供</span>
          </div>
        </div>
        <button
          type="button"
          :aria-label="\`关闭 \${sourceName} 解析兼容矩阵\`"
          @click="closeCompatibilityDialog"
        >
          ×
        </button>
      </header>

      <div class="p48-compatibility-body">
        <aside class="p48-compatibility-boundary">
          <strong>证据边界</strong>
          <p>矩阵只反映已留存证据的历史观测，不会自动改变来源状态。</p>
        </aside>

        <section
          v-if="loading"
          class="p48-compatibility-state"
          data-kind="loading"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <p>正在读取</p>
          <h4>正在汇总真实页面版本</h4>
          <p>读取完成后会显示页面指纹、解析器版本和历史观测结果。</p>
        </section>

        <section
          v-else-if="error"
          class="p48-compatibility-state"
          data-kind="error"
          role="alert"
        >
          <p>读取未完成</p>
          <h4>暂时无法读取兼容矩阵</h4>
          <p>{{ error }}</p>
        </section>

        <template v-else-if="rows.length">
          <section class="p48-compatibility-summary" aria-labelledby="compatibility-summary-title">
            <div>
              <p>观测结论</p>
              <h4 id="compatibility-summary-title">{{ compatibilitySummaryTitle }}</h4>
            </div>
            <dl>
              <div><dt>已兼容</dt><dd>{{ statusCounts.compatible }}</dd></div>
              <div><dt>不兼容</dt><dd>{{ statusCounts.incompatible }}</dd></div>
              <div><dt>不一致</dt><dd>{{ statusCounts.mixed }}</dd></div>
              <div><dt>待验证</dt><dd>{{ statusCounts.unverified }}</dd></div>
            </dl>
          </section>

          <section class="p48-compatibility-ledger" aria-labelledby="compatibility-ledger-title">
            <header>
              <div>
                <p>留存观测</p>
                <h4 id="compatibility-ledger-title">页面版本与解析结果</h4>
              </div>
              <span>{{ rows.length }} 项</span>
            </header>
            <table>
              <thead>
                <tr>
                  <th scope="col">页面版本</th>
                  <th scope="col">状态</th>
                  <th scope="col">解析器版本</th>
                  <th scope="col">观测次数</th>
                  <th scope="col">成功 / 失败</th>
                  <th scope="col">最近观测</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in rows" :key="\`\${row.parser_version}:\${row.page_version_sha256}\`">
                  <td data-label="页面版本">
                    <span class="p48-compatibility-cell-label">页面版本</span>
                    <strong>{{ fingerprint(row.page_version_sha256) }}</strong>
                    <details>
                      <summary>完整指纹</summary>
                      <code>{{ row.page_version_sha256 }}</code>
                    </details>
                  </td>
                  <td data-label="状态">
                    <span class="p48-compatibility-cell-label">状态</span>
                    <i :data-status="row.status">{{ statusText(row.status) }}</i>
                  </td>
                  <td data-label="解析器版本">
                    <span class="p48-compatibility-cell-label">解析器版本</span>
                    <code>{{ row.parser_version }}</code>
                  </td>
                  <td data-label="观测次数">
                    <span class="p48-compatibility-cell-label">观测次数</span>
                    {{ row.observation_count }}
                  </td>
                  <td data-label="成功 / 失败">
                    <span class="p48-compatibility-cell-label">成功 / 失败</span>
                    <span>{{ row.succeeded_count }} / {{ row.parser_failure_count }}</span>
                  </td>
                  <td data-label="最近观测">
                    <span class="p48-compatibility-cell-label">最近观测</span>
                    <time>{{ time(row.last_observed_at) }}</time>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        </template>

        <section v-else class="p48-compatibility-state" data-kind="empty">
          <p>暂无观测</p>
          <h4>尚无可比较的真实页面版本</h4>
          <p>先运行真实页面采集；系统只使用已留存的 DOM 或 HTML 证据生成矩阵。</p>
        </section>
      </div>

      <footer class="p48-compatibility-actions">
        <p>完整页面指纹默认折叠，页面原文不会在此显示。</p>
        <button type="button" @click="closeCompatibilityDialog">关闭</button>
      </footer>
    </section>
  </div>
</template>`;

export function previewProviderCompatibilityDialog(source) {
  let review = once(
    source,
    '<script setup lang="ts">\nimport type { ProviderPageCompatibilityObservation } from "./provider-source-types";',
    '<script setup lang="ts">\nimport { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";\nimport type { ProviderPageCompatibilityObservation } from "./provider-source-types";',
    "compatibility import anchor must be unique",
  );
  review = once(
    review,
    "defineProps<{",
    "const props = defineProps<{",
    "compatibility props anchor",
  );
  review = once(
    review,
    "defineEmits<{ close: [] }>();",
    "const emit = defineEmits<{ close: [] }>();",
    "compatibility emit anchor",
  );
  review = once(review, "</script>", `${behavior}\n</script>`, "compatibility script close anchor");
  const start = review.indexOf("<template>"),
    end = review.indexOf("<style scoped>", start);
  assert.ok(start >= 0 && end > start, "compatibility template boundaries");
  return review.slice(0, start) + template + "\n\n" + review.slice(end);
}
