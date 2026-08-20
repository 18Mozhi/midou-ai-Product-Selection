<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ApiClientError, createApiClient } from "../api-client";
import ResponsiveDataView from "./ResponsiveDataView.vue";
const props = defineProps<{ apiBaseUrl: string }>();
const request = createApiClient(props.apiBaseUrl);
const state = ref("loading"),
  data = ref<any>(null),
  windowCode = ref("24h"),
  requestId = ref(""),
  hint = ref("");
async function load() {
  state.value = "loading";
  try {
    const response = await request<any>(`/platform/security/operations?window=${windowCode.value}`);
    requestId.value = response.request_id;
    data.value = response.data;
    state.value = Object.values(response.data.summary).some(Number) ? "ready" : "empty";
  } catch (error) {
    const failure = error instanceof ApiClientError ? error : null;
    requestId.value = failure?.requestId ?? "";
    hint.value = failure?.actionHint ?? "";
    state.value = failure?.kind ?? "blocked";
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
      "login.succeeded": "登录成功",
      "login.failed": "登录失败",
      session_revoked: "登录已撤销",
      mfa_failed: "二次验证失败",
      password_changed: "密码已修改",
    }) as Record<string, string>
  )[value] ?? "安全操作";
const scopeText = (value: string) =>
  (({ "status:read": "读取系统状态", "report:read": "读取报表" }) as Record<string, string>)[
    value
  ] ?? "其他权限";
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
    <section v-if="state !== 'ready'" class="platform-dashboard-state" :data-kind="state">
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
      <details v-if="requestId">
        <summary>技术详情</summary>
        <code>请求 ID：{{ requestId }}</code>
      </details>
      <button v-if="!['loading', 'expired', 'forbidden'].includes(state)" @click="load">
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
          <ResponsiveDataView
            :rows="data.security_events"
            :row-key="(item) => item.id"
            title="登录与风险事件"
            :detail-title="(item) => eventText(item.event_type)"
          >
            <template #desktop
              ><table>
                <tr v-for="item in data.security_events" :key="item.id">
                  <td>
                    <b>{{ eventText(item.event_type) }}</b
                    ><small>{{ statusText(item.outcome) }}</small>
                  </td>
                  <td>{{ item.user_id ? "已关联用户" : "匿名" }}</td>
                  <td>{{ when(item.occurred_at) }}</td>
                  <td>
                    <details>
                      <summary>技术详情</summary>
                      <dl>
                        <div>
                          <dt>事件 ID</dt>
                          <dd>{{ item.id }}</dd>
                        </div>
                        <div>
                          <dt>用户 ID</dt>
                          <dd>{{ item.user_id || "—" }}</dd>
                        </div>
                        <div>
                          <dt>请求 ID</dt>
                          <dd>{{ item.request_id || "—" }}</dd>
                        </div>
                        <div>
                          <dt>链路 ID</dt>
                          <dd>{{ item.trace_id || "—" }}</dd>
                        </div>
                      </dl>
                    </details>
                  </td>
                </tr>
              </table></template
            >
            <template #summary="{ row }"
              ><span class="responsive-record-summary"
                ><strong>{{ eventText(row.event_type) }} · {{ statusText(row.outcome) }}</strong
                ><small
                  >{{ row.user_id ? "已关联用户" : "匿名" }} · {{ when(row.occurred_at) }}</small
                ></span
              ></template
            >
            <template #detail="{ row }"
              ><dl>
                <div>
                  <dt>事件</dt>
                  <dd>{{ eventText(row.event_type) }}</dd>
                </div>
                <div>
                  <dt>结果</dt>
                  <dd>{{ statusText(row.outcome) }}</dd>
                </div>
                <div>
                  <dt>用户</dt>
                  <dd>{{ row.user_id ? "已关联用户" : "匿名" }}</dd>
                </div>
                <div>
                  <dt>发生时间</dt>
                  <dd>{{ when(row.occurred_at) }}</dd>
                </div>
              </dl>
              <details>
                <summary>技术详情</summary>
                <dl>
                  <div>
                    <dt>事件 ID</dt>
                    <dd>{{ row.id }}</dd>
                  </div>
                  <div>
                    <dt>用户 ID</dt>
                    <dd>{{ row.user_id || "—" }}</dd>
                  </div>
                  <div>
                    <dt>请求 ID</dt>
                    <dd>{{ row.request_id || "—" }}</dd>
                  </div>
                  <div>
                    <dt>链路 ID</dt>
                    <dd>{{ row.trace_id || "—" }}</dd>
                  </div>
                </dl>
              </details></template
            >
          </ResponsiveDataView>
        </section>
        <section>
          <h3>活动与历史会话</h3>
          <ResponsiveDataView
            :rows="data.sessions"
            :row-key="(item) => item.id"
            title="活动与历史会话"
            :detail-title="(item) => item.email"
          >
            <template #desktop
              ><table>
                <tr v-for="item in data.sessions" :key="item.id">
                  <td>
                    <b>{{ item.email }}</b
                    ><small>{{ item.device_label }}</small>
                  </td>
                  <td>{{ statusText(item.status) }}</td>
                  <td>{{ when(item.last_seen_at) }}</td>
                  <td>
                    <details>
                      <summary>技术详情</summary>
                      <dl>
                        <div>
                          <dt>会话 ID</dt>
                          <dd>{{ item.id }}</dd>
                        </div>
                        <div>
                          <dt>用户 ID</dt>
                          <dd>{{ item.user_id }}</dd>
                        </div>
                      </dl>
                    </details>
                  </td>
                </tr>
              </table></template
            >
            <template #summary="{ row }"
              ><span class="responsive-record-summary"
                ><strong>{{ row.email }} · {{ statusText(row.status) }}</strong
                ><small>{{ row.device_label }} · {{ when(row.last_seen_at) }}</small></span
              ></template
            >
            <template #detail="{ row }"
              ><dl>
                <div>
                  <dt>状态</dt>
                  <dd>{{ statusText(row.status) }}</dd>
                </div>
                <div>
                  <dt>设备</dt>
                  <dd>{{ row.device_label }}</dd>
                </div>
                <div>
                  <dt>最近活动</dt>
                  <dd>{{ when(row.last_seen_at) }}</dd>
                </div>
                <div>
                  <dt>到期时间</dt>
                  <dd>{{ when(row.expires_at) }}</dd>
                </div>
                <div>
                  <dt>创建时间</dt>
                  <dd>{{ when(row.created_at) }}</dd>
                </div>
              </dl>
              <details>
                <summary>技术详情</summary>
                <dl>
                  <div>
                    <dt>会话 ID</dt>
                    <dd>{{ row.id }}</dd>
                  </div>
                  <div>
                    <dt>用户 ID</dt>
                    <dd>{{ row.user_id }}</dd>
                  </div>
                </dl>
              </details></template
            >
          </ResponsiveDataView>
        </section>
        <section>
          <h3>凭证生命周期</h3>
          <ResponsiveDataView
            :rows="data.credential_assets"
            :row-key="(item) => item.id"
            title="凭证生命周期"
            :detail-title="(item) => item.name"
          >
            <template #desktop
              ><table>
                <tr v-for="item in data.credential_assets" :key="item.id">
                  <td>
                    <b>{{ item.name }}</b
                    ><small>{{ item.provider_name }} · {{ kindText(item.kind) }}</small>
                  </td>
                  <td>{{ statusText(item.status) }}</td>
                  <td>{{ when(item.expires_at) }}</td>
                  <td>
                    <details>
                      <summary>技术详情</summary>
                      <dl>
                        <div>
                          <dt>凭证 ID</dt>
                          <dd>{{ item.id }}</dd>
                        </div>
                        <div>
                          <dt>来源 ID</dt>
                          <dd>{{ item.provider_id }}</dd>
                        </div>
                        <div>
                          <dt>密钥版本</dt>
                          <dd>{{ item.key_version }}</dd>
                        </div>
                        <div>
                          <dt>脱敏指纹</dt>
                          <dd>{{ item.fingerprint }}</dd>
                        </div>
                      </dl>
                    </details>
                  </td>
                </tr>
              </table></template
            >
            <template #summary="{ row }"
              ><span class="responsive-record-summary"
                ><strong>{{ row.name }} · {{ statusText(row.status) }}</strong
                ><small
                  >{{ row.provider_name }} · {{ kindText(row.kind) }} ·
                  {{ when(row.expires_at) }}</small
                ></span
              ></template
            >
            <template #detail="{ row }"
              ><dl>
                <div>
                  <dt>来源</dt>
                  <dd>{{ row.provider_name }}</dd>
                </div>
                <div>
                  <dt>凭证类型</dt>
                  <dd>{{ kindText(row.kind) }}</dd>
                </div>
                <div>
                  <dt>状态</dt>
                  <dd>{{ statusText(row.status) }}</dd>
                </div>
                <div>
                  <dt>到期时间</dt>
                  <dd>{{ when(row.expires_at) }}</dd>
                </div>
                <div>
                  <dt>最近轮换</dt>
                  <dd>{{ when(row.rotated_at) }}</dd>
                </div>
              </dl>
              <details>
                <summary>技术详情</summary>
                <dl>
                  <div>
                    <dt>凭证 ID</dt>
                    <dd>{{ row.id }}</dd>
                  </div>
                  <div>
                    <dt>来源 ID</dt>
                    <dd>{{ row.provider_id }}</dd>
                  </div>
                  <div>
                    <dt>密钥版本</dt>
                    <dd>{{ row.key_version }}</dd>
                  </div>
                  <div>
                    <dt>脱敏指纹</dt>
                    <dd>{{ row.fingerprint }}</dd>
                  </div>
                </dl>
              </details></template
            >
          </ResponsiveDataView>
          <a href="/platform-admin/credentials">进入凭证与档案</a>
        </section>
        <section>
          <h3>组织访问令牌</h3>
          <ResponsiveDataView
            :rows="data.organization_tokens"
            :row-key="(item) => item.id"
            title="组织访问令牌"
            :detail-title="(item) => item.name"
          >
            <template #desktop
              ><table>
                <tr v-for="item in data.organization_tokens" :key="item.id">
                  <td>
                    <b>{{ item.name }}</b>
                  </td>
                  <td>{{ statusText(item.status) }}</td>
                  <td>{{ item.scopes.map(scopeText).join("、") }}</td>
                  <td>{{ when(item.expires_at) }}</td>
                  <td>
                    <details>
                      <summary>技术详情</summary>
                      <dl>
                        <div>
                          <dt>令牌 ID</dt>
                          <dd>{{ item.id }}</dd>
                        </div>
                        <div>
                          <dt>组织 ID</dt>
                          <dd>{{ item.organization_id }}</dd>
                        </div>
                        <div>
                          <dt>令牌前缀</dt>
                          <dd>{{ item.token_prefix }}</dd>
                        </div>
                      </dl>
                    </details>
                  </td>
                </tr>
              </table></template
            >
            <template #summary="{ row }"
              ><span class="responsive-record-summary"
                ><strong>{{ row.name }} · {{ statusText(row.status) }}</strong
                ><small
                  >{{ row.scopes.map(scopeText).join("、") }} · {{ when(row.expires_at) }}</small
                ></span
              ></template
            >
            <template #detail="{ row }"
              ><dl>
                <div>
                  <dt>状态</dt>
                  <dd>{{ statusText(row.status) }}</dd>
                </div>
                <div>
                  <dt>权限</dt>
                  <dd>{{ row.scopes.map(scopeText).join("、") }}</dd>
                </div>
                <div>
                  <dt>到期时间</dt>
                  <dd>{{ when(row.expires_at) }}</dd>
                </div>
                <div>
                  <dt>最近使用</dt>
                  <dd>{{ when(row.last_used_at) }}</dd>
                </div>
              </dl>
              <details>
                <summary>技术详情</summary>
                <dl>
                  <div>
                    <dt>令牌 ID</dt>
                    <dd>{{ row.id }}</dd>
                  </div>
                  <div>
                    <dt>组织 ID</dt>
                    <dd>{{ row.organization_id }}</dd>
                  </div>
                  <div>
                    <dt>令牌前缀</dt>
                    <dd>{{ row.token_prefix }}</dd>
                  </div>
                </dl>
              </details></template
            >
          </ResponsiveDataView>
        </section>
      </div>
      <footer>
        数据更新时间 {{ when(data.observed_at) }}
        <details v-if="requestId">
          <summary>技术详情</summary>
          <span>请求 ID {{ requestId }}</span>
        </details>
      </footer></template
    >
  </section>
</template>
