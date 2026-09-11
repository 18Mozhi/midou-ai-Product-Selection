import assert from "node:assert/strict";

const once = (source, anchor, replacement, label) => {
  assert.equal(source.split(anchor).length, 2, label);
  return source.replace(anchor, replacement);
};

export const configurationDialogCopy = {
  titlePrefix: "采集设置",
  description: "调整采集节奏和运行状态。系统会记录本次原因，并保留历史版本。",
  scheduleHelp: "允许 1–10080 的整数。",
  timeoutHelp: "允许 1000–120000 毫秒的整数。",
  retryHelp: "允许 0–10 的整数。",
  reasonHelp: "填写 2–500 个字符，说明这次调整的原因。",
};

const accessibilityScript = `
const editDialog = ref<HTMLElement | null>(null);
const editTitle = ref<HTMLElement | null>(null);
let editTrigger: HTMLElement | null = null;
const inertedBackground = new Map<HTMLElement, boolean>();

const editFocusable = () =>
  Array.from(
    editDialog.value?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    ) ?? [],
  ).filter((element) => element.getClientRects().length > 0);

function setEditBackgroundInert(active: boolean) {
  if (!active) {
    for (const [element, wasInert] of inertedBackground)
      if (!wasInert) element.removeAttribute("inert");
    inertedBackground.clear();
    return;
  }
  const modal = editDialog.value;
  if (!modal?.parentElement) return;
  for (const child of Array.from(modal.parentElement.children)) {
    if (!(child instanceof HTMLElement) || child === modal || child.classList.contains("source-modal"))
      continue;
    inertedBackground.set(child, child.hasAttribute("inert"));
    child.setAttribute("inert", "");
  }
}

function closeEditDialog() {
  if (!props.saving) emit("closeEdit");
}

function handleEditKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    closeEditDialog();
    return;
  }
  if (event.key !== "Tab") return;
  const focusable = editFocusable();
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
  () => props.editing,
  async (editing, previous) => {
    if (editing && !previous) {
      editTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      await nextTick();
      setEditBackgroundInert(true);
      editTitle.value?.focus({ preventScroll: true });
      return;
    }
    if (!editing && previous) {
      setEditBackgroundInert(false);
      await nextTick();
      editTrigger?.focus({ preventScroll: true });
      editTrigger = null;
    }
  },
  { flush: "post" },
);

onBeforeUnmount(() => setEditBackgroundInert(false));
`;

const editTemplate = `  <div
    v-if="editing"
    ref="editDialog"
    class="source-modal p48-source-configuration-modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="source-edit-title"
    aria-describedby="source-edit-description"
    @keydown="handleEditKeydown"
  >
    <form class="p48-source-configuration-form" :aria-busy="saving" @submit.prevent="$emit('save')">
      <header class="p48-source-configuration-identity">
        <div class="p48-source-configuration-heading">
          <p>来源采集 / 编辑设置</p>
          <h3 id="source-edit-title" ref="editTitle" tabindex="-1">
            采集设置 · {{ editing.name }}
          </h3>
          <p id="source-edit-description">
            调整采集节奏和运行状态。系统会记录本次原因，并保留历史版本。
          </p>
          <div class="p48-source-configuration-meta" aria-label="当前来源信息">
            <span>{{ editing.access_mode === "authenticated_browser" ? "网页登录来源" : "公开来源" }}</span>
            <span>{{ editing.provisioned?.status === "enabled" ? "当前已启用" : "当前已停用" }}</span>
            <span>配置版本 {{ editing.provisioned?.version }}</span>
          </div>
        </div>
        <button
          type="button"
          :aria-label="\`关闭 \${editing.name} 采集设置\`"
          :disabled="saving"
          @click="closeEditDialog"
        >
          ×
        </button>
      </header>

      <section class="p48-source-configuration-section" aria-labelledby="source-edit-rhythm-title">
        <header>
          <div>
            <p>01 / 采集节奏</p>
            <h4 id="source-edit-rhythm-title">设置频率、超时和重试</h4>
          </div>
          <p>所有数值都按整数保存。</p>
        </header>
        <div class="p48-source-configuration-fields">
          <label for="source-edit-schedule">
            <span>采集频率（分钟）</span>
            <input
              id="source-edit-schedule"
              :value="form.schedule_minutes"
              type="number"
              min="1"
              max="10080"
              step="1"
              required
              aria-describedby="source-edit-schedule-help"
              @input="updateForm('schedule_minutes', Number(($event.target as HTMLInputElement).value))"
            />
            <small id="source-edit-schedule-help">允许 1–10080 的整数。</small>
          </label>
          <label for="source-edit-timeout">
            <span>单次超时（毫秒）</span>
            <input
              id="source-edit-timeout"
              :value="form.timeout_ms"
              type="number"
              min="1000"
              max="120000"
              step="1"
              required
              aria-describedby="source-edit-timeout-help"
              @input="updateForm('timeout_ms', Number(($event.target as HTMLInputElement).value))"
            />
            <small id="source-edit-timeout-help">允许 1000–120000 毫秒的整数。</small>
          </label>
          <label for="source-edit-retry">
            <span>失败重试次数</span>
            <input
              id="source-edit-retry"
              :value="form.retry_limit"
              type="number"
              min="0"
              max="10"
              step="1"
              required
              aria-describedby="source-edit-retry-help"
              @input="updateForm('retry_limit', Number(($event.target as HTMLInputElement).value))"
            />
            <small id="source-edit-retry-help">允许 0–10 的整数。</small>
          </label>
          <label for="source-edit-status">
            <span>{{ editing.availability === "automatic" ? "运行状态" : "来源设置状态" }}</span>
            <select
              id="source-edit-status"
              :value="form.status"
              aria-describedby="source-edit-status-help"
              @change="updateForm('status', ($event.target as HTMLSelectElement).value)"
            >
              <option value="enabled">启用</option>
              <option value="disabled">停用</option>
            </select>
            <small id="source-edit-status-help">
              {{ editing.access_mode === "authenticated_browser"
                ? "启用设置不代表已经完成网页登录或来源验收。"
                : "公开来源从停用改为启用时，需要先通过真实页面烟测。" }}
            </small>
          </label>
        </div>
      </section>

      <section
        v-if="requiresSmokeTest(editing, form)"
        class="source-smoke-notice p48-source-configuration-smoke"
        aria-labelledby="source-edit-smoke-title"
      >
        <p>启用前检查</p>
        <h4 id="source-edit-smoke-title">将先保存停用版，再执行真实页面烟测</h4>
        <p>
          烟测通过后才会再次保存为启用；如果烟测失败，刚才保存的停用配置仍会保留，来源不会启用。
        </p>
      </section>

      <section
        v-if="preview"
        class="source-schedule-preview p48-source-configuration-preview"
        aria-labelledby="source-edit-preview-title"
      >
        <header>
          <div>
            <p>02 / 保存前影响</p>
            <h4 id="source-edit-preview-title">调度同频与当前并发占用</h4>
          </div>
          <span>当前快照</span>
        </header>
        <dl>
          <div>
            <dt>同频来源</dt>
            <dd><strong>{{ preview.same_interval_enabled_count }}</strong> 个</dd>
            <p>已启用来源配置为 {{ form.schedule_minutes }} 分钟</p>
          </div>
          <div>
            <dt>当前并发占用</dt>
            <dd><strong>{{ preview.active_count }}</strong> / {{ preview.configured_limit }}</dd>
            <p>剩余 {{ preview.available_count }} 个配置槽位</p>
          </div>
        </dl>
        <p>
          同频数量只表示可能进入同一调度窗口，不等于必然冲突；并发占用是当前待执行或执行中的真实快照，不预测未来任务量。
        </p>
      </section>

      <section class="p48-source-configuration-section p48-source-configuration-reason" aria-labelledby="source-edit-reason-title">
        <header>
          <div>
            <p>03 / 变更说明</p>
            <h4 id="source-edit-reason-title">记录本次调整原因</h4>
          </div>
        </header>
        <label for="source-edit-reason">
          <span>变更原因</span>
          <textarea
            id="source-edit-reason"
            :value="form.reason"
            minlength="2"
            maxlength="500"
            required
            aria-describedby="source-edit-reason-help"
            @input="updateForm('reason', ($event.target as HTMLTextAreaElement).value)"
          ></textarea>
          <small id="source-edit-reason-help">填写 2–500 个字符，说明这次调整的原因。</small>
        </label>
      </section>

      <footer class="p48-source-configuration-actions">
        <p>{{ requiresSmokeTest(editing, form) ? "将先保存停用版，再进行烟测" : "保存后会生成新的配置版本" }}</p>
        <div>
          <button type="button" :disabled="saving" @click="closeEditDialog">取消</button>
          <button :disabled="saving">
            {{ saving ? "处理中…" : requiresSmokeTest(editing, form) ? "烟测并启用" : "保存配置" }}
          </button>
        </div>
      </footer>
    </form>
  </div>
`;

export function previewProviderSourceConfiguration(source) {
  let review = once(
    source,
    "<script setup lang=\"ts\">",
    '<script setup lang="ts">\nimport { nextTick, onBeforeUnmount, ref, watch } from "vue";',
    "script setup anchor must be unique",
  );
  review = once(
    review,
    "</script>",
    `${accessibilityScript}\n</script>`,
    "script close anchor must be unique",
  );
  const start = review.indexOf('  <div\n    v-if="editing"');
  const end = review.indexOf('  <div\n    v-if="versionSource"');
  assert.ok(start >= 0, "editing dialog start");
  assert.ok(end > start, "version dialog start");
  review = review.slice(0, start) + editTemplate + review.slice(end);
  return review;
}
