<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { formatOpportunityTime as freshness } from "./opportunity-workspace-presentation";
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
        <p>可追溯证据</p>
        <h4>证据管理</h4>
      </div>
      <span>{{ evidence.length }} 条</span>
    </header>
    <p v-if="!evidence.length" class="opportunity-empty-copy">当前机会尚无关联证据。</p>
    <a
      v-for="item in visibleEvidence"
      :key="item.id"
      :href="item.canonical_url"
      target="_blank"
      rel="noopener noreferrer"
      ><span
        ><strong>{{ item.title }}</strong
        ><small
          >{{ item.publisher }} · 证据新鲜度：观测于 {{ freshness(item.observed_at) }}</small
        ></span
      ><b>查看原文 ↗</b></a
    >
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
