<script setup lang="ts">
import { computed, onActivated, onDeactivated, onMounted, onUnmounted, shallowRef } from "vue";
import PlatformMessageEditor from "./PlatformMessageEditor.vue";
import PlatformNotificationActionDialog from "./PlatformNotificationActionDialog.vue";
import PlatformNotificationManagement from "./PlatformNotificationManagement.vue";
import type {
  NotificationSection,
  PlatformNotificationEnvelopeRequest,
} from "./platform-notification-types";
import {
  platformManagementStateName as stateName,
  formatPlatformManagementTime as when,
} from "./platform-management-presentation";
import { usePlatformMessageEditor } from "./use-platform-message-editor";
import { usePlatformNotificationAction } from "./use-platform-notification-action";
import { usePlatformNotificationList } from "./use-platform-notification-list";
import { notificationWriteRequest } from "./platform-notification-request";
import "../platform-notifications.css";

const props = defineProps<{
  request: PlatformNotificationEnvelopeRequest;
}>();
const domain = shallowRef("notifications"),
  state = shallowRef<"loading" | "ready" | "empty" | "error">("loading"),
  data = shallowRef<any>(null),
  query = shallowRef(""),
  status = shallowRef(""),
  message = shallowRef(""),
  refreshing = shallowRef(false),
  section = shallowRef<NotificationSection>("messages");

let notificationList: ReturnType<typeof usePlatformNotificationList>;
async function reload() {
  if (wasDeactivated) return false;
  await notificationList.load();
  return notificationList.lastLoadOutcome.value === "success";
}
notificationList = usePlatformNotificationList({
  domain,
  query,
  status,
  data,
  state,
  message,
  refreshing,
  request: props.request,
  reload: () => void reload(),
});
const editor = usePlatformMessageEditor({
  request: notificationWriteRequest(props.request),
  reload,
  showNewestMessages: notificationList.showNewestMessages,
  message,
});
const messageAction = usePlatformNotificationAction({
  request: notificationWriteRequest(props.request),
  reload,
  message,
});

const hasSnapshot = computed(() => data.value?.domain === "notifications"),
  activeFilterCount = computed(
    () => Number(Boolean(query.value.trim())) + Number(Boolean(status.value)),
  ),
  summary = computed(() => [
    { key: "total", label: "筛选投递", value: Number(data.value?.summary?.total ?? 0) },
    { key: "unread", label: "未读", value: Number(data.value?.summary?.unread ?? 0) },
    { key: "critical", label: "严重", value: Number(data.value?.summary?.critical ?? 0) },
    {
      key: "drafts",
      label: "本页草稿",
      value: (data.value?.messages ?? []).filter((item: any) => item.status === "draft").length,
    },
  ]),
  snapshotScope = computed(() =>
    [
      notificationList.snapshotQuery.value
        ? `搜索“${notificationList.snapshotQuery.value}”`
        : "全部投递",
      notificationList.snapshotStatus.value
        ? stateName(notificationList.snapshotStatus.value)
        : "全部类型",
    ].join(" · "),
  );
const sections: Array<{ key: NotificationSection; index: string; label: string; hint: string }> = [
  { key: "messages", index: "01", label: "人工消息", hint: "草稿与发布记录" },
  { key: "deliveries", index: "02", label: "投递观测", hint: "接收与送达事实" },
  { key: "configuration", index: "03", label: "系统事实", hint: "模板、渠道与路由" },
];

let wasDeactivated = false;
onMounted(() => {
  notificationList.readLocation();
  void reload();
});
onActivated(() => {
  if (!wasDeactivated) return;
  wasDeactivated = false;
  void reload();
});
function stop() {
  wasDeactivated = true;
  notificationList.stop();
  editor.stop();
  messageAction.stop();
}
onDeactivated(stop);
onUnmounted(stop);
</script>

<template>
  <section class="platform-notifications" aria-live="polite" :aria-busy="refreshing">
    <aside class="platform-notifications__rail" aria-label="通知运营分区">
      <div class="platform-notifications__identity">
        <small>NOTIFICATION DESK</small>
        <strong>通知编排台</strong>
        <span>先准备消息，再核对发布与送达。</span>
      </div>
      <nav aria-label="通知管理页面分区">
        <button
          v-for="item in sections"
          :key="item.key"
          type="button"
          :aria-current="section === item.key ? 'page' : undefined"
          @click="section = item.key"
        >
          <b>{{ item.index }}</b
          ><span
            ><strong>{{ item.label }}</strong
            ><small>{{ item.hint }}</small></span
          >
        </button>
      </nav>
      <p>邮件服务尚未接入；本页不提供开启入口，也不把草稿数量当成投递数量。</p>
    </aside>

    <div class="platform-notifications__surface">
      <header class="platform-notifications__hero">
        <div>
          <p>P57 / NOTIFICATION OPERATIONS</p>
          <h2>通知管理</h2>
          <span>编排人工消息，核对接收范围与真实送达记录。</span>
        </div>
        <div>
          <button type="button" class="is-primary" @click="editor.begin()">新建草稿</button>
          <button type="button" :disabled="refreshing" @click="reload">
            {{ refreshing ? "读取中…" : "刷新快照" }}
          </button>
        </div>
      </header>

      <section v-if="!hasSnapshot" class="platform-notifications__first-state">
        <span aria-hidden="true">{{ state === "loading" ? "···" : "!" }}</span>
        <div>
          <h3>{{ state === "loading" ? "正在读取通知工作台" : "当前无法读取通知工作台" }}</h3>
          <p>
            {{
              state === "loading"
                ? "正在核对消息、投递与系统配置事实。"
                : message || "通知运营数据暂时不可用。"
            }}
          </p>
        </div>
        <button v-if="state !== 'loading'" type="button" @click="reload">重新加载</button>
      </section>

      <template v-else>
        <section class="platform-notifications__summary" aria-label="通知快照统计">
          <article v-for="entry in summary" :key="entry.key">
            <strong>{{ entry.value }}</strong
            ><span>{{ entry.label }}</span>
          </article>
        </section>
        <p class="platform-notifications__scope">
          投递统计范围：{{ snapshotScope }}；人工消息目录不受该筛选影响。
        </p>
        <p v-if="message" class="platform-notifications__message" role="status">{{ message }}</p>
        <PlatformNotificationManagement
          v-model:query="query"
          v-model:status="status"
          :section="section"
          :data="data"
          :refreshing="refreshing"
          :busy-id="messageAction.busyId.value"
          :active-filter-count="activeFilterCount"
          :snapshot-scope="snapshotScope"
          :state-name="stateName"
          :when="when"
          @edit="editor.begin"
          @action="messageAction.begin"
          @apply="notificationList.applyFilters"
          @reset="notificationList.resetFilters"
          @message-page="notificationList.changeMessagePage"
          @notification-page="notificationList.changePage"
        />
        <footer class="platform-notifications__footer">
          <span>读取时间：{{ when(data.observed_at) }}</span>
          <details v-if="notificationList.snapshotRequestId.value">
            <summary>快照读取追踪</summary>
            <span>关联编号 {{ notificationList.snapshotRequestId.value }}</span>
          </details>
        </footer>
      </template>
      <div v-if="notificationList.failureRequestId.value" class="platform-notifications__footer">
        <details>
          <summary>本次失败读取追踪</summary>
          <span>关联编号 {{ notificationList.failureRequestId.value }}</span>
        </details>
      </div>
    </div>

    <PlatformMessageEditor
      :open="Boolean(editor.editor.value)"
      :editor="editor.editor.value"
      :form="editor.form.value"
      :saving="editor.saving.value"
      :error="editor.error.value"
      :audience-options="data?.audience_options"
      @close="editor.close"
      @save="editor.save"
    />
    <PlatformNotificationActionDialog
      v-model:reason="messageAction.reason.value"
      :open="messageAction.open.value"
      :target="messageAction.target.value"
      :action="messageAction.action.value"
      :error="messageAction.error.value"
      :submitting="messageAction.submitting.value"
      @close="messageAction.close"
      @submit="messageAction.submit"
    />
  </section>
</template>
