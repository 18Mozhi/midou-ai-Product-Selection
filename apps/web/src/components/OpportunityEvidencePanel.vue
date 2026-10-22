<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { OpportunityDetail } from "./opportunity-workspace-types";

const EVIDENCE_BATCH_SIZE = 20;
const props = defineProps<{
  evidence: OpportunityDetail["evidence"];
  opportunityId: string;
}>();
const visibleCount = ref(EVIDENCE_BATCH_SIZE);
const visibleEvidence = computed(() => props.evidence.slice(0, visibleCount.value));
const hiddenCount = computed(() =>
  Math.max(0, props.evidence.length - visibleEvidence.value.length),
);

function showMore() {
  visibleCount.value = Math.min(props.evidence.length, visibleCount.value + EVIDENCE_BATCH_SIZE);
}
function collapse() {
  visibleCount.value = EVIDENCE_BATCH_SIZE;
}
watch([() => props.opportunityId, () => props.evidence], () => collapse());
</script>

<template>
  <section class="opportunity-evidence">
    <header>
      <div>
        <p>关联情报</p>
        <h4>情报原文</h4>
      </div>
      <span>{{ evidence.length }} 条</span>
    </header>
    <p class="evidence-table-note">
      仅展示当前选品关联的原文。关联编号与原始证据编号分别保留，不将关联条数视为评分已使用的证据数。
    </p>
    <p v-if="!evidence.length" class="opportunity-empty-copy">当前选品尚无关联证据。</p>
    <div v-else class="evidence-table-scroll" tabindex="0" aria-label="横向滚动情报原文表">
      <table>
        <caption class="so-visually-hidden">
          当前选品关联情报原文与证据编号
        </caption>
        <thead>
          <tr>
            <th scope="col">情报原文</th>
            <th scope="col">发布方</th>
            <th scope="col">观测时间（原始时间）</th>
            <th scope="col">证据编号</th>
            <th scope="col">原文</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in visibleEvidence" :key="item.id">
            <th scope="row">
              <strong>{{ item.title || "标题未提供" }}</strong>
            </th>
            <td data-label="发布方">{{ item.publisher || "未知" }}</td>
            <td data-label="观测时间">
              <time v-if="item.observed_at" :datetime="item.observed_at">{{
                item.observed_at
              }}</time
              ><span v-else>未知</span>
            </td>
            <td data-label="证据编号">
              <details>
                <summary>查看编号</summary>
                <p>
                  关联编号：<code>{{ item.id || "未知" }}</code>
                </p>
                <p>
                  原始证据编号：<code>{{ item.raw_evidence_id || "未知" }}</code>
                </p>
              </details>
            </td>
            <td data-label="原文">
              <a
                v-if="item.canonical_url"
                :href="item.canonical_url"
                target="_blank"
                rel="noopener noreferrer"
                :aria-label="`查看原文：${item.title}`"
                >查看原文 ↗</a
              ><span v-else>原文地址未提供</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <footer
      v-if="evidence.length > EVIDENCE_BATCH_SIZE"
      class="opportunity-pagination"
      aria-label="证据显示范围"
    >
      <span>已显示 {{ visibleEvidence.length }} / {{ evidence.length }} 条</span>
      <button v-if="visibleEvidence.length > EVIDENCE_BATCH_SIZE" type="button" @click="collapse">
        收起到最新 {{ EVIDENCE_BATCH_SIZE }} 条
      </button>
      <button v-if="hiddenCount" type="button" @click="showMore">
        继续显示 {{ Math.min(EVIDENCE_BATCH_SIZE, hiddenCount) }} 条（剩余 {{ hiddenCount }} 条）
      </button>
    </footer>
  </section>
</template>

<style scoped>
.opportunity-evidence {
  color: var(--so-text);
  background: var(--so-panel);
  border-radius: 4px;
  box-shadow: none;
}
.opportunity-evidence > header {
  gap: 16px;
  margin-bottom: 12px;
}
.opportunity-evidence h4 {
  margin: 4px 0 0;
}
.opportunity-evidence .evidence-table-note {
  margin: 0 0 16px;
  color: var(--so-text-muted);
  font-weight: 400;
  letter-spacing: normal;
  line-height: 1.6;
}
.evidence-table-scroll {
  overflow-x: auto;
}
.evidence-table-scroll:focus-visible {
  outline: 2px solid var(--so-primary);
  outline-offset: 2px;
}
.evidence-table-scroll table {
  width: 100%;
  min-width: 820px;
  border-collapse: collapse;
  text-align: left;
  font-size: 13px;
}
.evidence-table-scroll :is(th, td) {
  padding: 12px 14px;
  border-bottom: 1px solid var(--so-border);
  vertical-align: top;
  overflow-wrap: anywhere;
}
.evidence-table-scroll thead {
  color: var(--so-text-muted);
  background: var(--so-panel-soft);
}
.evidence-table-scroll tbody th {
  width: 34%;
  font-weight: 400;
}
.evidence-table-scroll strong {
  font-weight: 500;
}
.evidence-table-scroll a {
  color: var(--so-primary);
  text-underline-offset: 3px;
}
.evidence-table-scroll summary {
  cursor: pointer;
  color: var(--so-primary);
}
.opportunity-evidence .evidence-table-scroll p {
  margin: 8px 0;
  font-weight: 400;
  color: var(--so-text);
  letter-spacing: normal;
  line-height: 1.6;
}
.evidence-table-scroll code {
  white-space: normal;
  overflow-wrap: anywhere;
}
.opportunity-evidence footer {
  flex-wrap: wrap;
}
@media (max-width: 760px) {
  .evidence-table-scroll {
    overflow: visible;
  }
  .evidence-table-scroll table {
    display: block;
    min-width: 0;
  }
  .evidence-table-scroll thead {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .evidence-table-scroll tbody {
    display: block;
  }
  .evidence-table-scroll tbody tr {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    padding: 14px 0;
    border-bottom: 1px solid var(--so-border);
  }
  .evidence-table-scroll tbody th {
    grid-column: 1 / -1;
    width: auto;
  }
  .evidence-table-scroll :is(th, td) {
    min-width: 0;
    padding: 0;
    border: 0;
  }
  .evidence-table-scroll td::before {
    content: attr(data-label);
    display: block;
    margin-bottom: 5px;
    color: var(--so-text-muted);
  }
  .evidence-table-scroll td[data-label="证据编号"],
  .evidence-table-scroll td[data-label="原文"] {
    grid-column: 1 / -1;
  }
}
</style>
