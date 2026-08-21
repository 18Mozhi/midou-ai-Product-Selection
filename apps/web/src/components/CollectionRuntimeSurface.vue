<script setup lang="ts">
import CollectionOperationsConsole from "./CollectionOperationsConsole.vue";
import CollectionRuntimeCenter from "./CollectionRuntimeCenter.vue";
import CollectionTaskCenter from "./CollectionTaskCenter.vue";

defineProps<{ apiBaseUrl: string; routePath: string }>();
</script>

<template>
  <section class="provider-runtime-surface">
    <nav class="provider-runtime-tabs" aria-label="采集控制台视图">
      <RouterLink
        to="/platform-admin/collection/overview"
        :aria-current="routePath === '/platform-admin/collection/overview' ? 'page' : undefined"
        >采集总览</RouterLink
      ><RouterLink
        to="/platform-admin/collection"
        :aria-current="routePath === '/platform-admin/collection' ? 'page' : undefined"
        >任务详情</RouterLink
      ><RouterLink
        to="/platform-admin/collection/browser-runtime"
        :aria-current="
          routePath === '/platform-admin/collection/browser-runtime' ? 'page' : undefined
        "
        >网页登录采集（高级）</RouterLink
      >
    </nav>
    <CollectionOperationsConsole
      v-if="routePath === '/platform-admin/collection/overview'"
      :api-base-url="apiBaseUrl"
    />
    <CollectionRuntimeCenter
      v-else-if="routePath === '/platform-admin/collection/browser-runtime'"
      :api-base-url="apiBaseUrl"
    />
    <CollectionTaskCenter v-else :api-base-url="apiBaseUrl" />
  </section>
</template>
