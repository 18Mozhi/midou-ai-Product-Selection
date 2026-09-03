<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { statusLabel } from "../ui/status-labels";
import type { OpportunityDetail } from "./opportunity-workspace-types";
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

const opportunityStatus = (value: string) =>
  (
    ({
      evidence_insufficient: "缺少可采纳证据",
      recommendation_insufficient: "尚无可靠推荐结论",
    }) as Record<string, string>
  )[value] ?? value;
const blockerStatus = (value: "blocked" | "in_progress" | "cleared") =>
  ({ blocked: "仍在阻断", in_progress: "解除中", cleared: "已解除" })[value];

const unresolvedBlockers = computed(() =>
  (props.detail.adoption_blockers ?? []).filter((item) => item.status !== "cleared"),
);
const canAdopt = computed(
  () =>
    props.detail.recommendation_status !== "insufficient_data" &&
    props.detail.coverage_status !== "insufficient" &&
    props.detail.evidence_count > 0,
);
const recommendationCopy = computed(() =>
  canAdopt.value
    ? "系统已完成规则判断和证据校验，最终是否采纳由你决定。"
    : `系统还在补齐 ${unresolvedBlockers.value.length || 1} 项关键信息，暂不建议采纳。`,
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
        <h3 id="opportunity-decision-title">
          {{ opportunityStatusLabel(detail.recommendation_status) }}
        </h3>
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
    </header>
    <nav
      v-if="canDecide"
      id="opportunity-decision-actions"
      class="opportunity-decision-actions"
      aria-label="机会决策操作"
    >
      <button
        class="primary"
        :disabled="!canAdopt"
        :title="canAdopt ? '采纳当前推荐' : '证据不足，先补齐缺失项'"
        @click="emit('decide', 'adopt')"
      >
        采纳推荐</button
      ><button @click="emit('decide', 'observe')">继续观察</button
      ><button class="reject" @click="emit('decide', 'reject')">驳回</button>
    </nav>
    <p v-else class="opportunity-decision-readonly" role="status">
      当前角色可查看判断依据；最终决定需要“机会决策”权限。
    </p>
    <section v-if="unresolvedBlockers.length" class="opportunity-decision-gap">
      <div>
        <strong>采纳前还缺 {{ unresolvedBlockers.length }} 项</strong>
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
          <strong>{{ opportunityStatus(blocker.code) }}</strong>
          <span>{{ blockerStatus(blocker.status) }} · {{ blocker.next_action }}</span>
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
