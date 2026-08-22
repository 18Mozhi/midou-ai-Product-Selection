<script setup lang="ts">
import ResponsiveFilterDrawer from "./ResponsiveFilterDrawer.vue";
import type { TrendFilters, TrendSort } from "./trend-workspace-types";

const props = defineProps<{ filters: TrendFilters; sort: TrendSort; activeCount: number }>();
const emit = defineEmits<{
  apply: [];
  clear: [];
  saveView: [];
  updateFilters: [filters: TrendFilters];
  updateSort: [sort: TrendSort];
}>();
const updateFilter = (key: keyof TrendFilters, event: Event) =>
  emit("updateFilters", {
    ...props.filters,
    [key]: (event.target as HTMLInputElement | HTMLSelectElement).value,
  });
</script>

<template>
  <ResponsiveFilterDrawer label="筛选趋势" :active-count="activeCount">
    <form class="trend-filters" @submit.prevent="emit('apply')">
      <label
        >市场<select :value="filters.market" @change="updateFilter('market', $event)">
          <option value="">全部市场</option>
          <option value="US">US</option>
        </select></label
      ><label
        >分类<input
          :value="filters.category"
          maxlength="80"
          placeholder="全部分类"
          @input="updateFilter('category', $event)" /></label
      ><label
        >状态<select :value="filters.status" @change="updateFilter('status', $event)">
          <option value="active">活跃</option>
          <option value="irrelevant">已标记无关</option>
          <option value="stale">已过期</option>
          <option value="">全部状态</option>
        </select></label
      ><label class="search"
        >关键词<input
          :value="filters.q"
          maxlength="200"
          placeholder="搜索主题或关键词"
          @input="updateFilter('q', $event)" /></label
      ><label
        >排序<select
          :value="sort"
          @change="emit('updateSort', ($event.target as HTMLSelectElement).value as TrendSort)"
        >
          <option value="impact">影响程度</option>
          <option value="latest">最新信号</option>
          <option value="momentum">增长速度</option>
          <option value="followed">我的关注优先</option>
        </select></label
      ><button type="submit">筛选</button
      ><button type="button" class="secondary" @click="emit('clear')">清除</button
      ><button type="button" class="secondary" @click="emit('saveView')">保存视图链接</button>
    </form>
  </ResponsiveFilterDrawer>
</template>
