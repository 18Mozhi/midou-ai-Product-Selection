<script setup lang="ts">
import PlatformMessageWorkbench from "./PlatformMessageWorkbench.vue";
import PlatformNotificationOperations from "./PlatformNotificationOperations.vue";
import PlatformNotificationPagination from "./PlatformNotificationPagination.vue";

defineProps<{
  data: any;
  refreshing: boolean;
  stateName: (value: unknown) => string;
  when: (value: unknown) => string;
}>();
defineEmits<{
  edit: [item: any];
  action: [item: any, action: "publish" | "cancel"];
  messagePage: [page: number];
  notificationPage: [page: number];
}>();
</script>

<template>
  <PlatformMessageWorkbench
    domain="notifications"
    :messages="data.messages"
    :state-name="stateName"
    :when="when"
    @edit="$emit('edit', $event)"
    @action="(item, action) => $emit('action', item, action)"
  />
  <PlatformNotificationPagination
    v-if="data.message_pagination"
    :pagination="data.message_pagination"
    :refreshing="refreshing"
    label="通知草稿与发布记录"
    @change="$emit('messagePage', $event)"
  />
  <PlatformNotificationOperations :data="data" :state-name="stateName" :when="when" />
  <PlatformNotificationPagination
    v-if="data.pagination"
    :pagination="data.pagination"
    :refreshing="refreshing"
    label="通知与投递记录"
    @change="$emit('notificationPage', $event)"
  />
</template>
