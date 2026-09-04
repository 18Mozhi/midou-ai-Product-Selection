<script setup lang="ts">
import type { ApprovalItem } from "./approval-workspace-types";

defineProps<{
  approvals: ApprovalItem[];
  queue: "decidable" | "requested";
  filter: string;
  canManage: boolean;
  publishedCount: number;
  statusText: (value: string) => string;
  resourceText: (value: string) => string;
  time: (value: string | null) => string;
}>();

defineEmits<{
  queue: [value: "decidable" | "requested"];
  filter: [value: string];
  open: [item: ApprovalItem];
  createRequest: [];
  manageTemplates: [];
}>();

const statusOptions = [
  { value: "pending", label: "审批中" },
  { value: "approved", label: "已批准" },
  { value: "rejected", label: "已驳回" },
  { value: "", label: "全部" },
];
</script>

<template>
  <section class="approval-queue-panel" aria-label="审批队列">
    <div class="approval-queue-toolbar">
      <nav class="approval-inbox-tabs" aria-label="审批范围">
        <button :aria-pressed="queue === 'decidable'" @click="$emit('queue', 'decidable')">
          待我处理
        </button>
        <button :aria-pressed="queue === 'requested'" @click="$emit('queue', 'requested')">
          我发起的
        </button>
      </nav>
      <nav class="approval-status-filter" aria-label="审批状态">
        <button
          v-for="item in statusOptions"
          :key="item.value"
          :aria-pressed="filter === item.value"
          @click="$emit('filter', item.value)"
        >
          {{ item.label }}
        </button>
      </nav>
    </div>
    <section v-if="!approvals.length" class="approval-state">
      <h3>{{ queue === "decidable" ? "目前没有需要你审批的事项" : "你发起的审批暂未有记录" }}</h3>
      <p v-if="queue === 'decidable'">新审批到达当前节点后会出现在这里。</p>
      <p v-else-if="publishedCount">需要复核任务或机会决策时，可以从已发布模板发起。</p>
      <p v-else>先发布一个审批模板，再发起需要人工判断的流程。</p>
      <div v-if="canManage" class="approval-empty-actions">
        <button v-if="publishedCount" type="button" @click="$emit('createRequest')">
          发起审批
        </button>
        <button v-else class="secondary" type="button" @click="$emit('manageTemplates')">
          配置模板
        </button>
      </div>
    </section>
    <div v-else class="approval-list">
      <button v-for="item in approvals" :key="item.id" @click="$emit('open', item)">
        <span class="approval-mark" aria-hidden="true">{{ item.current_node_ordinal }}</span>
        <span class="approval-row-copy">
          <span class="approval-row-kicker">
            <em :data-status="item.status">{{ statusText(item.status) }}</em>
            <small v-if="item.can_decide">需要你处理</small>
            <small v-else>{{ resourceText(item.resource_type) }}</small>
          </span>
          <strong>{{ item.title }}</strong>
          <small>{{ item.template_name }} · {{ item.current_node_name || "流程已结束" }}</small>
        </span>
        <span class="approval-row-due" :data-overdue="Boolean(item.escalated_at)">
          <small>{{ item.escalated_at ? "节点已升级" : "处理期限" }}</small>
          <strong>{{ item.escalated_at ? "已转交超时接收人" : time(item.due_at) }}</strong>
        </span>
        <b class="approval-row-link">查看 →</b>
      </button>
    </div>
  </section>
</template>
