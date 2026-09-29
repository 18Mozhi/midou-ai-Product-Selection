<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  mode: "initial" | "retained" | "expired" | "forbidden";
  state: string;
  notice: string;
  requestId: string;
}>();
const emit = defineEmits<{ reload: [] }>();

const presentation = computed(() => {
  if (props.mode === "retained")
    return {
      label: "审批内容更新提示",
      kicker: "读取状态提示",
      title: "审批内容未能更新",
      copy: "可使用上方“刷新数据”重新读取。",
      boundary: "仍显示上次成功读取的内容，本次更新尚未完成。",
      reload: false,
    };
  if (props.mode === "expired")
    return {
      label: "审批登录状态提示",
      kicker: "登录状态提示",
      title: "登录已失效",
      copy: "重新登录后返回当前页面。",
      boundary: "审批内容目前未显示，不代表记录或模板为空。",
      reload: true,
    };
  if (props.mode === "forbidden")
    return {
      label: "审批查看权限提示",
      kicker: "查看权限提示",
      title: "当前无法查看审批内容",
      copy: "当前权限还不能读取这些内容。权限调整后，可以重新加载。",
      boundary: "审批内容目前未显示，不代表记录或模板为空。",
      reload: true,
    };
  return {
    label: "审批读取反馈",
    kicker: "读取状态提示",
    title:
      props.state === "conflict"
        ? "数据版本已变化"
        : props.state === "blocked"
          ? "组织数据暂不可用"
          : "组织后台暂不可用",
    copy: "可以查看读取详情，确认后重新加载。",
    boundary: "审批内容目前未显示，不代表记录或模板为空。",
    reload: true,
  };
});
</script>

<template>
  <section
    class="org-approval-read-feedback-c"
    :class="{ 'org-approval-read-feedback-c--retained': mode === 'retained' }"
    :data-mode="mode"
    :aria-label="presentation.label"
  >
    <p class="org-approval-read-feedback-c__kicker">{{ presentation.kicker }}</p>
    <h3>{{ presentation.title }}</h3>
    <p class="org-approval-read-feedback-c__copy">{{ presentation.copy }}</p>
    <p class="org-approval-read-feedback-c__boundary">{{ presentation.boundary }}</p>
    <details class="org-approval-read-feedback-c__details">
      <summary>读取详情与追踪</summary>
      <p>{{ notice }}</p>
      <code v-if="requestId">{{ requestId }}</code>
    </details>
    <button v-if="presentation.reload" type="button" @click="emit('reload')">重新加载</button>
  </section>
</template>

<style src="../approval-read-feedback.css"></style>
