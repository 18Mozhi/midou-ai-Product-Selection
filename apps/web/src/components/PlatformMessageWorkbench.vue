<script setup lang="ts">
import { computed, shallowRef, watch } from "vue";
import { usePlatformNotificationReader } from "./use-platform-notification-reader";
import { trapNotificationDialogTab } from "./platform-notification-dialog";
import type { PlatformNotificationMessage } from "./platform-notification-types";

const props = withDefaults(
  defineProps<{
    domain: string;
    messages: PlatformNotificationMessage[];
    busyId?: string;
    stateName: (value: unknown) => string;
    when: (value: unknown) => string;
  }>(),
  { busyId: "" },
);
const emit = defineEmits<{
  edit: [item: PlatformNotificationMessage];
  action: [item: PlatformNotificationMessage, action: "publish" | "cancel"];
}>();
const selectedId = shallowRef("");
const { mobileReaderOpen, dialogElement, handleCancel } = usePlatformNotificationReader();
const selected = computed(
  () => props.messages.find((item) => item.id === selectedId.value) ?? props.messages[0] ?? null,
);
watch(
  () => props.messages,
  (messages) => {
    if (!messages.some((item) => item.id === selectedId.value))
      selectedId.value = messages[0]?.id ?? "";
  },
  { immediate: true },
);

function audience(item: PlatformNotificationMessage) {
  return item.audience_type === "all_users"
    ? "全部活动用户"
    : item.audience_type === "organization"
      ? item.organization_name || "未返回组织名称"
      : item.user_email || "未返回用户邮箱";
}
function channel(item: PlatformNotificationMessage) {
  return (
    [item.in_app_enabled ? "站内通知" : "", item.email_enabled ? "邮件" : ""]
      .filter(Boolean)
      .join("、") || "未启用渠道"
  );
}
function select(item: PlatformNotificationMessage) {
  selectedId.value = item.id;
  if (window.matchMedia("(max-width: 760px)").matches) mobileReaderOpen.value = true;
}
</script>

<template>
  <section class="message-workbench" aria-labelledby="message-workbench-title">
    <header>
      <div>
        <p>MESSAGE DESK</p>
        <h3 id="message-workbench-title">人工消息</h3>
        <span>草稿和发布记录不受投递搜索或类型筛选影响。</span>
      </div>
      <b>{{ messages.length }} 条 / 当前页</b>
    </header>

    <div v-if="messages.length" class="message-workbench__body">
      <nav class="message-directory" aria-label="人工消息目录">
        <button
          v-for="item in messages"
          :key="item.id"
          type="button"
          :class="{ 'is-selected': item.id === selected?.id }"
          :aria-current="item.id === selected?.id ? 'true' : undefined"
          @click="select(item)"
        >
          <span
            ><i :data-status="item.status">{{ stateName(item.status) }}</i
            ><small>{{ stateName(item.category) }}</small></span
          >
          <strong>{{ item.title }}</strong>
          <small>{{ audience(item) }} · {{ when(item.updated_at) }}</small>
          <em>查看正文与操作</em>
        </button>
      </nav>

      <article v-if="selected" class="message-reader" :data-status="selected.status">
        <header>
          <div>
            <small>{{ stateName(selected.category) }} / {{ stateName(selected.severity) }}</small>
            <h4>{{ selected.title }}</h4>
          </div>
          <i :data-status="selected.status">{{ stateName(selected.status) }}</i>
        </header>
        <p class="message-reader__preview">{{ selected.body }}</p>
        <details class="message-body">
          <summary>完整正文</summary>
          <p>{{ selected.body }}</p>
        </details>
        <dl>
          <div>
            <dt>接收范围</dt>
            <dd>{{ audience(selected) }}</dd>
          </div>
          <div>
            <dt>发送方式</dt>
            <dd>{{ channel(selected) }}</dd>
          </div>
          <div>
            <dt>更新时间</dt>
            <dd>{{ when(selected.updated_at) }}</dd>
          </div>
          <div>
            <dt>版本</dt>
            <dd>v{{ selected.version }}</dd>
          </div>
        </dl>
        <p class="message-reader__boundary">
          实际接收人数以发布接口返回为准，不由候选列表或订阅统计估算。
        </p>
        <footer v-if="selected.status === 'draft'">
          <button type="button" :disabled="busyId === selected.id" @click="emit('edit', selected)">
            编辑草稿
          </button>
          <button
            type="button"
            class="is-primary"
            :disabled="busyId === selected.id"
            @click="emit('action', selected, 'publish')"
          >
            {{ busyId === selected.id ? "处理中…" : "发布草稿" }}
          </button>
          <button
            type="button"
            class="is-danger"
            :disabled="busyId === selected.id"
            @click="emit('action', selected, 'cancel')"
          >
            取消草稿
          </button>
        </footer>
      </article>
    </div>

    <section v-else class="message-workbench__empty">
      <span aria-hidden="true">0</span>
      <div>
        <h4>还没有人工消息</h4>
        <p>可以从页面顶部新建草稿；保存后不会自动发布。</p>
      </div>
    </section>

    <dialog
      ref="dialogElement"
      class="message-reader-dialog"
      :aria-label="selected?.title || '完整消息阅读'"
      @cancel="handleCancel"
      @keydown="trapNotificationDialogTab($event, dialogElement)"
    >
      <article v-if="selected" class="message-reader" :data-status="selected.status">
        <header>
          <div>
            <small>{{ stateName(selected.category) }} / {{ stateName(selected.severity) }}</small>
            <h4>{{ selected.title }}</h4>
          </div>
          <button type="button" aria-label="关闭完整消息" @click="mobileReaderOpen = false">
            ×
          </button>
        </header>
        <i :data-status="selected.status">{{ stateName(selected.status) }}</i>
        <p class="message-reader__full-body">{{ selected.body }}</p>
        <dl>
          <div>
            <dt>接收范围</dt>
            <dd>{{ audience(selected) }}</dd>
          </div>
          <div>
            <dt>发送方式</dt>
            <dd>{{ channel(selected) }}</dd>
          </div>
          <div>
            <dt>更新时间</dt>
            <dd>{{ when(selected.updated_at) }}</dd>
          </div>
          <div>
            <dt>版本</dt>
            <dd>v{{ selected.version }}</dd>
          </div>
        </dl>
        <p class="message-reader__boundary">完整正文只读；发布人数以接口返回为准。</p>
        <footer v-if="selected.status === 'draft'">
          <button
            type="button"
            :disabled="busyId === selected.id"
            @click="
              emit('edit', selected);
              mobileReaderOpen = false;
            "
          >
            编辑草稿
          </button>
          <button
            type="button"
            class="is-primary"
            :disabled="busyId === selected.id"
            @click="
              emit('action', selected, 'publish');
              mobileReaderOpen = false;
            "
          >
            发布草稿
          </button>
          <button
            type="button"
            class="is-danger"
            :disabled="busyId === selected.id"
            @click="
              emit('action', selected, 'cancel');
              mobileReaderOpen = false;
            "
          >
            取消草稿
          </button>
        </footer>
      </article>
    </dialog>
  </section>
</template>
