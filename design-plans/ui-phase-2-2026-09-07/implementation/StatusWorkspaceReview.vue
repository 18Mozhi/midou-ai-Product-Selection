<script setup lang="ts">
import { ref } from "vue";
defineProps<{ warningCount: number; observedAt: string }>();
const views = [
  {
    key: "attention",
    label: "需核查",
    description: "先核对异常观测与可能影响，不把关联关系当作已发生故障。",
  },
  {
    key: "dependencies",
    label: "依赖目录",
    description: "沿原始运行关系查看六项依赖及对应管理入口。",
  },
  {
    key: "session",
    label: "浏览器会话",
    description: "本区域只描述当前标签页，不代表全平台服务质量。",
  },
  {
    key: "activity",
    label: "业务汇总",
    description: "展示本次管理接口返回的业务计数，与服务观测分开核对。",
  },
] as const;
const active = ref<string>("attention");
</script>
<template>
  <div class="p61-workspace">
    <aside class="p61-directory">
      <p>观测范围</p>
      <strong>系统状态</strong>
      <span>需核查依赖 {{ warningCount }} 项</span>
      <nav aria-label="系统状态分区">
        <button
          v-for="view in views"
          :key="view.key"
          type="button"
          :data-status-view="view.key"
          :aria-pressed="active === view.key"
          :aria-controls="'p61-panel-' + view.key"
          @click="active = view.key"
        >
          {{ view.label }}
        </button>
      </nav>
      <small>数据观测时间<br />{{ observedAt }}</small>
    </aside>
    <section
      v-for="view in views"
      v-show="active === view.key"
      :id="'p61-panel-' + view.key"
      :key="view.key"
      class="p61-panel"
      :aria-labelledby="'p61-title-' + view.key"
    >
      <header>
        <h2 :id="'p61-title-' + view.key">{{ view.label }}</h2>
        <p>{{ view.description }}</p>
      </header>
      <slot :name="view.key" />
    </section>
  </div>
</template>
