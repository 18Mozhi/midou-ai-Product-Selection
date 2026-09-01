<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import UiStatePanel from "./UiStatePanel.vue";
import ConfirmDialog from "./ConfirmDialog.vue";
import { getLastValidRoute } from "../navigation-memory";
import { UI_STATE_KINDS, type UiStateKind } from "../ui/state-contract";
const props = defineProps<{ initialState?: UiStateKind }>();
const route = useRoute();
const router = useRouter();
const stateFromQuery = (value: unknown): UiStateKind | null =>
  typeof value === "string" && UI_STATE_KINDS.includes(value as UiStateKind)
    ? (value as UiStateKind)
    : null;
const current = ref<UiStateKind>(
    props.initialState ?? stateFromQuery(route.query.state) ?? "empty",
  ),
  dialogOpen = ref(false),
  confirmed = ref(false),
  actionResult = ref("");
const recentRoute = computed(() => getLastValidRoute());
const labels: Record<UiStateKind, string> = {
  loading: "加载",
  empty: "空结果",
  error: "错误",
  forbidden: "无权限",
  expired: "已过期",
  blocked: "受阻",
  recovery: "已恢复",
  not_found: "404",
};
watch(
  () => route.query.state,
  (value) => {
    if (props.initialState) return;
    current.value = stateFromQuery(value) ?? "empty";
    actionResult.value = "";
  },
);
async function selectState(kind: UiStateKind) {
  actionResult.value = "";
  current.value = kind;
  if (props.initialState || route.query.state === kind) return;
  await router.push({ query: { ...route.query, state: kind } });
}
async function primary() {
  if (current.value === "not_found") {
    if (route.path === router.resolve(recentRoute.value).path) {
      await selectState("empty");
      actionResult.value = "最近有效页面就是当前展示页，已返回空结果示例。";
    } else {
      await router.push(recentRoute.value);
    }
    return;
  }
  if (current.value === "blocked" || current.value === "error") {
    await selectState("recovery");
    actionResult.value = "已触发重试示例并进入恢复状态；没有调用业务接口。";
    return;
  }
  if (current.value === "forbidden") {
    await router.push("/home");
    return;
  }
  if (current.value === "expired") {
    await router.push("/login");
    return;
  }
  if (current.value === "recovery") {
    await selectState("empty");
    actionResult.value = "已从恢复状态继续到空结果示例。";
    return;
  }
  actionResult.value = "已触发首次操作示例；展示页没有业务接口，因此未执行写入。";
}
async function secondary() {
  if (current.value === "not_found") {
    await router.push("/home");
    return;
  }
  if (current.value === "blocked") {
    actionResult.value = "影响范围：当前请求因限流、超时或依赖不可用而停止，没有写入成功。";
    return;
  }
  if (current.value === "forbidden") {
    actionResult.value = "权限申请必须由所属业务页发起；展示页不会伪造申请成功。";
    return;
  }
  const previous = current.value;
  await selectState("empty");
  actionResult.value =
    previous === "empty" ? "已触发调整筛选示例；展示页没有真实筛选条件。" : "已返回空结果示例。";
}
</script>
<template>
  <main class="state-showcase" :data-kind="current">
    <header>
      <RouterLink to="/home"><b>选</b>智能选品</RouterLink><span>通用状态</span>
    </header>
    <section class="state-stage">
      <aside>
        <p>状态组件库</p>
        <h1>把失败说清楚，<br /><em>把下一步留下</em></h1>
        <span>所有状态都提供文字语义、影响范围和可执行下一步；不以颜色代替结论。</span>
        <nav aria-label="状态示例">
          <button
            v-for="kind in UI_STATE_KINDS"
            :key="kind"
            type="button"
            :aria-pressed="current === kind"
            aria-controls="ui-state-preview"
            @click="selectState(kind)"
          >
            <i></i>{{ labels[kind] }}
          </button>
        </nav>
        <button class="open-confirm" type="button" @click="dialogOpen = true">
          查看高影响确认弹窗
        </button>
        <p v-if="confirmed" class="confirm-result" role="status">
          示例确认已完成；未触发任何业务写入。
        </p>
      </aside>
      <div class="state-canvas">
        <div class="state-orbit" aria-hidden="true"><i></i><i></i><i></i></div>
        <UiStatePanel
          id="ui-state-preview"
          :kind="current"
          :description="
            current === 'not_found'
              ? `地址可能已变更。可返回最近有效页面 ${recentRoute}，或回到今日行动。`
              : undefined
          "
          :primary-label="current === 'not_found' ? '返回最近页面' : undefined"
          :secondary-label="current === 'not_found' ? '返回今日行动' : undefined"
          request-id="m02-04-request"
          trace-id="m02-04-trace"
          @primary="primary"
          @secondary="secondary"
        />
        <p v-if="actionResult" class="state-action-result" role="status">{{ actionResult }}</p>
        <code v-if="current === 'not_found'" class="state-recent-route"
          >最近有效页面：{{ recentRoute }}</code
        ><small>示例仅验证组件合同，不代表真实业务结果。</small>
      </div>
    </section>
    <footer>
      <span>桌面 / 390px / 键盘</span><span>关联编号与链路编号仅接受安全字符</span
      ><span>无新增后端接口、数据库或异步服务</span>
    </footer>
    <ConfirmDialog
      :open="dialogOpen"
      title="确认撤销示例授权？"
      description="这是通用确认组件的交互演示，不会请求后端。"
      impact="仅演示当前弹窗；不修改角色、权限、数据或审计。"
      confirm-label="确认演示"
      destructive
      confirmation-text="确认撤销"
      @cancel="dialogOpen = false"
      @confirm="
        dialogOpen = false;
        confirmed = true;
      "
    />
  </main>
</template>
