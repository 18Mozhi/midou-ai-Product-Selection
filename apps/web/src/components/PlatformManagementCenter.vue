<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";

type Domain = "content" | "notifications" | "email" | "status";
const props = defineProps<{ apiBaseUrl: string; domain: string }>();
const domain = computed<Domain>(
  () =>
    (["content", "notifications", "email", "status"].includes(props.domain)
      ? props.domain
      : "status") as Domain,
);
const state = ref<"loading" | "ready" | "empty" | "error">("loading");
const data = ref<any>(null),
  query = ref(""),
  status = ref(""),
  message = ref(""),
  requestId = ref(""),
  busy = ref("");
const reviewItem = ref<any>(null),
  reviewStatus = ref<"active" | "irrelevant" | "stale">("active"),
  reviewReason = ref("");
const titles: Record<Domain, [string, string]> = {
  content: ["内容管理", "审核跨组织热点内容，处理无关和过期主题。"],
  notifications: [
    "通知管理",
    "查看站内通知、接收人、已读状态和各渠道投递结果。",
  ],
  email: ["邮件管理", "统一查看账号邮件与业务通知邮件的队列、失败和死信状态。"],
  status: [
    "系统状态",
    "查看 API、数据库、账号、来源和采集任务的真实运行状态。",
  ],
};
const summaryEntries = computed(() =>
  Object.entries(data.value?.summary ?? {}),
);
const summaryName = (key: string) =>
  (
    ({
      total: "总记录",
      active: "展示中",
      review: "需复核",
      unread: "未读",
      critical: "严重",
      succeeded: "已送达",
      blocked: "受阻",
      api: "API",
      database: "数据库",
      dashboard_reads: "15 分钟访问",
      active_organizations: "活动组织",
      active_users: "活动用户",
    }) as Record<string, string>
  )[key] ?? key;
const stateName = (value: unknown) =>
  (
    ({
      active: "展示中",
      irrelevant: "无关",
      stale: "已过期",
      delivered: "已送达",
      succeeded: "成功",
      pending: "等待",
      pending_placeholder: "待配置",
      blocked_provider: "服务商受阻",
      dead_letter: "死信",
      failed: "失败",
      healthy: "正常",
      enabled: "启用",
      disabled: "停用",
      read: "已读",
      unread: "未读",
    }) as Record<string, string>
  )[String(value)] ?? String(value ?? "—");
const when = (value: unknown) =>
  value ? new Date(String(value)).toLocaleString("zh-CN") : "—";
async function load() {
  state.value = "loading";
  message.value = "";
  const params = new URLSearchParams({ domain: domain.value });
  if (query.value.trim()) params.set("query", query.value.trim());
  if (status.value) params.set("status", status.value);
  try {
    const response = await fetch(
        `${props.apiBaseUrl}/platform/management?${params}`,
        { credentials: "include", headers: { accept: "application/json" } },
      ),
      body = await response.json().catch(() => null);
    requestId.value = body?.request_id ?? "";
    if (!response.ok)
      throw new Error(body?.error?.action_hint ?? "管理数据暂不可用");
    data.value = body.data;
    const count =
      domain.value === "status"
        ? (body.data?.collections?.length ?? 0) +
          (body.data?.sources?.length ?? 0)
        : (body.data?.items?.length ?? 0);
    state.value = count || domain.value === "status" ? "ready" : "empty";
  } catch (error) {
    message.value = error instanceof Error ? error.message : "管理数据暂不可用";
    state.value = "error";
  }
}
function beginReview(
  item: any,
  statusValue: "active" | "irrelevant" | "stale",
) {
  reviewItem.value = item;
  reviewStatus.value = statusValue;
  reviewReason.value = "";
}
async function submitReview() {
  if (!reviewItem.value || reviewReason.value.trim().length < 2) return;
  busy.value = reviewItem.value.id;
  message.value = "";
  try {
    const response = await fetch(
        `${props.apiBaseUrl}/platform/management/content/${reviewItem.value.id}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            "content-type": "application/json",
            "idempotency-key": crypto.randomUUID(),
          },
          body: JSON.stringify({
            status: reviewStatus.value,
            expected_version: reviewItem.value.version,
            reason: reviewReason.value.trim(),
          }),
        },
      ),
      body = await response.json().catch(() => null);
    requestId.value = body?.request_id ?? requestId.value;
    if (!response.ok)
      throw new Error(body?.error?.action_hint ?? "内容审核未完成");
    reviewItem.value = null;
    await load();
    message.value = "内容状态已更新并写入审计记录。";
  } catch (error) {
    message.value = error instanceof Error ? error.message : "内容审核未完成";
  } finally {
    busy.value = "";
  }
}
async function manageEmail(item: any, action: "retry" | "suppress") {
  const actionName = action === "retry" ? "重新投递" : "抑制投递";
  const reason = window.prompt(
    `请输入${actionName}原因（2–300 字）`,
    "人工处理邮件队列",
  );
  if (reason === null) return;
  if (reason.trim().length < 2) {
    message.value = "操作原因至少需要 2 个字。";
    return;
  }
  busy.value = item.id;
  message.value = "";
  try {
    const response = await fetch(
        `${props.apiBaseUrl}/platform/management/email/${item.source_type}/${item.id}/actions`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "content-type": "application/json",
            "idempotency-key": crypto.randomUUID(),
          },
          body: JSON.stringify({ action, reason: reason.trim() }),
        },
      ),
      body = await response.json().catch(() => null);
    requestId.value = body?.request_id ?? requestId.value;
    if (!response.ok)
      throw new Error(body?.error?.action_hint ?? `${actionName}未完成`);
    await load();
    message.value = `${actionName}已完成并写入审计记录。`;
  } catch (error) {
    message.value =
      error instanceof Error ? error.message : `${actionName}未完成`;
  } finally {
    busy.value = "";
  }
}
watch(domain, () => {
  query.value = "";
  status.value = "";
  reviewItem.value = null;
  load();
});
onMounted(load);
</script>

<template>
  <section class="platform-management" aria-live="polite">
    <header class="platform-management-hero">
      <div>
        <p>PLATFORM OPERATIONS</p>
        <h2>{{ titles[domain][0] }}</h2>
        <span>{{ titles[domain][1] }}</span>
      </div>
      <button type="button" @click="load">刷新数据</button>
    </header>
    <form
      v-if="domain !== 'status'"
      class="platform-management-filter"
      @submit.prevent="load"
    >
      <input
        v-model="query"
        :placeholder="
          domain === 'content' ? '搜索主题、分类或市场' : '搜索标题、邮箱或组织'
        "
      /><select v-model="status">
        <option value="">全部状态</option>
        <template v-if="domain === 'content'"
          ><option value="active">展示中</option>
          <option value="irrelevant">无关</option>
          <option value="stale">已过期</option></template
        ><template v-else-if="domain === 'notifications'"
          ><option value="task">任务</option>
          <option value="approval">审批</option>
          <option value="competitor">竞品</option>
          <option value="system">系统</option></template
        ><template v-else
          ><option value="succeeded">已送达</option>
          <option value="blocked_provider">服务商受阻</option>
          <option value="dead_letter">死信</option>
          <option value="failed">失败</option></template
        ></select
      ><button>筛选</button>
    </form>
    <p v-if="message" class="platform-management-message">{{ message }}</p>
    <section v-if="state !== 'ready'" class="platform-management-state">
      <h3>
        {{
          state === "loading"
            ? "正在读取管理数据"
            : state === "empty"
              ? "当前筛选没有记录"
              : "管理数据暂不可用"
        }}
      </h3>
      <p v-if="message">{{ message }}</p>
      <button v-if="state !== 'loading'" @click="load">重新加载</button>
    </section>
    <template v-else-if="data"
      ><div class="platform-management-kpis">
        <article v-for="[key, value] in summaryEntries" :key="key">
          <small>{{ summaryName(key) }}</small
          ><strong :data-state="value">{{ stateName(value) }}</strong>
        </article>
      </div>
      <div v-if="domain === 'content'" class="platform-management-table">
        <table>
          <thead>
            <tr>
              <th>热点主题</th>
              <th>组织 / 工作区</th>
              <th>市场</th>
              <th>信号 / 来源</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in data.items" :key="item.id">
              <td data-label="热点主题">
                <strong>{{ item.title }}</strong
                ><small
                  >{{ item.category || "未分类" }} · 热度
                  {{ item.heat_value }}</small
                >
              </td>
              <td data-label="组织 / 工作区">
                {{ item.organization_name
                }}<small>{{ item.workspace_name }}</small>
              </td>
              <td data-label="市场">{{ item.market }} · {{ item.language }}</td>
              <td data-label="信号 / 来源">
                {{ item.signal_count }} / {{ item.source_count }}
              </td>
              <td data-label="状态">
                <b :data-state="item.status">{{ stateName(item.status) }}</b>
              </td>
              <td data-label="操作">
                <button title="设为展示中" @click="beginReview(item, 'active')">
                  展示</button
                ><button
                  title="标记为无关"
                  @click="beginReview(item, 'irrelevant')"
                >
                  无关</button
                ><button title="标记为过期" @click="beginReview(item, 'stale')">
                  过期
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <section v-else-if="domain === 'notifications'" class="notification-ops">
        <div class="notification-ops-grid">
          <article>
            <header>
              <h3>系统模板</h3>
              <span>Worker 固定合同，不在页面任意改文案</span>
            </header>
            <ul>
              <li v-for="item in data.templates" :key="item.category">
                <strong>{{ item.title }}</strong
                ><small>{{ item.event_pattern }} · {{ item.status }}</small>
              </li>
            </ul>
          </article>
          <article>
            <header>
              <h3>渠道状态</h3>
              <a href="/platform-admin/email">管理失败投递</a>
            </header>
            <ul>
              <li v-for="item in data.channels" :key="item.code">
                <strong>{{ item.name }} · {{ item.status }}</strong
                ><small>{{
                  item.deliveries
                    .map((x: any) => `${x.status}:${x.total}`)
                    .join("，") || "暂无投递"
                }}</small>
              </li>
            </ul>
          </article>
          <article>
            <header>
              <h3>用户订阅</h3>
              <a href="/me">个人偏好入口</a>
            </header>
            <dl>
              <div v-for="(value, key) in data.subscriptions" :key="key">
                <dt>{{ key }}</dt>
                <dd>{{ value }}</dd>
              </div>
            </dl>
          </article>
          <article>
            <header>
              <h3>告警路由</h3>
              <a href="/platform-admin/governance">规则总览</a>
            </header>
            <ul>
              <li v-for="item in data.alert_routes.slice(0, 6)" :key="item.id">
                <strong>{{ item.name }}</strong
                ><small
                  >{{ item.event_type }} → {{ item.action_type }} ·
                  {{ item.status }}</small
                >
              </li>
            </ul>
            <p v-if="!data.alert_routes.length">暂无告警路由。</p>
          </article>
        </div>
        <div class="platform-management-table">
          <header class="notification-delivery-head">
            <div>
              <h3>通知与投递记录</h3>
              <span>按接收人、组织、类型和渠道查看</span>
            </div>
            <a href="/automations">新增或编辑自动化路由</a>
          </header>
          <table>
            <thead>
              <tr>
                <th>通知</th>
                <th>接收人</th>
                <th>组织</th>
                <th>类型 / 级别</th>
                <th>阅读</th>
                <th>投递</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in data.items" :key="item.id">
                <td data-label="通知">
                  <strong>{{ item.title }}</strong
                  ><small>{{ when(item.created_at) }}</small>
                </td>
                <td data-label="接收人">{{ item.recipient_email }}</td>
                <td data-label="组织">{{ item.organization_name }}</td>
                <td data-label="类型 / 级别">
                  {{ item.category }} / {{ item.severity }}
                </td>
                <td data-label="阅读">{{ item.read_at ? "已读" : "未读" }}</td>
                <td data-label="投递">
                  {{ item.delivery_status || "无渠道记录" }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <div v-else-if="domain === 'email'" class="platform-management-table">
        <table>
          <thead>
            <tr>
              <th>邮件</th>
              <th>接收邮箱</th>
              <th>类别</th>
              <th>状态</th>
              <th>尝试</th>
              <th>最近错误 / 更新时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in data.items" :key="item.id">
              <td data-label="邮件">
                <strong>{{ item.title || item.kind }}</strong
                ><small>{{ item.source }}</small>
              </td>
              <td data-label="接收邮箱">{{ item.email }}</td>
              <td data-label="类别">{{ item.kind || "业务通知" }}</td>
              <td data-label="状态">
                <b :data-state="item.status">{{ stateName(item.status) }}</b>
              </td>
              <td data-label="尝试">{{ item.attempt_count }}</td>
              <td data-label="最近错误 / 更新时间">
                {{ item.last_error_code || "无错误"
                }}<small>{{ when(item.updated_at) }}</small>
              </td>
              <td data-label="操作">
                <button
                  v-if="
                    (item.source_type === 'account' &&
                      [
                        'blocked_provider',
                        'dead_letter',
                        'retry_scheduled',
                      ].includes(item.status)) ||
                    (item.source_type === 'notification' &&
                      ['failed', 'dead_letter', 'suppressed'].includes(
                        item.status,
                      ))
                  "
                  title="将失败邮件重新放入投递队列"
                  :disabled="busy === item.id"
                  @click="manageEmail(item, 'retry')"
                >
                  重新投递
                </button>
                <button
                  v-if="
                    item.source_type === 'notification' &&
                    !['delivered', 'suppressed'].includes(item.status)
                  "
                  title="停止本条业务通知邮件继续投递"
                  :disabled="busy === item.id"
                  @click="manageEmail(item, 'suppress')"
                >
                  抑制投递
                </button>
                <span
                  v-if="
                    !(
                      (item.source_type === 'account' &&
                        [
                          'blocked_provider',
                          'dead_letter',
                          'retry_scheduled',
                        ].includes(item.status)) ||
                      (item.source_type === 'notification' &&
                        !['delivered'].includes(item.status))
                    )
                  "
                  >无需处理</span
                >
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="platform-status-grid">
        <section>
          <h3>采集任务状态</h3>
          <div v-for="item in data.collections" :key="item.status">
            <span>{{ stateName(item.status) }}</span
            ><strong>{{ item.total }}</strong>
          </div>
          <a href="/platform-admin/collection/overview">查看任务详情</a>
        </section>
        <section>
          <h3>来源状态</h3>
          <div v-for="item in data.sources" :key="item.status">
            <span>{{ stateName(item.status) }}</span
            ><strong>{{ item.total }}</strong>
          </div>
          <a href="/platform-admin/providers/sources">管理来源配置</a>
        </section>
      </div>
      <footer>
        观测时间 {{ when(data.observed_at) }} · request_id {{ requestId }}
      </footer></template
    >
    <dialog :open="Boolean(reviewItem)">
      <form @submit.prevent="submitReview">
        <h3>审核热点内容</h3>
        <p>{{ reviewItem?.title }}</p>
        <label
          >目标状态<select v-model="reviewStatus">
            <option value="active">展示中</option>
            <option value="irrelevant">无关</option>
            <option value="stale">已过期</option>
          </select></label
        ><label
          >审核原因<textarea
            v-model="reviewReason"
            required
            minlength="2"
            maxlength="300"
            rows="4"
            placeholder="说明判断依据，操作会写入审计记录"
          ></textarea>
        </label>
        <footer>
          <button type="button" @click="reviewItem = null">取消</button
          ><button :disabled="reviewReason.trim().length < 2 || Boolean(busy)">
            确认更新
          </button>
        </footer>
      </form>
    </dialog>
  </section>
</template>

<style scoped>
.platform-management {
  display: grid;
  gap: 18px;
  color: #dce8f3;
}
.platform-management-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 24px;
  border: 1px solid #28475b;
  border-radius: 17px;
  background: linear-gradient(135deg, #0a1824, #123246);
}
.platform-management-hero p {
  margin: 0;
  color: #31d6c4;
  font: 700 11px monospace;
  letter-spacing: 0.14em;
}
.platform-management-hero h2 {
  margin: 6px 0;
  font-size: 28px;
}
.platform-management-hero span {
  color: #91a8b9;
}
.platform-management button,
.platform-management select,
.platform-management input,
.platform-management textarea {
  box-sizing: border-box;
  border: 1px solid #31536a;
  border-radius: 9px;
  background: #0b1d29;
  color: #dce8f3;
  padding: 9px 12px;
  font: inherit;
}
.platform-management button {
  cursor: pointer;
}
.platform-management-hero button,
.platform-management-filter button,
dialog footer button:last-child {
  border-color: #31d6c4;
  background: #31d6c4;
  color: #08231d;
  font-weight: 800;
}
.platform-management-filter {
  display: flex;
  gap: 9px;
}
.platform-management-filter input {
  flex: 1;
}
.platform-management-kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}
.platform-management-kpis article,
.platform-management-table,
.platform-status-grid section {
  padding: 17px;
  border: 1px solid #20384b;
  border-radius: 14px;
  background: #0d1d29;
}
.platform-management-kpis small {
  display: block;
  color: #8198aa;
}
.platform-management-kpis strong {
  display: block;
  margin-top: 8px;
  font-size: 23px;
}
.platform-management-table {
  overflow: auto;
}
.platform-management table {
  width: 100%;
  border-collapse: collapse;
}
.platform-management th,
.platform-management td {
  padding: 12px 9px;
  text-align: left;
  border-bottom: 1px solid #1d3547;
  font-size: 13px;
}
.platform-management td strong,
.platform-management td small {
  display: block;
}
.platform-management td small {
  margin-top: 4px;
  color: #7892a5;
}
.platform-management td button {
  margin: 2px;
  padding: 6px 9px;
}
.platform-management b[data-state="active"],
.platform-management b[data-state="delivered"],
.platform-management b[data-state="succeeded"] {
  color: #35d4a1;
}
.platform-management b[data-state="irrelevant"],
.platform-management b[data-state="stale"],
.platform-management b[data-state="dead_letter"],
.platform-management b[data-state="failed"] {
  color: #ff8b94;
}
.platform-management-state,
.platform-management-message {
  padding: 24px;
  text-align: center;
  border: 1px dashed #31536a;
  border-radius: 14px;
  background: #0d1d29;
}
.platform-management-message {
  padding: 12px;
  border-style: solid;
  color: #b9f4e7;
}
.platform-status-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.platform-status-grid h3 {
  margin-top: 0;
}
.platform-status-grid section div {
  display: flex;
  justify-content: space-between;
  padding: 10px;
  border-bottom: 1px solid #1d3547;
}
.platform-status-grid a {
  display: inline-block;
  margin-top: 14px;
  color: #4fe3cf;
}
.platform-management > template + footer,
.platform-management > footer {
  color: #7892a5;
  text-align: right;
  font-size: 11px;
}
dialog {
  position: fixed;
  inset: 0;
  margin: auto;
  border: 1px solid #31536a;
  border-radius: 16px;
  background: #0d1d29;
  color: #dce8f3;
  box-shadow: 0 24px 80px #0009;
}
dialog form {
  display: grid;
  gap: 14px;
  min-width: min(430px, 80vw);
  padding: 10px;
}
dialog label {
  display: grid;
  gap: 6px;
}
dialog footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.notification-ops {
  display: grid;
  gap: 14px;
}
.notification-ops-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.notification-ops-grid article {
  padding: 16px;
  border: 1px solid #20384b;
  border-radius: 13px;
  background: #0d1d29;
}
.notification-ops-grid header,
.notification-delivery-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.notification-ops-grid h3,
.notification-delivery-head h3 {
  margin: 0;
}
.notification-ops-grid header span,
.notification-delivery-head span {
  color: #7892a5;
  font-size: 11px;
}
.notification-ops-grid a,
.notification-delivery-head a {
  color: #4fe3cf;
  font-size: 11px;
}
.notification-ops-grid ul {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
}
.notification-ops-grid li {
  padding: 9px 0;
  border-top: 1px solid #1d3547;
}
.notification-ops-grid li strong,
.notification-ops-grid li small {
  display: block;
}
.notification-ops-grid li small {
  margin-top: 4px;
  color: #7892a5;
}
.notification-ops-grid dl {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.notification-ops-grid dl div {
  padding: 9px;
  border-radius: 8px;
  background: #0b1d29;
}
.notification-ops-grid dd {
  margin: 4px 0 0;
  font-weight: 800;
}
.notification-delivery-head {
  margin-bottom: 12px;
}
@media (max-width: 700px) {
  .platform-management-hero {
    align-items: flex-start;
    flex-direction: column;
  }
  .platform-management-filter {
    flex-direction: column;
  }
  .platform-status-grid {
    grid-template-columns: 1fr;
  }
  .notification-ops-grid {
    grid-template-columns: 1fr;
  }
  .platform-management-table {
    padding: 8px;
  }
  .platform-management table {
    min-width: 760px;
  }
}
</style>
