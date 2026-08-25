<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { Task } from "./task-workspace-types";

const props = defineProps<{
  tasks: Task[];
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
  );

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
      <button type="submit">查询</button>
      <button type="button" @click="$emit('resetFilters')">重置</button>
    </form>
    <div class="task-filter" aria-label="任务状态筛选">
      <button
        v-for="item in [
          { value: '', label: '全部' },
          { value: 'todo', label: '待处理' },
          { value: 'in_progress', label: '进行中' },
          { value: 'paused', label: '已暂停' },
          { value: 'completed', label: '已完成' },
          { value: 'cancelled', label: '已取消' },
        ]"
        :key="item.value"
        :aria-pressed="status === item.value"
        @click="$emit('status', item.value)"
      >
        {{ item.label }}
      </button>
    </div>
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
          : "创建任务后会在此显示；系统不会填充示例业务数据。"
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
      <details v-if="canUpdate" class="task-row-actions">
        <summary :aria-label="`任务操作：${task.title}`">•••</summary>
        <button type="button" @click="$emit('remove', task)">删除任务</button>
      </details>
    </article>
  </div>
</template>
