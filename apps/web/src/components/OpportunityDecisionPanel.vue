<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { statusLabel } from "../ui/status-labels";
import type { OpportunityDetail } from "./opportunity-workspace-types";
import {
  countPassedOpportunityQualityGates,
  nextOpportunityQualityGateLabel,
  opportunityBlockerStatusLabel,
  opportunityDecisionCopy,
  opportunityQualityGateLabels,
} from "./opportunity-decision-presentation";
import { opportunityStatusLabel } from "./opportunity-workspace-presentation";
const props = defineProps<{
  detail: OpportunityDetail;
  busy: boolean;
  canDecide: boolean;
}>();
const emit = defineEmits<{
  decide: [action: "adopt" | "observe" | "reject"];
  createEvidenceTask: [];
}>();
const unresolvedBlockers = computed(() =>
  (props.detail.adoption_blockers ?? []).filter((item) => item.status !== "cleared"),
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
  () => selectionStage.value === "recommended" && qualityGates.value.all_passed,
);
const recommendationTitle = computed(() =>
  selectionStage.value === "not_eligible" && Number(props.detail.matched_rule_count ?? 0) === 0
    ? opportunityStatusLabel(props.detail.decision_status)
    : opportunityStatusLabel(selectionStage.value),
);
const passedGateCount = computed(() => countPassedOpportunityQualityGates(qualityGates.value));
const nextMissingGate = computed(() => nextOpportunityQualityGateLabel(qualityGates.value));
const recommendationCopy = computed(() =>
  opportunityDecisionCopy(canAdopt.value, selectionStage.value),
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
  <section class="opportunity-decision-summary" aria-labelledby="opportunity-decision-title">
    <header class="opportunity-decision-summary__lead">
      <div>
        <p>系统建议</p>
        <h3 id="opportunity-decision-title">{{ recommendationTitle }}</h3>
        <span>{{ recommendationCopy }}</span>
      </div>
      <dl aria-label="推荐判断摘要">
        <div>
          <dt>综合评分</dt>
          <dd>{{ detail.overall_score ?? "—" }}</dd>
        </div>
        <div>
          <dt>证据</dt>
          <dd>{{ detail.evidence_count }} 条 · {{ detail.source_count }} 源</dd>
        </div>
        <div>
          <dt>风险</dt>
          <dd>{{ opportunityStatusLabel(detail.risk_level) }}</dd>
        </div>
      </dl>
      <div class="opportunity-gate-progress" :data-ready="qualityGates.all_passed">
        <span>
          <b>五项质量门</b>
          <small>{{ passedGateCount }}/5 已通过</small>
        </span>
        <i aria-hidden="true">
          <b :style="{ width: `${passedGateCount * 20}%` }"></b>
        </i>
        <strong>{{ qualityGates.all_passed ? "全部通过" : `下一项：${nextMissingGate}` }}</strong>
      </div>
      <details class="opportunity-quality-gate-details">
        <summary>查看每项判断</summary>
        <ul class="opportunity-quality-gates" aria-label="五项质量门">
          <li
            v-for="(label, key) in opportunityQualityGateLabels"
            :key="key"
            :data-passed="qualityGates[key]"
          >
            <span>{{ label }}</span
            ><b>{{ qualityGates[key] ? "通过" : "待完成" }}</b>
          </li>
        </ul>
      </details>
    </header>
    <nav
      v-if="canDecide && canAdopt"
      id="opportunity-decision-actions"
      class="opportunity-decision-actions"
      aria-label="机会决策操作"
    >
      <button class="primary" :disabled="busy" @click="emit('decide', 'adopt')">采纳建议</button
      ><button @click="emit('decide', 'observe')">继续观察</button
      ><button class="reject" @click="emit('decide', 'reject')">驳回</button>
    </nav>
    <div v-else-if="canDecide" class="opportunity-decision-waiting" role="status">
      <span>
        <b>当前无需你处理</b>
        <small>系统会继续采集和计算；只有显示“建议采纳”后才进入你的最终采纳队列。</small>
      </span>
      <details>
        <summary>提前人工处理</summary>
        <nav aria-label="候选提前人工处理">
          <button type="button" @click="emit('decide', 'observe')">继续观察</button>
          <button type="button" class="reject" @click="emit('decide', 'reject')">驳回</button>
        </nav>
      </details>
    </div>
    <p v-else class="opportunity-decision-readonly" role="status">
      当前角色可查看判断依据；最终决定需要“机会决策”权限。
    </p>
    <section v-if="unresolvedBlockers.length" class="opportunity-decision-gap">
      <div>
        <strong>仍有 {{ unresolvedBlockers.length }} 个补证阻断项</strong>
        <span>{{ unresolvedBlockers[0]?.next_action }}</span>
      </div>
      <RouterLink
        v-if="unresolvedBlockers[0]?.task_id"
        :to="`/tasks?task=${unresolvedBlockers[0].task_id}`"
        >查看补采任务</RouterLink
      ><button
        v-else-if="canDecide"
        type="button"
        :disabled="busy"
        @click="emit('createEvidenceTask')"
      >
        创建补采任务
      </button>
    </section>
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
        <RouterLink v-if="blocker.task_id" :to="`/tasks?task=${blocker.task_id}`"
          >查看任务</RouterLink
        >
      </article>
    </details>
  </section>
</template>
