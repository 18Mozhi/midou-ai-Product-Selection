<script setup lang="ts">
import { RouterLink } from "vue-router";
import { statusLabel } from "../ui/status-labels";
import type { OpportunityDetail } from "./opportunity-workspace-types";

defineProps<{
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
</script>

<template>
  <section v-if="detail.redecision_ready" class="opportunity-redecision-ready" role="status">
    <div>
      <strong>补采与重新评分已完成</strong>
      <span>请核对最新证据、阻断状态和评分后重新决策。</span>
    </div>
    <a href="#opportunity-decision-actions">前往决策</a>
  </section>
  <section class="opportunity-blocker-summary" aria-labelledby="opportunity-blocker-title">
    <header>
      <div>
        <p>采纳阻断</p>
        <h4 id="opportunity-blocker-title">阻断项与解除进度</h4>
      </div>
      <strong
        >{{
          (detail.adoption_blockers ?? []).filter((item) => item.status !== "cleared").length
        }}
        项未解除</strong
      >
    </header>
    <article
      v-for="blocker in detail.adoption_blockers ?? []"
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
        >查看补采任务</RouterLink
      ><button
        v-else-if="canDecide && blocker.status !== 'cleared'"
        type="button"
        :disabled="busy"
        @click="emit('createEvidenceTask')"
      >
        创建补采任务
      </button>
    </article>
  </section>
  <nav
    v-if="canDecide"
    id="opportunity-decision-actions"
    class="opportunity-decision-bar"
    aria-label="机会决策操作"
  >
    <button
      :disabled="
        detail.recommendation_status === 'insufficient_data' ||
        detail.coverage_status === 'insufficient' ||
        detail.evidence_count === 0
      "
      :title="
        detail.recommendation_status === 'insufficient_data' ||
        detail.coverage_status === 'insufficient' ||
        detail.evidence_count === 0
          ? '证据不足，先补齐缺失项'
          : '采纳当前机会'
      "
      @click="emit('decide', 'adopt')"
    >
      采纳</button
    ><button @click="emit('decide', 'observe')">继续观察</button
    ><button class="reject" @click="emit('decide', 'reject')">驳回</button>
    <button
      v-if="
        detail.recommendation_status === 'insufficient_data' ||
        detail.coverage_status === 'insufficient'
      "
      type="button"
      :disabled="busy"
      @click="emit('createEvidenceTask')"
    >
      生成补数任务
    </button>
  </nav>
  <aside v-else class="opportunity-decision-bar" role="status">
    当前角色为只读机会视图；决策、补数和状态变更需要“机会决策”权限。
  </aside>
</template>
