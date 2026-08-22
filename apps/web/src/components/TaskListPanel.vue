<script setup lang="ts">
import type { Task } from "./task-workspace-types";

defineProps<{
  tasks: Task[];
  selectedIds: string[];
  status: string;
  routeFullPath: string;
  label: (value: string) => string;
  phase: (task: Task) => string;
  time: (value: string | null) => string;
}>();

const emit = defineEmits<{
  "update:selectedIds": [ids: string[]];
  status: [value: string];
  remove: [task: Task];
}>();

const toggle = (id: string, checked: boolean, selectedIds: string[]) =>
  emit(
    "update:selectedIds",
    checked ? [...selectedIds, id] : selectedIds.filter((value) => value !== id),
  );
</script>

<template>
  <div class="task-filter">
    <button
      v-for="item in [
        { value: '', label: '全部' },
        { value: 'todo', label: '待处理' },
        { value: 'in_progress', label: '进行中' },
        { value: 'paused', label: '已暂停' },
        { value: 'completed', label: '已完成' },
      ]"
      :key="item.value"
      :aria-pressed="status === item.value"
      @click="$emit('status', item.value)"
    >
      {{ item.label }}
    </button>
  </div>
  <section v-if="!tasks.length" class="task-state">
    <h3>当前没有任务</h3>
    <p>创建任务后会在此显示；系统不会填充示例业务数据。</p>
  </section>
  <div v-else class="task-list">
    <article v-for="task in tasks" :key="task.id">
      <label class="task-row-select"
        ><input
          type="checkbox"
          :value="task.id"
          :checked="selectedIds.includes(task.id)"
          @change="toggle(task.id, ($event.target as HTMLInputElement).checked, selectedIds)"
        /><span class="sr-only">选择任务：{{ task.title }}</span></label
      >
      <RouterLink
        class="task-row-main"
        :to="{ path: `/tasks/${task.id}`, query: { from: routeFullPath } }"
      >
        <i :data-priority="task.priority"></i
        ><span
          ><strong>{{ task.title }}</strong
          ><small>{{ task.description || "无补充说明" }}</small></span
        ><em>{{ label(task.status) }}</em
        ><span class="task-progress"
          ><b>{{ phase(task) }}</b
          ><i><u :style="{ width: `${task.progress_percent || 0}%` }"></u></i></span
        ><span
          ><strong>{{ label(task.sla_status) }}</strong
          ><small>{{ time(task.due_at) }}</small></span
        ><b>查看详情 →</b>
      </RouterLink>
      <details class="task-row-actions">
        <summary :aria-label="`任务操作：${task.title}`">•••</summary>
        <button type="button" @click="$emit('remove', task)">删除任务</button>
      </details>
    </article>
  </div>
</template>
