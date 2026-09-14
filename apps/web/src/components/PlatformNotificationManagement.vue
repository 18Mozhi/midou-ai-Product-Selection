<script setup lang="ts">
import PlatformManagementFilter from "./PlatformManagementFilter.vue";
import PlatformMessageWorkbench from "./PlatformMessageWorkbench.vue";
import PlatformNotificationFacts from "./PlatformNotificationFacts.vue";
import PlatformNotificationOperations from "./PlatformNotificationOperations.vue";
import PlatformNotificationPagination from "./PlatformNotificationPagination.vue";
import type {
  NotificationSection,
  PlatformNotificationMessage,
} from "./platform-notification-types";

defineProps<{
  section: NotificationSection;
  data: any;
  refreshing: boolean;
  busyId: string;
  activeFilterCount: number;
  snapshotScope: string;
  stateName: (value: unknown) => string;
  when: (value: unknown) => string;
}>();
const emit = defineEmits<{
  edit: [item: PlatformNotificationMessage];
  action: [item: PlatformNotificationMessage, action: "publish" | "cancel"];
  apply: [];
  reset: [];
  messagePage: [page: number];
  notificationPage: [page: number];
}>();
const query = defineModel<string>("query", { required: true });
const status = defineModel<string>("status", { required: true });
</script>

<template>
  <section class="platform-notification-workarea">
    <template v-if="section === 'messages'">
      <PlatformMessageWorkbench
        domain="notifications"
        :messages="data.messages ?? []"
        :busy-id="busyId"
        :state-name="stateName"
        :when="when"
        @edit="emit('edit', $event)"
        @action="(item, action) => emit('action', item, action)"
      />
      <PlatformNotificationPagination
        v-if="data.message_pagination"
        :pagination="data.message_pagination"
        :refreshing="refreshing"
        label="人工消息"
        page-size-label="每页最多 10 条"
        @change="emit('messagePage', $event)"
      />
    </template>

    <template v-else-if="section === 'deliveries'">
      <section class="notification-delivery-toolbar">
        <div>
          <p>DELIVERY AUDIT</p>
          <h3>投递观测</h3>
          <span>搜索和类型筛选只影响投递记录与上方三项投递统计。</span>
        </div>
        <PlatformManagementFilter
          v-model:query="query"
          v-model:status="status"
          domain="notifications"
          label="投递记录"
          :active-count="activeFilterCount"
          appearance="notifications"
          mode="dialog"
          @apply="emit('apply')"
          @reset="emit('reset')"
        />
      </section>
      <p class="notification-delivery-scope">当前快照：{{ snapshotScope }}。</p>
      <PlatformNotificationOperations :data="data" :state-name="stateName" :when="when" />
      <PlatformNotificationPagination
        v-if="data.pagination"
        :pagination="data.pagination"
        :refreshing="refreshing"
        label="通知与投递记录"
        page-size-label="每页最多 20 条"
        @change="emit('notificationPage', $event)"
      />
    </template>

    <PlatformNotificationFacts v-else :data="data" :state-name="stateName" />
  </section>
</template>
