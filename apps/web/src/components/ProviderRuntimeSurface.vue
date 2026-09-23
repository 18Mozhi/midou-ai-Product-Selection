<script setup lang="ts">
import { defineAsyncComponent } from "vue";

const Alibaba1688AcceptanceCenter = defineAsyncComponent(
  () => import("./Alibaba1688AcceptanceCenter.vue"),
);
const CredentialAssetCenter = defineAsyncComponent(() => import("./CredentialAssetCenter.vue"));
const ProviderAdapterCenter = defineAsyncComponent(() => import("./ProviderAdapterCenter.vue"));
const ProviderRegistry = defineAsyncComponent(() => import("./ProviderRegistry.vue"));
const ProviderSourceCenter = defineAsyncComponent(() => import("./ProviderSourceCenter.vue"));

defineProps<{ apiBaseUrl: string; routePath: string; capabilities: string[] }>();
</script>

<template>
  <section class="provider-runtime-surface">
    <nav class="provider-runtime-tabs" aria-label="来源管理视图">
      <RouterLink
        to="/platform-admin/providers"
        :aria-current="routePath === '/platform-admin/providers' ? 'page' : undefined"
        >来源设置（高级）</RouterLink
      ><RouterLink
        to="/platform-admin/providers/adapters"
        :aria-current="routePath === '/platform-admin/providers/adapters' ? 'page' : undefined"
        >采集程序（高级）</RouterLink
      ><RouterLink
        to="/platform-admin/providers/sources"
        :aria-current="routePath === '/platform-admin/providers/sources' ? 'page' : undefined"
        >来源频道</RouterLink
      ><RouterLink
        v-if="capabilities.includes('platform:superadmin')"
        to="/platform-admin/providers/sources/1688-acceptance"
        :aria-current="
          routePath === '/platform-admin/providers/sources/1688-acceptance' ? 'page' : undefined
        "
        >检查启用条件</RouterLink
      ><RouterLink
        v-if="capabilities.includes('platform:superadmin')"
        to="/platform-admin/credentials"
        :aria-current="routePath === '/platform-admin/credentials' ? 'page' : undefined"
        >网页登录凭证</RouterLink
      >
    </nav>
    <CredentialAssetCenter
      v-if="routePath === '/platform-admin/credentials'"
      :api-base-url="apiBaseUrl"
    />
    <ProviderSourceCenter
      v-else-if="routePath === '/platform-admin/providers/sources'"
      :api-base-url="apiBaseUrl"
    />
    <Alibaba1688AcceptanceCenter
      v-else-if="routePath === '/platform-admin/providers/sources/1688-acceptance'"
      :api-base-url="apiBaseUrl"
    />
    <ProviderAdapterCenter
      v-else-if="routePath === '/platform-admin/providers/adapters'"
      :api-base-url="apiBaseUrl"
    />
    <ProviderRegistry v-else :api-base-url="apiBaseUrl" />
  </section>
</template>
