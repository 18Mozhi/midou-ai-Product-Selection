<script setup lang="ts">
import { computed, ref } from "vue";
type Chain = { traceId: string; items: unknown[]; exceptionCount: number; sources: string[] };
const props = defineProps<{ chains: Chain[] }>();
const selected = ref<string | null>(null);
const active = computed(
  () => props.chains.find((c) => c.traceId === selected.value)?.traceId ?? props.chains[0]?.traceId,
);
</script>
<template>
  <div class="p62-workspace">
    <aside class="p62-directory">
      <h2>调用链目录</h2>
      <p>仅包含本次返回事件，不代表完整调用链。</p>
      <nav aria-label="选择日志调用链">
        <button
          v-for="(chain, index) in chains"
          :key="chain.traceId"
          type="button"
          :data-log-chain="chain.traceId"
          :aria-pressed="active === chain.traceId"
          :aria-controls="'p62-chain-' + index"
          @click="selected = chain.traceId"
        >
          <strong>调用链 {{ index + 1 }}</strong>
          <span>{{ chain.items.length }} 个事件 · {{ chain.exceptionCount }} 个异常</span>
          <small>{{
            chain.sources
              .map((s) => ({ api: "API", worker: "Worker", crawler: "爬虫" })[s] ?? s)
              .join(" / ")
          }}</small>
        </button>
      </nav>
    </aside>
    <section
      v-for="(chain, index) in chains"
      v-show="active === chain.traceId"
      :key="chain.traceId"
      :id="'p62-chain-' + index"
      class="p62-events"
      :aria-labelledby="'p62-title-' + index"
    >
      <header class="p62-events-heading">
        <h2 :id="'p62-title-' + index">事件证据</h2>
        <p>当前返回事件按发生时间排列，编号与关联对象以原始记录为准。</p>
      </header>
      <slot name="chain" :chain="chain" />
    </section>
  </div>
</template>
