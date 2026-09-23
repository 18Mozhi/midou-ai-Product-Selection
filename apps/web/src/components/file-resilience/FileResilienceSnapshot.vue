<script setup lang="ts">
import type { FileResilienceDto } from "@scoutops/contracts";
import FileResilienceDirectoryLedger from "./FileResilienceDirectoryLedger.vue";
import FileResilienceIntegrityAndRecovery from "./FileResilienceIntegrityAndRecovery.vue";
import { formatFileObservedAt } from "./formatters";

defineProps<{
  data: FileResilienceDto;
  state: "ready" | "warning" | "blocked";
  verdict: [string, string];
}>();

</script>

<template>
  <section class="p69-paper">
    <section class="p69-conclusion" :data-verdict="state">
      <div>
        <small>S0 / {{ state }}</small>
        <h2>{{ verdict[0] }}</h2>
        <p>返回 {{ data.findings.length }} 项发现；ready 不替代真实恢复或生产验收。</p>
      </div>
      <div class="p69-observed">
        <b>观测时间</b>
        <time :datetime="data.observed_at">{{ formatFileObservedAt(data.observed_at) }}</time>
      </div>
    </section>
    <section v-if="data.findings.length" class="p69-findings">
      <header>
        <h2>当前发现</h2>
        <small>{{ data.findings.length }} 项</small>
      </header>
      <article v-for="item in data.findings" :key="item.code" :data-severity="item.severity">
        <b>{{ item.severity === "blocked" ? "阻断" : "预警" }}</b>
        <code>{{ item.code }}</code>
        <p>{{ item.action_hint }}</p>
      </article>
      <small>提示仅供人工通过宝塔核对；本页不会浏览、下载、删除、备份或恢复文件。</small>
    </section>
    <FileResilienceDirectoryLedger :directories="data.directories" />
    <FileResilienceIntegrityAndRecovery
      :integrity="data.integrity"
      :recovery="data.recovery"
    />
  </section>
</template>
