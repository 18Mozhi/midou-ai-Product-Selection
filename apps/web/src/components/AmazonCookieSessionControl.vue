<script setup lang="ts">
import { computed, onMounted, onActivated, onDeactivated, onBeforeUnmount, ref, useId } from "vue";
import { ApiClientError, createApiClient } from "../api-client";
import {
  beginCredentialWrite,
  finishCredentialWrite,
  settleCredentialWrite,
  credentialWriteOperation,
} from "../credential-write-coordinator";
import ConfirmDialog from "./ConfirmDialog.vue";
const props = defineProps<{
  apiBaseUrl: string;
  busy: boolean;
  assets: {
    id: string;
    provider_id: string;
    name: string;
    kind: string;
    status: string;
    version: number;
    expires_at: string | null;
  }[];
}>();
interface Session {
  profile_id: string;
  profile_version: number;
  provider_id: string;
  asset_id: string;
  asset_version: number;
  asset_name: string;
  mode: "anonymous" | "administrator_cookie";
  available: boolean;
  expires_at: string | null;
}
const request = createApiClient(props.apiBaseUrl),
  id = useId(),
  session = ref<Session | null>(null),
  selected = ref(""),
  message = ref(""),
  loading = ref(false),
  confirming = ref(false);
const emit = defineEmits<{ changed: [] }>();
let active = true,
  read: AbortController | undefined,
  activatedOnce = false;
const options = computed(() =>
  props.assets.filter(
    (a) =>
      a.provider_id === session.value?.provider_id &&
      a.status === "active" &&
      ["cookie_bundle", "browser_profile"].includes(a.kind) &&
      (!a.expires_at || new Date(a.expires_at) > new Date()),
  ),
);
const chosen = computed(() => options.value.find((a) => a.id === selected.value));
const busy = computed(() => props.busy || credentialWriteOperation.value !== null);
async function load() {
  if (!active) return;
  read?.abort();
  const controller = new AbortController();
  read = controller;
  loading.value = true;
  try {
    const r = await request<Session>("/platform/amazon-session", { signal: controller.signal });
    if (active && read === controller) {
      session.value = r.data;
      selected.value = r.data.asset_id;
      message.value = "";
    }
  } catch (e) {
    if (active && read === controller && !controller.signal.aborted) {
      session.value = null;
      message.value = e instanceof ApiClientError ? e.message : "Amazon 会话状态读取失败，请重试。";
    }
  } finally {
    if (active && read === controller) loading.value = false;
  }
}
async function activate() {
  const asset = chosen.value,
    current = session.value;
  if (!asset || !current || busy.value) return;
  const op = beginCredentialWrite("Amazon 采集会话切换");
  if (op === null) return;
  try {
    const r = await request<Session>("/platform/amazon-session", {
      method: "POST",
      idempotencyKey: crypto.randomUUID(),
      body: {
        asset_id: asset.id,
        expected_asset_version: asset.version,
        expected_profile_version: current.profile_version,
      },
    });
    if (active) {
      session.value = r.data;
      selected.value = r.data.asset_id;
      confirming.value = false;
      message.value = "会话已切换。尚未证明真实搜索和详情通过，不会据此解除熔断。";
      finishCredentialWrite(op);
      emit("changed");
    } else
      settleCredentialWrite(op, {
        label: "Amazon 采集会话切换",
        outcome: "success",
        message: "切换请求成功，请刷新核对当前绑定。",
        actionHint: "真实采集仍需验证。",
        requestId: r.request_id,
      });
  } catch (e) {
    const hint = e instanceof ApiClientError ? e.actionHint : "请刷新核对，不要重复提交。";
    if (!(e instanceof ApiClientError) || e.status === 0 || e.status >= 500) {
      settleCredentialWrite(op, {
        label: "Amazon 采集会话切换",
        outcome: "unknown",
        message: "写入结果未知，请刷新核对绑定，不要重复提交。",
        actionHint: hint,
        requestId: e instanceof ApiClientError ? e.requestId : "",
      });
      if (active) {
        confirming.value = false;
        message.value = "写入结果未知，请等待原凭证流程核对绑定，不要重复提交。";
      }
      return;
    }
    if (active) {
      message.value = e instanceof ApiClientError ? `${e.message} ${hint}` : hint;
      confirming.value = false;
      finishCredentialWrite(op);
      await load().then(() => {
        message.value = e instanceof ApiClientError ? `${e.message} ${hint}` : hint;
      });
    } else
      settleCredentialWrite(op, {
        label: "Amazon 采集会话切换",
        outcome: e instanceof ApiClientError && e.status !== 0 ? "failure" : "unknown",
        message: hint,
        actionHint: "刷新后核对绑定，避免重放旧操作。",
        requestId: e instanceof ApiClientError ? e.requestId : "",
      });
  }
}
onMounted(() => {
  void load();
});
onActivated(() => {
  active = true;
  if (activatedOnce) void load();
  activatedOnce = true;
});
const leave = () => {
  active = false;
  read?.abort();
  confirming.value = false;
};
onDeactivated(leave);
onBeforeUnmount(leave);
</script>
<template>
  <section class="amazon-session-control" :aria-labelledby="id + '-title'">
    <h3 :id="id + '-title'">Amazon 采集会话</h3>
    <p>
      先在凭证资产中新增或更新 Amazon 登录
      Cookie，再在此明确选择。原文不回显，不自动更换账号或绕过验证码。
    </p>
    <p v-if="session">
      当前：{{ session.mode === "administrator_cookie" ? "管理员登录 Cookie" : "项目匿名会话" }} ·
      {{ session.asset_name }} ·
      {{
        session.available
          ? "凭证可用（不代表实采已通过）"
          : "凭证过期、撤销或档案未启用，请更新后核对"
      }}
    </p>
    <p v-if="message" role="status" aria-live="polite">{{ message }}</p>
    <label :for="id">采集使用的凭证</label>
    <select :id="id" v-model="selected" :disabled="busy || loading || confirming || !session">
      <option value="" disabled>选择同来源的加密凭证</option>
      <option v-for="asset in options" :key="asset.id" :value="asset.id">
        {{ asset.name }} ·
        {{ asset.kind === "cookie_bundle" ? "登录 Cookie" : "浏览器档案（仅原项目匿名档案可用）" }}
      </option>
    </select>
    <div class="amazon-session-actions">
      <button
        type="button"
        :disabled="busy || loading || !chosen || selected === session?.asset_id"
        @click="confirming = true"
      >
        切换采集会话
      </button>
      <button type="button" :disabled="busy || loading" @click="load">
        {{ loading ? "正在读取…" : "刷新状态" }}
      </button>
    </div>
    <small
      >切换不会重试任务、重放死信或解除熔断；在途租约必须自然结束。登录失效需管理员更新
      Cookie，邮编不符请先在原站人工处理，本功能不修改登录账户地址。</small
    >
    <ConfirmDialog
      :open="confirming"
      title="切换 Amazon 采集会话"
      :description="`使用已保存的 ${chosen?.name ?? '凭证'}，作用于该来源后续任务。`"
      impact="不会重启服务、修改数据库结构或自动恢复来源；真实搜索和同商品详情仍须通过。"
      confirm-label="确认切换"
      :busy="busy"
      @confirm="activate"
      @cancel="confirming = false"
    />
  </section>
</template>
<style scoped>
.amazon-session-control {
  margin: 16px 0;
  padding: 16px;
  border: 1px solid var(--border-color, #dce3eb);
  border-radius: 8px;
  background: var(--surface-color, #fff);
}
.amazon-session-control h3 {
  margin: 0 0 8px;
}
.amazon-session-control p,
.amazon-session-control small {
  font-size: 13px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.amazon-session-control label {
  display: block;
  margin: 12px 0 6px;
  font-size: 13px;
}
.amazon-session-control select {
  box-sizing: border-box;
  max-width: 100%;
  min-height: 36px;
  width: 100%;
  font: inherit;
}
.amazon-session-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0;
}
.amazon-session-actions button {
  min-height: 36px;
  padding: 6px 12px;
}
.amazon-session-control small {
  display: block;
}
</style>
