<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import UiStatePanel from "./UiStatePanel.vue";
import ConfirmDialog from "./ConfirmDialog.vue";
import { getLastValidRoute } from "../navigation-memory";
import { UI_STATE_KINDS, type UiStateKind } from "../ui/state-contract";
const props = defineProps<{ initialState?: UiStateKind }>();
const router = useRouter();
const query = new URLSearchParams(window.location.search).get("state") as UiStateKind | null;
const current = ref<UiStateKind>(
    props.initialState ?? (UI_STATE_KINDS.includes(query as UiStateKind) ? query! : "empty"),
  ),
  dialogOpen = ref(false),
  confirmed = ref(false);
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
async function primary() {
  if (current.value === "not_found") {
    await router.push(recentRoute.value);
    return;
  }
  current.value =
    current.value === "blocked" || current.value === "error" ? "recovery" : current.value;
}
async function secondary() {
  if (current.value === "not_found") {
    await router.push("/home");
    return;
  }
  current.value = "empty";
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
            @click="current = kind"
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
        /><code v-if="current === 'not_found'" class="state-recent-route"
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
