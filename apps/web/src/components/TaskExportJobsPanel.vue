<script setup lang="ts">
import { RouterLink } from "vue-router";
import type { TaskExport } from "./task-workspace-types";

defineProps<{
  items: TaskExport[];
  formatTime: (value: string | null) => string;
}>();

const statusLabel = (value: string) =>
    (
      ({
        queued: "排队中",
        leased: "生成中",
        retry_scheduled: "等待重试",
        succeeded: "已完成",
        dead_letter: "生成失败",
        expired: "已过期",
      }) as Record<string, string>
    )[value] ?? "状态待确认",
  typeLabel = (value: TaskExport["report_type"]) =>
    ({ opportunity: "机会分析", trend: "趋势分析", team: "团队绩效" })[value],
  nextStep = (item: TaskExport, formatTime: (value: string | null) => string) =>
    item.status === "succeeded"
      ? "前往报表页下载文件"
      : ["dead_letter", "expired"].includes(item.status)
        ? "前往报表页重新生成"
        : item.queue_position == null
          ? "系统正在异步处理，无需停留等待"
          : item.estimated_completion_at
            ? `队列第 ${item.queue_position} 位 · 预计 ${formatTime(item.estimated_completion_at)} 完成`
            : `队列第 ${item.queue_position} 位 · 暂无历史样本可估算`;
</script>

<template>
  <section class="task-export-jobs" aria-labelledby="task-export-heading">
    <header class="task-export-heading">
      <div>
        <span>异步工作 · 状态只读</span>
        <h3 id="task-export-heading">导出任务</h3>
        <p>查看已有导出的处理进度；创建、重试与下载请前往报表中心。</p>
      </div>
      <RouterLink to="/reports">打开报表中心</RouterLink>
    </header>
    <ul v-if="items.length" class="task-export-list" aria-label="导出任务记录">
      <li v-for="item in items" :key="item.id" class="task-export-item">
        <span class="task-export-status" :data-status="item.status">
          {{ statusLabel(item.status) }}
        </span>
        <div class="task-export-type">
          <strong>{{ typeLabel(item.report_type) }} · CSV</strong>
          <p>{{ nextStep(item, formatTime) }}</p>
        </div>
        <div class="task-export-updated">
          <strong>{{ formatTime(item.updated_at) }}</strong>
          <span>最近更新</span>
        </div>
        <RouterLink
          class="task-export-open"
          :to="{ path: '/reports', query: { report: item.report_type } }"
        >
          查看任务
        </RouterLink>
      </li>
    </ul>
    <div v-else class="task-export-empty" role="status">
      <h4>尚无导出任务</h4>
      <p>从报表页提交 CSV 导出后，会在这里统一显示处理状态。</p>
      <RouterLink to="/reports">前往报表中心</RouterLink>
    </div>
  </section>
</template>
