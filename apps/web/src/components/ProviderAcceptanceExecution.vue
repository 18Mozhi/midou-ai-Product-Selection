<script setup lang="ts">
import type { OrganizationMembershipSummary, WorkspaceSummary } from "@scoutops/contracts";
import type { AcceptanceRunOutcome } from "./provider-1688-acceptance-types";

defineProps<{
  organizations: OrganizationMembershipSummary[];
  workspaces: WorkspaceSummary[];
  organizationId: string;
  workspaceId: string;
  query: string;
  scopeLoading: boolean;
  scopeMessage: string;
  scopeRequestId: string;
  scopeRetryable: boolean;
  scheduling: boolean;
  canSchedule: boolean;
  runOutcome: AcceptanceRunOutcome | null;
}>();
const emit = defineEmits<{
  "update:organizationId": [value: string];
  "update:workspaceId": [value: string];
  "update:query": [value: string];
  "organization-change": [value: string];
  submit: [];
  "retry-scopes": [];
}>();

const outcomeTitle = (kind: AcceptanceRunOutcome["kind"]) =>
  ({
    submitting: "正在提交",
    scheduled: "已确认排队",
    failed: "提交未成功",
    unknown: "提交结果待核对",
  })[kind];
</script>

<template>
  <section class="acceptance-1688__start" aria-labelledby="acceptance-1688-start-title">
    <header>
      <div>
        <p>真实登录验收</p>
        <h3 id="acceptance-1688-start-title">发起一次受控浏览器运行</h3>
      </div>
      <small>只创建本次人工验收；不会启用来源或加入自动调度。</small>
    </header>
    <form class="acceptance-1688__execution-form" @submit.prevent="emit('submit')">
      <label
        ><span>组织</span
        ><select
          :value="organizationId"
          aria-label="组织"
          :disabled="scopeLoading || scheduling"
          @change="emit('organization-change', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">请选择组织</option>
          <option
            v-for="organization in organizations"
            :key="organization.id"
            :value="organization.id"
          >
            {{ organization.name }}
          </option>
        </select></label
      >
      <label
        ><span>工作区</span
        ><select
          :value="workspaceId"
          aria-label="工作区"
          :disabled="scopeLoading || scheduling"
          @change="emit('update:workspaceId', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">请选择工作区</option>
          <option v-for="workspace in workspaces" :key="workspace.id" :value="workspace.id">
            {{ workspace.name }}
          </option>
        </select></label
      >
      <label class="acceptance-1688__query"
        ><span>验收关键词</span
        ><input
          :value="query"
          type="text"
          aria-label="验收关键词"
          maxlength="200"
          autocomplete="off"
          placeholder="例如：桌面灯"
          :disabled="scheduling"
          @input="emit('update:query', ($event.target as HTMLInputElement).value)"
        /><small>最多 200 字；提交前会去除首尾空格。</small></label
      >
      <button class="acceptance-1688__start-button" type="submit" :disabled="!canSchedule">
        {{ scheduling ? "提交中…" : "发起登录验收运行" }}
      </button>
    </form>
    <div
      v-if="scopeLoading || scopeMessage"
      class="acceptance-1688__scope-feedback"
      :data-tone="scopeMessage ? 'danger' : 'neutral'"
      role="status"
      aria-live="polite"
    >
      <span>{{ scopeLoading ? "正在读取可用组织与工作区…" : scopeMessage }}</span>
      <button v-if="scopeRetryable && !scopeLoading" type="button" @click="emit('retry-scopes')">
        重新读取范围
      </button>
      <details v-if="scopeRequestId">
        <summary>组织范围追踪</summary>
        <code>关联编号：{{ scopeRequestId }}</code>
      </details>
    </div>
    <section
      v-if="runOutcome"
      class="acceptance-1688__run-feedback"
      :data-kind="runOutcome.kind"
      role="status"
      aria-live="polite"
    >
      <div>
        <p>本次提交状态</p>
        <h4>{{ outcomeTitle(runOutcome.kind) }}</h4>
        <p>{{ runOutcome.message }}</p>
      </div>
      <details v-if="runOutcome.requestId || runOutcome.taskId">
        <summary>本次提交追踪</summary>
        <code v-if="runOutcome.taskId">任务编号：{{ runOutcome.taskId }}</code
        ><code v-if="runOutcome.requestId">提交关联编号：{{ runOutcome.requestId }}</code>
      </details>
      <p v-if="runOutcome.kind === 'unknown'" class="acceptance-1688__unknown-note">
        请先查看下方最新运行记录；如结果仍不明确，勿重复提交。
      </p>
    </section>
  </section>
</template>
