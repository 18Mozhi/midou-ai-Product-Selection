<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { Task, TaskSummary } from "./task-workspace-types";

const props = defineProps<{
  tasks: Task[];
  summary: TaskSummary;
  selectedIds: string[];
  status: string;
  query: string;
  sort: string;
  canCreate: boolean;
  canUpdate: boolean;
  routeFullPath: string;
  label: (value: string) => string;
  phase: (task: Task) => string;
  time: (value: string | null) => string;
}>();

const emit = defineEmits<{
  "update:selectedIds": [ids: string[]];
  status: [value: string];
  applyFilters: [value: { query: string; sort: string }];
  resetFilters: [];
  create: [];
  remove: [task: Task];
}>();

const draftQuery = ref(props.query),
  allCurrentSelected = computed(
    () =>
      props.tasks.length > 0 && props.tasks.every((task) => props.selectedIds.includes(task.id)),
  ),
  statusOptions = computed(() => [
    {
      value: "",
      label: "全部",
      count:
        props.summary.todo +
        props.summary.in_progress +
        props.summary.paused +
        props.summary.completed +
        props.summary.cancelled,
    },
    { value: "todo", label: "待处理", count: props.summary.todo },
    { value: "in_progress", label: "进行中", count: props.summary.in_progress },
    { value: "paused", label: "已暂停", count: props.summary.paused },
    { value: "completed", label: "已完成", count: props.summary.completed },
    { value: "cancelled", label: "已取消", count: props.summary.cancelled },
  ]),
  hasAdvancedFilter = computed(() => Boolean(props.query || props.sort !== "priority_due"));

watch(
  () => props.query,
  (value) => (draftQuery.value = value),
);

const toggle = (id: string, checked: boolean, selectedIds: string[]) =>
  emit(
    "update:selectedIds",
    checked ? [...selectedIds, id] : selectedIds.filter((value) => value !== id),
  );
</script>

<template>
  <div class="task-filter-panel">
    <div class="task-queue-heading">
      <div><span>当前队列</span><strong>先处理逾期与高优先级任务</strong></div>
      <small>状态数量来自当前工作区任务事实</small>
    </div>
    <nav class="task-filter" aria-label="任务状态筛选">
      <button
        v-for="item in statusOptions"
        :key="item.value"
        :aria-pressed="status === item.value"
        @click="$emit('status', item.value)"
      >
        <span>{{ item.label }}</span
        ><b>{{ item.count }}</b>
      </button>
    </nav>
    <details class="task-filter-disclosure" :open="hasAdvancedFilter">
      <summary>
        <span>搜索与排序</span>
        <small v-if="hasAdvancedFilter">已应用条件</small>
        <small v-else>按需展开</small>
      </summary>
      <form
        class="task-search"
        role="search"
        @submit.prevent="$emit('applyFilters', { query: draftQuery.trim(), sort })"
      >
        <label>
          <span>搜索任务</span>
          <input v-model="draftQuery" maxlength="200" placeholder="搜索标题或说明" />
        </label>
        <label>
          <span>排序</span>
          <select
            :value="sort"
            @change="
              $emit('applyFilters', {
                query: draftQuery.trim(),
                sort: ($event.target as HTMLSelectElement).value,
              })
            "
          >
            <option value="priority_due">优先级与期限</option>
            <option value="due_asc">截止时间最早</option>
            <option value="updated_desc">最近更新</option>
            <option value="created_desc">最近创建</option>
          </select>
        </label>
        <button type="submit">应用</button>
        <button type="button" @click="$emit('resetFilters')">重置</button>
      </form>
    </details>
    <div v-if="canUpdate && tasks.length" class="task-select-current">
      <label
        ><input
          type="checkbox"
          :checked="allCurrentSelected"
          @change="
            $emit(
              'update:selectedIds',
              ($event.target as HTMLInputElement).checked ? tasks.map((task) => task.id) : [],
            )
          "
        />选择本页 {{ tasks.length }} 项</label
      >
      <button v-if="selectedIds.length" type="button" @click="$emit('update:selectedIds', [])">
        清除选择
      </button>
    </div>
  </div>
  <section v-if="!tasks.length" class="task-state">
    <h3>{{ query || status ? "没有符合条件的任务" : "当前没有任务" }}</h3>
    <p>
      {{
        query || status
          ? "调整筛选条件后重试，或重置查看全部任务。"
          : "创建任务后，任务状态与处理进度会显示在这里。"
      }}
    </p>
    <button v-if="query || status" type="button" @click="$emit('resetFilters')">重置筛选</button>
    <button v-else-if="canCreate" type="button" @click="$emit('create')">新建任务</button>
  </section>
  <div v-else class="task-list" :class="{ 'task-list-readonly': !canUpdate }">
    <article v-for="task in tasks" :key="task.id">
      <label v-if="canUpdate" class="task-row-select"
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
        ><span class="task-row-copy"
          ><span class="task-row-kicker"
            ><em>{{ label(task.status) }}</em
            ><small>{{ label(task.priority) }}优先级</small></span
          ><strong>{{ task.title }}</strong
          ><small>{{ task.description || "无补充说明" }}</small></span
        ><span class="task-row-progress"
          ><span
            ><b>{{ phase(task) }}</b
            ><small>{{ task.progress_percent || 0 }}%</small></span
          ><i><u :style="{ width: `${task.progress_percent || 0}%` }"></u></i></span
        ><span class="task-row-deadline"
          ><strong>{{ label(task.sla_status) }}</strong
          ><small>{{ time(task.due_at) }}</small></span
        ><b class="task-row-link">查看 →</b>
      </RouterLink>
      <details v-if="canUpdate" class="task-row-actions">
        <summary :aria-label="`任务操作：${task.title}`">•••</summary>
        <button type="button" @click="$emit('remove', task)">删除任务</button>
      </details>
    </article>
  </div>
</template>
