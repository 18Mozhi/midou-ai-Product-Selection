import assert from "node:assert/strict";

const once = (source, anchor, replacement, label) => {
  assert.equal(source.split(anchor).length, 2, label);
  return source.replace(anchor, replacement);
};

export const versionDialogCopy = {
  description: "查看每次采集设置的可见差异，必要时把历史设置写成新的当前版本。",
  privacy: "这里只显示采集频率、超时、重试和启停状态；凭证、Cookie 与受限配置不会进入历史详情。",
  rollbackHelp: "填写 2–500 个字符。恢复会生成新版本，不会删除或覆盖历史。",
};

const versionBehavior = `
const versionDialog = ref<HTMLElement | null>(null);
const versionTitle = ref<HTMLElement | null>(null);
let versionTrigger: HTMLElement | null = null;
const versionInertedBackground = new Map<HTMLElement, boolean>();
const rollbackCandidates = computed(() =>
  props.versionHistory.filter((version) => version.rollback_available),
);
const currentConfigurationVersion = computed(
  () =>
    props.versionHistory.find((version) => version.current)?.version ??
    props.versionSource?.provisioned?.version ??
    null,
);

const configurationValueText = (change: ConfigurationChange, value: unknown) => {
  if (value == null) return "未设置";
  if (change.field === "schedule_minutes") return \`\${value} 分钟\`;
  if (change.field === "timeout_ms") return \`\${value} 毫秒\`;
  if (change.field === "retry_limit") return \`\${value} 次\`;
  if (change.field === "status")
    return value === "enabled" ? "启用" : value === "disabled" ? "停用" : displayValue(value);
  return displayValue(value);
};

const versionFocusable = () =>
  Array.from(
    versionDialog.value?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    ) ?? [],
  ).filter((element) => element.getClientRects().length > 0);

function setVersionBackgroundInert(active: boolean) {
  if (!active) {
    for (const [element, wasInert] of versionInertedBackground)
      if (!wasInert) element.removeAttribute("inert");
    versionInertedBackground.clear();
    return;
  }
  const modal = versionDialog.value;
  if (!modal?.parentElement) return;
  for (const child of Array.from(modal.parentElement.children)) {
    if (!(child instanceof HTMLElement) || child === modal || child.classList.contains("source-modal"))
      continue;
    versionInertedBackground.set(child, child.hasAttribute("inert"));
    child.setAttribute("inert", "");
  }
}

function closeVersionDialog() {
  if (props.rollingBack === null) emit("closeVersions");
}

function handleVersionKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    closeVersionDialog();
    return;
  }
  if (event.key !== "Tab") return;
  const focusable = versionFocusable();
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

watch(
  () => props.versionSource,
  async (source, previous) => {
    if (source && !previous) {
      versionTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      await nextTick();
      setVersionBackgroundInert(true);
      versionTitle.value?.focus({ preventScroll: true });
      return;
    }
    if (!source && previous) {
      setVersionBackgroundInert(false);
      await nextTick();
      versionTrigger?.focus({ preventScroll: true });
      versionTrigger = null;
    }
  },
  { flush: "post" },
);

onBeforeUnmount(() => setVersionBackgroundInert(false));
`;

const versionTemplate = `  <div
    v-if="versionSource"
    ref="versionDialog"
    class="source-modal p48-source-versions-modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="configuration-version-title"
    aria-describedby="configuration-version-description"
    @keydown="handleVersionKeydown"
  >
    <section class="configuration-version-panel p48-source-versions-panel">
      <header class="p48-source-versions-identity">
        <div>
          <p>来源采集 / 配置历史</p>
          <h3 id="configuration-version-title" ref="versionTitle" tabindex="-1">
            配置历史 · {{ versionSource.name }}
          </h3>
          <p id="configuration-version-description">
            查看每次采集设置的可见差异，必要时把历史设置写成新的当前版本。
          </p>
          <div class="p48-source-versions-meta" aria-label="版本概览">
            <span>当前第 {{ currentConfigurationVersion ?? "—" }} 版</span>
            <span>{{ versionHistory.length }} 条历史</span>
            <span>{{ rollbackCandidates.length }} 个可恢复版本</span>
          </div>
        </div>
        <button
          type="button"
          :aria-label="\`关闭 \${versionSource.name} 配置历史\`"
          :disabled="rollingBack !== null"
          @click="closeVersionDialog"
        >
          ×
        </button>
      </header>

      <div class="p48-source-versions-body">
        <p class="p48-source-versions-privacy">这里只显示采集频率、超时、重试和启停状态；凭证、Cookie 与受限配置不会进入历史详情。</p>

        <section
          v-if="!versionLoading && rollbackCandidates.length"
          class="p48-source-versions-rollback"
          aria-labelledby="configuration-rollback-title"
        >
          <header>
            <div>
              <p>恢复说明</p>
              <h4 id="configuration-rollback-title">先记录原因，再选择目标版本</h4>
            </div>
          </header>
          <label for="configuration-rollback-reason">
            <span>回滚原因</span>
            <textarea
              id="configuration-rollback-reason"
              :value="rollbackReason"
              minlength="2"
              maxlength="500"
              required
              aria-describedby="configuration-rollback-help"
              @input="$emit('update:rollbackReason', ($event.target as HTMLTextAreaElement).value)"
            ></textarea>
            <small id="configuration-rollback-help">填写 2–500 个字符。恢复会生成新版本，不会删除或覆盖历史。</small>
          </label>
        </section>

        <section
          v-if="versionLoading"
          class="p48-source-versions-state"
          data-kind="loading"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <p>正在读取</p>
          <h4>正在读取配置历史</h4>
          <p>读取完成后会显示当前版本、逐版差异和可恢复版本。</p>
        </section>

        <section
          v-else-if="!versionHistory.length"
          class="p48-source-versions-state"
          data-kind="empty"
        >
          <p>配置历史</p>
          <h4>还没有可显示的配置版本</h4>
          <p>当前来源尚未返回可见的采集设置历史。</p>
        </section>

        <ol v-else class="configuration-version-list p48-source-versions-timeline">
          <li
            v-for="version in versionHistory"
            :key="version.version"
            :data-current="version.current"
          >
            <header>
              <div>
                <p>第 {{ version.version }} 版</p>
                <h4>{{ configurationActionText(version.action) }}</h4>
                <time :datetime="version.created_at">{{ new Date(version.created_at).toLocaleString("zh-CN") }}</time>
              </div>
              <strong v-if="version.current">当前使用</strong>
              <button
                v-else-if="version.rollback_available"
                type="button"
                :disabled="rollingBack === version.version || rollbackReason.trim().length < 2"
                :aria-describedby="rollbackReason.trim().length < 2 ? 'configuration-rollback-help' : undefined"
                @click="$emit('rollback', version)"
              >
                {{ rollingBack === version.version ? "正在恢复…" : \`恢复第 \${version.version} 版\` }}
              </button>
            </header>
            <ul v-if="version.changes.length" aria-label="相对上一版本的差异">
              <li v-for="change in version.changes" :key="change.field">
                <span>{{ configurationFieldText(change.field) }}</span>
                <span>{{ configurationValueText(change, change.before) }}</span>
                <span aria-hidden="true">→</span>
                <strong>{{ configurationValueText(change, change.after) }}</strong>
              </li>
            </ul>
            <p v-else>与上一版本的可见采集设置一致。</p>
          </li>
        </ol>
      </div>

      <footer class="p48-source-versions-actions">
        <p>恢复操作会追加新的当前版本，现有历史保持不变。</p>
        <button type="button" :disabled="rollingBack !== null" @click="closeVersionDialog">关闭</button>
      </footer>
    </section>
  </div>
`;

export function previewProviderSourceVersions(source) {
  let review = once(
    source,
    "<script setup lang=\"ts\">",
    '<script setup lang="ts">\nimport { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";',
    "script import anchor must be unique",
  );
  review = once(
    review,
    "</script>",
    `${versionBehavior}\n</script>`,
    "script close anchor must be unique",
  );
  const start = review.indexOf('  <div\n    v-if="versionSource"');
  const end = review.indexOf("</template>", start);
  assert.ok(start >= 0, "version dialog start");
  assert.ok(end > start, "template close");
  return review.slice(0, start) + versionTemplate + review.slice(end);
}
