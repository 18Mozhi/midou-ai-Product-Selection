<script setup lang="ts">
defineProps<{ hasData: boolean }>();
</script>

<template>
  <aside class="p64-directory" aria-label="本机恢复范围">
    <h2>仅限当前主机</h2>
    <p>惠州主机内的加密副本与隔离恢复，不代表整机或异地灾备。</p>
    <nav v-if="hasData" aria-label="备份恢复页内导航">
      <a href="#p64-objectives">01 / 目标与实际</a>
      <a href="#p64-evidence">02 / 恢复证据</a>
      <a href="#p64-assets">03 / 备份资产</a>
    </nav>
    <p>恢复动作仅由宝塔受控任务执行，本页没有执行入口。</p>
  </aside>
</template>
