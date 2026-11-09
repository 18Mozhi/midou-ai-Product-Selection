<script setup lang="ts">
import { computed } from "vue";

type State =
  "loading" | "ready" | "expired" | "forbidden" | "context_required" | "rate_limited" | "blocked";
const props = defineProps<{
  state: State;
  actionHint: string;
  requestId: string;
  traceId: string;
}>();
const emit = defineEmits<{ retry: [] }>();
const stateCopy = computed(
  () =>
    (
      ({
        expired: ["登录已失效", "重新登录后返回当前页面。"],
        forbidden: ["无权进入此工作台", "服务端已拒绝该壳层；返回有权访问的工作台。"],
        context_required: ["尚未选择组织与工作区", "完成租户选择后才能进入成员或组织后台。"],
        rate_limited: ["请求过于频繁", "稍后重试；不要连续刷新。"],
        blocked: ["导航服务暂不可用", "检查网络后重试；运维可在宝塔查看 Node API。"],
        loading: ["正在核验工作台权限", "菜单只会在服务端确认后显示。"],
        ready: ["", ""],
      }) as Record<State, [string, string]>
    )[props.state],
);
</script>

<template>
  <section class="role-gate-state" aria-live="polite">
    <span class="role-state-mark" aria-hidden="true">{{
      state === "loading" ? "···" : state === "forbidden" ? "×" : "!"
    }}</span>
    <p>访问保护</p>
    <h1>{{ stateCopy[0] }}</h1>
    <p>{{ stateCopy[1] }}</p>
    <small v-if="actionHint">{{ actionHint }}</small>
    <details v-if="requestId || traceId" class="role-gate-technical">
      <summary>故障详情</summary>
      <code v-if="requestId">关联编号：{{ requestId }}</code
      ><code v-if="traceId && traceId !== requestId">链路编号：{{ traceId }}</code>
    </details>
    <RouterLink v-if="state === 'expired'" to="/login">重新登录</RouterLink
    ><RouterLink v-else-if="state === 'context_required'" to="/select-context"
      >选择组织与工作区</RouterLink
    ><RouterLink v-else-if="state === 'forbidden'" to="/home">返回成员工作台</RouterLink
    ><button v-else-if="state !== 'loading'" type="button" @click="emit('retry')">重新检查</button>
  </section>
</template>
