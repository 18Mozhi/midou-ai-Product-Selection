<script setup lang="ts">
import { onMounted, ref } from "vue";
import "../platform-polish.css";
const p = defineProps<{ apiBaseUrl: string }>();
type State =
  "loading" | "ready" | "empty" | "error" | "rate_limited" | "blocked";
const state = ref<State>("loading"),
  data = ref<any>({ clients: [], webhooks: [], deliveries: [] }),
  requestId = ref(""),
  organizationId = ref(""),
  notice = ref(""),
  secret = ref(""),
  pending = ref<{ title: string; path: string; body: any } | null>(null),
  form = ref({ name: "", target_url: "", reason: "开放平台配置变更" });
async function call(path: string, method = "GET", body?: any) {
  const r = await fetch(`${p.apiBaseUrl}${path}`, {
      method,
      credentials: "include",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        origin: location.origin,
        "idempotency-key": crypto.randomUUID(),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
    j = await r.json();
  if (!r.ok) {
    requestId.value = j.request_id ?? "";
    throw Object.assign(new Error(j.error?.message ?? "request_failed"), {
      status: r.status,
    });
  }
  return j.data;
}
async function load() {
  state.value = "loading";
  notice.value = "";
  try {
    data.value = await call(
      `/platform/open${organizationId.value ? `?organization_id=${encodeURIComponent(organizationId.value)}` : ""}`,
    );
    state.value =
      data.value.clients.length ||
      data.value.webhooks.length ||
      data.value.deliveries.length
        ? "ready"
        : "empty";
  } catch (e) {
    notice.value = String((e as Error).message);
    state.value =
      (e as any).status === 429
        ? "rate_limited"
        : (e as any).status >= 500
          ? "blocked"
          : "error";
  }
}
async function createClient() {
  try {
    const r = await call("/platform/open/clients", "POST", {
      organization_id: organizationId.value,
      name: form.value.name,
      scopes: ["status:read"],
      reason: form.value.reason,
    });
    secret.value = r.secret;
    notice.value = "接口访问账号已创建；密钥仅显示本次。";
    await load();
    state.value = "ready";
  } catch (e) {
    notice.value = String((e as Error).message);
  }
}
async function createWebhook() {
  try {
    const r = await call("/platform/open/webhooks", "POST", {
      organization_id: organizationId.value,
      name: form.value.name,
      target_url: form.value.target_url,
      events: ["scoutops.test"],
      reason: form.value.reason,
    });
    secret.value = r.secret;
    notice.value = "事件回调地址已创建；签名密钥仅显示本次。";
    await load();
    state.value = "ready";
  } catch (e) {
    notice.value = String((e as Error).message);
  }
}
async function action(path: string, body: any) {
  try {
    const r = await call(path, "POST", body);
    if (r.secret) secret.value = r.secret;
    notice.value = "操作已提交并写入审计。";
    await load();
    state.value = "ready";
  } catch (e) {
    notice.value = String((e as Error).message);
  }
}
function prepare(title: string, path: string, body: any) {
  pending.value = { title, path, body };
}
async function confirm() {
  if (!pending.value) return;
  const x = pending.value;
  pending.value = null;
  await action(x.path, x.body);
}
onMounted(load);
const statusText = (value: string) =>
  (
    ({
      active: "可用",
      revoked: "已撤销",
      enabled: "启用",
      disabled: "停用",
      pending: "等待投递",
      succeeded: "成功",
      failed: "失败",
      dead_letter: "多次失败",
      retry_scheduled: "等待重试",
    }) as Record<string, string>
  )[value] ?? "其他状态";
const scopeText = (value: string) =>
  (({ "status:read": "读取系统状态" }) as Record<string, string>)[value] ??
  "其他权限";
const eventText = (value: string) =>
  (({ "scoutops.test": "测试事件" }) as Record<string, string>)[value] ??
  "业务事件";
</script>
<template>
  <section class="open-platform">
    <header>
      <div>
        <p>平台开放能力</p>
        <h2>开放接口与事件回调</h2>
        <span
          >为外部系统创建独立访问账号和回调地址；每个密钥只显示一次，权限和用量都可单独控制。</span
        >
      </div>
      <form @submit.prevent="load">
        <label
          >组织编号<input
            v-model="organizationId"
            placeholder="精确筛选或创建时必填" /></label
        ><button>读取</button>
      </form>
    </header>
    <aside v-if="secret" class="open-secret">
      <strong>请立即保存，本页不会再次显示</strong><code>{{ secret }}</code
      ><button @click="secret = ''">我已保存</button>
    </aside>
    <aside v-if="pending" class="open-confirm">
      <strong>确认{{ pending.title }}？</strong>
      <p>该操作会改变密钥或投递状态，并同步写入审计；请确认变更原因准确。</p>
      <button @click="pending = null">取消</button
      ><button class="danger" @click="confirm">确认执行</button>
    </aside>
    <p v-if="notice" class="open-notice">
      {{ notice }} <code v-if="requestId">关联编号：{{ requestId }}</code>
    </p>
    <section v-if="state === 'loading'" class="open-state">
      正在读取真实开放平台配置…
    </section>
    <section v-else-if="state === 'error'" class="open-state">
      <strong>读取失败</strong>
      <p>检查组织编号或请求内容后重试。</p>
      <button @click="load">重试</button>
    </section>
    <section v-else-if="state === 'rate_limited'" class="open-state">
      <strong>请求过于频繁</strong>
      <p>等待配额窗口恢复后重试，不要重复提交写操作。</p>
      <button @click="load">重新读取</button>
    </section>
    <section v-else-if="state === 'blocked'" class="open-state">
      <strong>开放平台依赖受阻</strong>
      <p>请在宝塔检查后端、任务处理和数据库，恢复后按关联编号重试。</p>
      <button @click="load">检查恢复</button>
    </section>
    <template v-else
      ><aside class="open-explain">
        <article>
          <strong>接口访问账号</strong
          ><span>让可信外部系统按授权范围读取数据，密钥可随时轮换或撤销。</span>
        </article>
        <article>
          <strong>事件回调地址</strong
          ><span
            >业务事件发生后主动通知指定网址，可测试、重放并查看每次投递结果。</span
          >
        </article>
        <article>
          <strong>投递记录</strong
          ><span>显示响应结果、重试次数和失败原因，便于定位外部系统问题。</span>
        </article>
      </aside>
      <section class="open-create">
        <label>名称<input v-model="form.name" maxlength="120" /></label
        ><label
          >事件回调安全网址<input
            v-model="form.target_url"
            placeholder="https://example.com/hooks/scoutops" /></label
        ><label>变更原因<input v-model="form.reason" maxlength="500" /></label
        ><button @click="createClient">创建接口访问账号</button
        ><button @click="createWebhook">创建事件回调地址</button>
      </section>
      <p v-if="state === 'empty'" class="open-state">
        当前筛选范围暂无接口访问账号、回调地址或投递记录。
      </p>
      <div class="open-grid">
        <section>
          <header>
            <h3>接口访问账号</h3>
            <small>独立密钥、时间校验和防重复请求</small>
          </header>
          <table>
            <thead>
              <tr>
                <th>名称</th>
                <th>权限 / 每分钟限额</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="x in data.clients" :key="x.id">
                <td data-label="名称">
                  {{ x.name }}<small>{{ x.client_prefix }}</small>
                </td>
                <td data-label="权限 / 每分钟限额">
                  {{ x.scopes.map(scopeText).join("、")
                  }}<small>每分钟 {{ x.quota_per_minute }} 次</small>
                </td>
                <td data-label="状态">
                  {{ statusText(x.status) }} · 第 {{ x.version }} 版
                </td>
                <td data-label="操作">
                  <button
                    @click="
                      prepare(
                        '轮换接口访问密钥',
                        `/platform/open/clients/${x.id}/actions`,
                        {
                          action: 'rotate',
                          expected_version: x.version,
                          reason: form.reason,
                        },
                      )
                    "
                  >
                    轮换</button
                  ><button
                    class="danger"
                    @click="
                      prepare(
                        '撤销接口访问账号',
                        `/platform/open/clients/${x.id}/actions`,
                        {
                          action: 'revoke',
                          expected_version: x.version,
                          reason: form.reason,
                        },
                      )
                    "
                  >
                    撤销
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </section>
        <section>
          <header>
            <h3>事件回调地址</h3>
            <small>签名校验 · 只允许安全网址</small>
          </header>
          <table>
            <thead>
              <tr>
                <th>名称</th>
                <th>事件</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="x in data.webhooks" :key="x.id">
                <td data-label="名称">
                  {{ x.name }}<small>{{ x.target_url }}</small>
                </td>
                <td data-label="事件">
                  {{ x.events.map(eventText).join("、") }}
                </td>
                <td data-label="状态">
                  {{ statusText(x.status) }} · 第 {{ x.version }} 版
                </td>
                <td data-label="操作">
                  <button
                    @click="
                      prepare(
                        '发送测试回调',
                        `/platform/open/webhooks/${x.id}/test`,
                        { reason: form.reason },
                      )
                    "
                  >
                    测试</button
                  ><button
                    @click="
                      prepare(
                        '轮换回调签名密钥',
                        `/platform/open/webhooks/${x.id}/rotate`,
                        { expected_version: x.version, reason: form.reason },
                      )
                    "
                  >
                    轮换密钥
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>
      <section class="open-deliveries">
        <header>
          <h3>投递记录</h3>
          <small>1 分钟、5 分钟、15 分钟后重试；第四次失败转为多次失败</small>
        </header>
        <table>
          <thead>
            <tr>
              <th>端点</th>
              <th>事件</th>
              <th>状态</th>
              <th>响应</th>
              <th>更新时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="x in data.deliveries" :key="x.id">
              <td data-label="端点">{{ x.endpoint_name }}</td>
              <td data-label="事件">{{ x.event_type }}</td>
              <td data-label="状态">
                {{ statusText(x.status) }} · {{ x.attempt_count }} 次
              </td>
              <td data-label="响应">
                {{ x.response_status ?? x.last_error_code ?? "—" }}
              </td>
              <td data-label="更新时间">{{ x.updated_at }}</td>
              <td data-label="操作">
                <button
                  v-if="['dead_letter', 'succeeded'].includes(x.status)"
                  @click="
                    prepare(
                      '重新投递回调',
                      `/platform/open/deliveries/${x.id}/replay`,
                      { reason: form.reason },
                    )
                  "
                >
                  重放
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </section></template
    >
  </section>
</template>
