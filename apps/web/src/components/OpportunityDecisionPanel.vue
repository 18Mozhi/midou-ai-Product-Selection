<script setup lang="ts">
import { computed } from "vue";
import { statusLabel } from "../ui/status-labels";
import type { OpportunityDetail } from "./opportunity-workspace-types";
import {
  countPassedOpportunityQualityGates,
  opportunityAnalysisCompletedAt,
  nextOpportunityQualityGateLabel,
  opportunityBlockerStatusLabel,
  opportunityDecisionCopy,
  opportunityQualityGatesPassed,
} from "./opportunity-decision-presentation";
import { opportunityStatusLabel } from "./opportunity-workspace-presentation";
import SelectionAnalysisCompletion from "./SelectionAnalysisCompletion.vue";
import OpportunityQualityGateDetails from "./OpportunityQualityGateDetails.vue";
const props = defineProps<{
  detail: OpportunityDetail;
  busy: boolean;
  canDecide: boolean;
}>();
const emit = defineEmits<{
  decide: [action: "adopt" | "observe" | "reject"];
}>();
const unresolvedBlockers = computed(() =>
  (props.detail.adoption_blockers ?? []).filter((item) => item.status !== "cleared"),
);
const analysisCompletedAt = computed(() =>
  opportunityAnalysisCompletedAt(props.detail.analysis_completed_at),
);
const qualityGates = computed(
  () =>
    props.detail.quality_gates ?? {
      score: false,
      market: false,
      competition: false,
      cost: false,
      risk: false,
      all_passed: false,
    },
);
const selectionStage = computed(
  () =>
    props.detail.selection_stage ??
    (props.detail.matched_rule_count > 0 ? "rule_candidate" : "not_eligible"),
);
const canAdopt = computed(
  () => selectionStage.value === "recommended" && opportunityQualityGatesPassed(qualityGates.value),
);
const recommendationTitle = computed(() =>
  selectionStage.value === "not_eligible" && Number(props.detail.matched_rule_count ?? 0) === 0
    ? opportunityStatusLabel(props.detail.decision_status)
    : opportunityStatusLabel(selectionStage.value),
);
const passedGateCount = computed(() => countPassedOpportunityQualityGates(qualityGates.value));
const nextMissingGate = computed(() => nextOpportunityQualityGateLabel(qualityGates.value));
const recommendationCopy = computed(() =>
  analysisCompletedAt.value
    ? "已完成商品分析，当前建议与采纳条件按最新资料显示。"
    : opportunityDecisionCopy(canAdopt.value, selectionStage.value),
);
</script>
<template>
  <section v-if="detail.redecision_ready" class="opportunity-redecision-ready" role="status">
    <div>
      <strong>补采与重新评分已完成</strong>
      <span>请核对最新证据、阻断状态和评分后重新决策。</span>
    </div>
    <a href="#opportunity-decision-actions">前往决策</a>
  </section>
  <section
    class="opportunity-decision-summary"
    aria-labelledby="opportunity-decision-summary-title"
  >
    <SelectionAnalysisCompletion v-if="analysisCompletedAt" :completed-at="analysisCompletedAt" />
    <header class="opportunity-decision-summary__lead">
      <div>
        <h3 id="opportunity-decision-summary-title">{{ recommendationTitle }}</h3>
        <span>{{ recommendationCopy }}</span>
      </div>
      <div class="opportunity-gate-progress" :data-ready="qualityGates.all_passed">
        <span>
          <b>{{ analysisCompletedAt ? "采纳条件" : "五项质量门" }}</b>
          <small>{{ passedGateCount }}/5 已通过</small>
        </span>
        <i aria-hidden="true">
          <b :style="{ width: `${passedGateCount * 20}%` }"></b>
        </i>
        <strong>{{
          qualityGates.all_passed
            ? "全部通过"
            : `${analysisCompletedAt ? "待满足" : "下一项"}：${nextMissingGate}`
        }}</strong>
      </div>
    </header>
    <div class="opportunity-decision-summary__statusline">
      <section v-if="unresolvedBlockers.length" class="opportunity-decision-gap">
        <div>
          <strong>{{
            analysisCompletedAt
              ? `当前采纳限制 ${unresolvedBlockers.length} 项`
              : `仍有 ${unresolvedBlockers.length} 个补证阻断项`
          }}</strong>
          <span>{{ unresolvedBlockers[0]?.next_action }}</span>
        </div>
      </section>
      <nav
        v-if="canDecide && canAdopt"
        id="opportunity-decision-actions"
        class="opportunity-decision-actions"
        aria-label="选品决策操作"
      >
        <button class="primary" :disabled="busy" @click="emit('decide', 'adopt')">采纳建议</button
        ><button @click="emit('decide', 'observe')">继续观察</button
        ><button class="reject" @click="emit('decide', 'reject')">驳回</button>
      </nav>
      <div
        v-else-if="canDecide"
        id="opportunity-decision-actions"
        class="opportunity-decision-waiting"
        role="status"
      >
        <span>
          <b>{{ analysisCompletedAt ? "可查看分析结果" : "当前无需你处理" }}</b>
          <small>{{
            analysisCompletedAt
              ? "当前仍有采纳条件未满足，缺失项和判断依据继续保留。"
              : "证据齐备并通过评分后，会更新选品建议；当前处理状态见下方。"
          }}</small>
        </span>
        <details>
          <summary>提前人工处理</summary>
          <nav aria-label="候选提前人工处理">
            <button type="button" @click="emit('decide', 'observe')">继续观察</button>
            <button type="button" class="reject" @click="emit('decide', 'reject')">驳回</button>
          </nav>
        </details>
      </div>
      <p
        v-else
        id="opportunity-decision-actions"
        class="opportunity-decision-readonly"
        role="status"
      >
        当前角色可查看判断依据；最终决定需要“选品决策”权限。
      </p>
    </div>
    <footer class="opportunity-decision-summary__details">
      <OpportunityQualityGateDetails :quality-gates="qualityGates" />
      <details v-if="detail.adoption_blockers?.length" class="opportunity-blocker-details">
        <summary>查看判断条件与补证进度</summary>
        <article
          v-for="blocker in detail.adoption_blockers"
          :key="blocker.code"
          :data-status="blocker.status"
        >
          <div>
            <strong>{{ opportunityStatusLabel(blocker.code) }}</strong>
            <span
              >{{ opportunityBlockerStatusLabel(blocker.status) }} · {{ blocker.next_action }}</span
            >
            <small v-if="blocker.progress_percent != null"
              >补采任务进度 {{ blocker.progress_percent }}%</small
            ><small v-if="blocker.score_job_status"
              >评分任务 {{ statusLabel(blocker.score_job_status) }}</small
            >
          </div>
        </article>
      </details>
    </footer>
  </section>
</template>

<style src="./opportunity-decision-panel.css"></style>
