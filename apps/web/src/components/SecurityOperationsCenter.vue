<script setup lang="ts">
import { onMounted, ref } from "vue";
const props = defineProps<{ apiBaseUrl: string }>();
const state = ref("loading"),
  data = ref<any>(null),
  windowCode = ref("24h"),
  requestId = ref(""),
  hint = ref("");
async function load() {
  state.value = "loading";
  try {
    const r = await fetch(
        `${props.apiBaseUrl}/platform/security/operations?window=${windowCode.value}`,
        { credentials: "include", headers: { accept: "application/json" } },
      ),
      b = await r.json().catch(() => null);
    requestId.value = b?.request_id ?? "";
    hint.value = b?.error?.action_hint ?? "";
    if (!r.ok) {
      state.value =
        r.status === 401
          ? "expired"
          : r.status === 403
            ? "forbidden"
            : r.status === 429
              ? "rate_limited"
              : "blocked";
      return;
    }
    data.value = b.data;
    state.value = Object.values(b.data.summary).some(Number)
      ? "ready"
      : "empty";
  } catch {
    state.value = "blocked";
  }
}
onMounted(load);
const when = (v: string | null) => (v ? new Date(v).toLocaleString() : "—");
const summaryText = (value: string) =>
  (
    ({
      security_events: "安全事件",
      risk_events: "风险事件",
      active_sessions: "活动登录",
      active_credentials: "可用凭证",
      credentials_expiring: "七天内到期",
      active_org_tokens: "活动访问令牌",
    }) as Record<string, string>
  )[value] ?? value;
const statusText = (value: string) =>
  (
    ({
      active: "可用",
      revoked: "已撤销",
      expired: "已过期",
      succeeded: "成功",
      failed: "失败",
      blocked: "已阻止",
      allowed: "已允许",
    }) as Record<string, string>
  )[value] ?? "其他状态";
const kindText = (value: string) =>
  (
    ({
      api_key: "接口密钥",
      account_secret: "账号资料",
      cookie_bundle: "登录状态",
      private_key: "私钥",
      browser_profile: "网页登录档案",
    }) as Record<string, string>
  )[value] ?? "其他凭证";
const eventText = (value: string) =>
  (
    ({
      login_succeeded: "登录成功",
      login_failed: "登录失败",
      session_revoked: "登录已撤销",
      mfa_failed: "二次验证失败",
      password_changed: "密码已修改",
    }) as Record<string, string>
  )[value] ?? "安全操作";
const scopeText = (value: string) =>
  (({ "status:read": "读取系统状态" }) as Record<string, string>)[value] ??
  "其他权限";
</script>
<template>
  <section class="security-ops">
    <header>
      <div>
        <p>平台安全运营中心</p>
        <h2>安全与密钥运营</h2>
        <span
          >集中查看登录风险、活动会话、访问令牌、凭证到期和审计记录；页面不会显示密码或登录密钥。</span
        >
      </div>
      <label
        >时间窗<select v-model="windowCode" @change="load">
          <option value="24h">24 小时</option>
          <option value="7d">7 天</option>
          <option value="30d">30 天</option>
        </select></label
      >
    </header>
    <section
      v-if="state !== 'ready'"
      class="platform-dashboard-state"
      :data-kind="state"
    >
      <h3>
        {{
          state === "loading"
            ? "正在读取安全事实"
            : state === "empty"
              ? "当前时间窗没有安全事件"
              : state === "expired"
                ? "登录已失效"
                : state === "forbidden"
                  ? "你没有安全运营权限"
                  : state === "rate_limited"
                    ? "请求过于频繁"
                    : "安全运营依赖受阻"
        }}
      </h3>
      <p>{{ hint || "刷新或由运维在宝塔检查后端与数据库。" }}</p>
      <code v-if="requestId">关联编号：{{ requestId }}</code
      ><button
        v-if="!['loading', 'expired', 'forbidden'].includes(state)"
        @click="load"
      >
        重新读取
      </button>
    </section>
    <template v-else-if="data"
      ><div class="security-kpis">
        <article v-for="(value, key) in data.summary" :key="key">
          <span>{{ summaryText(String(key)) }}</span
          ><strong>{{ value }}</strong>
        </article>
      </div>
      <div class="security-grid">
        <section>
          <h3>登录与风险事件</h3>
          <table>
            <tr v-for="e in data.security_events" :key="e.id">
              <td>
                <b>{{ eventText(e.event_type) }}</b
                ><small>{{ statusText(e.outcome) }}</small>
              </td>
              <td>{{ e.user_id ? e.user_id.slice(0, 8) + "…" : "匿名" }}</td>
              <td>
                <code>{{ e.trace_id.slice(0, 8) }}…</code>
              </td>
              <td>{{ when(e.occurred_at) }}</td>
            </tr>
          </table>
        </section>
        <section>
          <h3>活动与历史会话</h3>
          <table>
            <tr v-for="s in data.sessions" :key="s.id">
              <td>
                <b>{{ s.email }}</b
                ><small>{{ s.device_label }}</small>
              </td>
              <td>{{ statusText(s.status) }}</td>
              <td>{{ when(s.last_seen_at) }}</td>
            </tr>
          </table>
        </section>
        <section>
          <h3>凭证生命周期</h3>
          <table>
            <tr v-for="a in data.credential_assets" :key="a.id">
              <td>
                <b>{{ a.name }}</b
                ><small>{{ a.provider_name }} · {{ kindText(a.kind) }}</small>
              </td>
              <td>{{ statusText(a.status) }}</td>
              <td>{{ a.key_version }} · {{ a.fingerprint }}</td>
              <td>{{ when(a.expires_at) }}</td>
            </tr>
          </table>
          <a href="/platform-admin/credentials">进入凭证与档案</a>
        </section>
        <section>
          <h3>组织访问令牌</h3>
          <table>
            <tr v-for="t in data.organization_tokens" :key="t.id">
              <td>
                <b>{{ t.name }}</b
                ><small>{{ t.token_prefix }}</small>
              </td>
              <td>{{ statusText(t.status) }}</td>
              <td>{{ t.scopes.map(scopeText).join("、") }}</td>
              <td>{{ when(t.expires_at) }}</td>
            </tr>
          </table>
        </section>
      </div>
      <footer>
        数据更新时间 {{ when(data.observed_at)
        }}<span v-if="requestId"> · 关联编号 {{ requestId }}</span>
      </footer></template
    >
  </section>
</template>
