import assert from "node:assert/strict";

export const refreshFailureCopy = {
  eyebrow: "更新未完成",
  title: "最新状态暂未更新",
  description: "当前仍显示上一次成功读取的数据，可以继续查看。",
};
export const retryWrapper = `function retryRefresh(event: MouseEvent) {
  const heading = (event.currentTarget as HTMLElement)
    .closest(".adapter-center")?.querySelector<HTMLElement>(".adapter-heading");
  if (heading?.isConnected) heading.focus({ preventScroll: true });
  void load();
}
`;

export function previewAdapterRefreshFailure(source) {
  const changes = [
    ['<header class="adapter-heading">', '<header class="adapter-heading" tabindex="-1">'],
    [
      '  message = ref(""),\n  probeFeedback = ref<{ providerId: string; message: string; requestId: string } | null>(null);',
      '  message = ref(""),\n  refreshNotice = ref<"none" | "success" | "failure">("none"),\n  probeFeedback = ref<{ providerId: string; message: string; requestId: string } | null>(null);',
    ],
    [
      '  refreshing.value = true;\n  message.value = "";',
      '  refreshing.value = true;\n  message.value = "";\n  refreshNotice.value = "none";',
    ],
    [
      "    if (preserve) message.value = `已刷新 ${items.value.length} 个来源适配器状态`;",
      '    if (preserve) {\n      message.value = `已刷新 ${items.value.length} 个来源适配器状态`;\n      refreshNotice.value = "success";\n    }',
    ],
    [
      '    if (preserve) {\n      state.value = "ready";',
      '    if (preserve) {\n      state.value = "ready";\n      refreshNotice.value = "failure";',
    ],
    [
      '  probeFeedback.value = null;\n  message.value = "";',
      '  probeFeedback.value = null;\n  message.value = "";\n  refreshNotice.value = "none";',
    ],
    [
      "async function probe(item: AdapterSummary, event?: MouseEvent) {",
      retryWrapper + "async function probe(item: AdapterSummary, event?: MouseEvent) {",
    ],
    [
      '      </div>\n      <section v-if="state === \'empty\'" class="adapter-empty">',
      `      </div>
      <section
        v-if="message && refreshNotice === 'failure'"
        class="adapter-refresh-failure"
        role="status"
        aria-atomic="true"
      >
        <small>${refreshFailureCopy.eyebrow}</small>
        <h3>${refreshFailureCopy.title}</h3>
        <p>${refreshFailureCopy.description}</p>
        <span>{{ message }}</span>
        <details v-if="requestId">
          <summary>本次刷新追踪</summary>
          <code>{{ requestId }}</code>
        </details>
        <button type="button" :disabled="refreshing" @click="retryRefresh">重新刷新</button>
      </section>
      <section v-if="state === 'empty'" class="adapter-empty">`,
    ],
    [
      '<div v-if="message" class="adapter-message" role="status">',
      '<div v-if="message && refreshNotice !== \'failure\'" class="adapter-message" role="status">',
    ],
  ];
  for (const [before, after] of changes) {
    assert.equal(source.split(before).length, 2, `Unique refresh preview anchor: ${before}`);
    source = source.replace(before, after);
  }
  return source;
}
