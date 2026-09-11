import assert from "node:assert/strict";

const once = (source, anchor, replacement, label) => {
  assert.equal(source.split(anchor).length, 2, label);
  return source.replace(anchor, replacement);
};

export const mobileState = `const filtersExpanded = ref(false);
const selectedMobileSourceCode = ref("");
const mobileDetailTrigger = ref<HTMLElement | null>(null);`;

export const mobileHandlers = `async function openMobileSourceDetail(code: string, event: MouseEvent) {
  mobileDetailTrigger.value = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
  selectedMobileSourceCode.value = code;
  await nextTick();
  document
    .querySelector<HTMLElement>(".source-center .p48-mobile-selected .p48-mobile-detail-back")
    ?.focus({ preventScroll: true });
}
async function closeMobileSourceDetail() {
  const trigger = mobileDetailTrigger.value;
  selectedMobileSourceCode.value = "";
  await nextTick();
  if (trigger?.isConnected) trigger.focus({ preventScroll: true });
}
`;

export function previewProviderSourcesMobile(source) {
  let review = once(
    source,
    'import { computed, onMounted, reactive, ref, watch } from "vue";',
    'import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";',
    "Vue import must be unique",
  );
  review = once(
    review,
    'const requestId = ref("");',
    `const requestId = ref("");\n${mobileState}`,
    "request state anchor must be unique",
  );
  review = once(
    review,
    "onMounted(load);",
    `${mobileHandlers}\nonMounted(load);`,
    "mount anchor must be unique",
  );
  review = once(
    review,
    '  <section class="source-center novice">',
    `  <section
    class="source-center novice"
    :class="{ 'p48-mobile-detail-open': selectedMobileSourceCode }"
  >`,
    "source center anchor must be unique",
  );
  review = once(
    review,
    `      /></label>
      <label
        >业务类型`,
    `      /></label>
      <button
        type="button"
        class="p48-mobile-filter-toggle"
        :aria-expanded="filtersExpanded"
        aria-controls="p48-mobile-filter-fields"
        @click="filtersExpanded = !filtersExpanded"
      >
        {{ filtersExpanded ? "收起筛选" : "更多筛选与排序" }}
      </button>
      <div
        id="p48-mobile-filter-fields"
        class="p48-mobile-filter-fields"
        :class="{ 'is-open': filtersExpanded }"
      >
        <label>业务类型`,
    "first advanced filter anchor must be unique",
  );
  review = once(
    review,
    `      ><button type="button" class="source-reset" @click="resetFilters">重置筛选</button>
      <span class="source-result-count">`,
    `        ><button type="button" class="source-reset" @click="resetFilters">重置筛选</button>
      </div>
      <span class="source-result-count">`,
    "filter reset anchor must be unique",
  );
  review = once(
    review,
    `      <section v-for="group in groupedSources" :key="group.key" class="source-purpose-group">`,
    `      <section
        v-for="group in groupedSources"
        :key="group.key"
        class="source-purpose-group"
        :class="{
          'p48-mobile-group-hidden':
            selectedMobileSourceCode &&
            !group.items.some((entry) => entry.code === selectedMobileSourceCode),
        }"
      >`,
    "group anchor must be unique",
  );
  review = once(
    review,
    `            :data-availability="effectiveAvailability(item)"
          >`,
    `            :data-availability="effectiveAvailability(item)"
            :class="{
              'p48-mobile-selected': selectedMobileSourceCode === item.code,
              'p48-mobile-hidden':
                selectedMobileSourceCode && selectedMobileSourceCode !== item.code,
            }"
          >`,
    "record anchor must be unique",
  );
  review = once(
    review,
    `            </header>
            <p>
              {{ policyText(item) }}`,
    `            </header>
            <dl class="p48-mobile-record-summary" aria-label="来源摘要">
              <div>
                <dt>采集方式</dt>
                <dd>{{ modeText(item.access_mode) }}</dd>
              </div>
              <div>
                <dt>最近成功</dt>
                <dd>{{ successText(item) }}</dd>
              </div>
            </dl>
            <button
              v-show="!selectedMobileSourceCode"
              type="button"
              class="p48-mobile-detail-trigger"
              :aria-controls="\`p48-source-detail-\${item.code}\`"
              @click="openMobileSourceDetail(item.code, $event)"
            >
              查看来源详情
            </button>
            <div
              :id="\`p48-source-detail-\${item.code}\`"
              class="p48-source-record-body"
            >
              <button
                type="button"
                class="p48-mobile-detail-back"
                @click="closeMobileSourceDetail"
              >
                返回来源目录
              </button>
              <p>
              {{ policyText(item) }}`,
    "record body anchor must be unique",
  );
  review = once(
    review,
    `            </footer>
          </article>`,
    `            </footer>
            </div>
          </article>`,
    "record footer anchor must be unique",
  );
  return review;
}
