<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ApiClientError, createApiClient } from "../api-client";
import ResponsiveDataView from "./ResponsiveDataView.vue";
import ResponsiveFilterDrawer from "./ResponsiveFilterDrawer.vue";
const props = defineProps<{ apiBaseUrl: string }>();
const request = createApiClient(props.apiBaseUrl);
type Section =
  "score_rules" | "cost_rules" | "approval_templates" | "automation_rules" | "releases";
const section = ref<Section>("score_rules"),
  state = ref<"loading" | "ready" | "empty" | "error">("loading"),
  data = ref<any>(null),
  query = ref(""),
  status = ref(""),
  message = ref(""),
  requestId = ref(""),
  selected = ref<any>(null);
const sections: Array<{
  value: Section;
  label: string;
  action: string;
  href: string;
}> = [
  {
    value: "score_rules",
    label: "评分规则",
    action: "进入评分规则",
    href: "/opportunities/scoring-rules",
  },
  {
    value: "cost_rules",
    label: "费用与风险",
    action: "进入费用规则",
    href: "/sourcing/cost-rules",
  },
  {
    value: "approval_templates",
    label: "审批工作流",
    action: "进入组织审批",
    href: "/org-admin/approvals",
  },
  {
    value: "automation_rules",
    label: "自动化规则",
    action: "进入自动化规则",
    href: "/automations",
  },
  {
    value: "releases",
    label: "灰度与回滚",
    action: "进入发布控制",
    href: "/platform-admin/releases",
  },
];
const current = computed(() => sections.find((item) => item.value === section.value)!);
const rows = computed<any[]>(() => data.value?.[section.value] ?? []);
const activeFilterCount = computed(
  () => Number(Boolean(query.value.trim())) + Number(Boolean(status.value)),
);
const summaryName = (key: string) =>
  (
    ({
      score_rules: "评分规则",
      cost_rules: "费用规则",
      approval_templates: "审批工作流",
      automation_rules: "自动化规则",
      releases: "发布版本",
      provider_versions: "来源配置版本",
    }) as Record<string, string>
  )[key] ?? key;
const statusName = (value: unknown) =>
  (
    ({
      active: "启用",
      enabled: "启用",
      disabled: "停用",
      paused: "暂停",
      draft: "草稿",
      published: "已发布",
      approved: "已批准",
      retired: "已退役",
      succeeded: "成功",
      failed: "失败",
      running: "进行中",
      stopped: "已停止",
      rolled_back: "已回滚",
    }) as Record<string, string>
  )[String(value)] ?? String(value ?? "—");
const typeName = (value: unknown) =>
  (
    ({
      "approval.overdue": "审批节点超时",
      "approval.node.rejected": "审批被驳回",
      "competitor.alert.queued": "竞品告警入队",
      "competitor.changed": "竞品发生变化",
      "task.created": "任务创建",
      notify_owner: "通知负责人",
      create_task: "创建人工任务",
      score_rules: "评分规则",
      cost_rules: "费用规则",
      approval_templates: "审批工作流",
      automation_rules: "自动化规则",
      releases: "发布版本",
    }) as Record<string, string>
  )[String(value)] ?? String(value ?? "—");
const editHref = (item: any) =>
  section.value === "automation_rules"
    ? `/automations?rule=${item.id}&action=edit`
    : current.value.href;
async function load() {
  state.value = "loading";
  message.value = "";
  const params = new URLSearchParams({ domain: "governance" });
  if (query.value.trim()) params.set("query", query.value.trim());
  if (status.value) params.set("status", status.value);
  try {
    const response = await request<any>(`/platform/management?${params}`);
    requestId.value = response.request_id;
    data.value = response.data;
    state.value = Object.values(response.data.summary).some(Number) ? "ready" : "empty";
  } catch (error) {
    const failure = error instanceof ApiClientError ? error : null;
    requestId.value = failure?.requestId ?? "";
    message.value = failure?.actionHint ?? "治理数据暂不可用";
    state.value = "error";
  }
}
onMounted(load);
</script>

<template>
  <section class="platform-governance">
    <header>
      <div>
        <p>平台规则中心</p>
        <h2>规则、工作流与自动化</h2>
        <span
          >统一核对跨组织规则版本、审批、自动化和发布回滚；写操作进入对应受权限保护的工作台。</span
        >
      </div>
      <RouterLink :to="current.href">{{ current.action }}</RouterLink>
    </header>
    <ResponsiveFilterDrawer label="筛选治理记录" :active-count="activeFilterCount">
      <form @submit.prevent="load">
        <input v-model="query" placeholder="搜索规则、版本、组织或工作区" maxlength="120" /><select
          v-model="status"
          aria-label="治理状态"
        >
          <option value="">全部状态</option>
          <option
            v-for="value in [
              'active',
              'enabled',
              'paused',
              'draft',
              'published',
              'approved',
              'retired',
              'disabled',
              'succeeded',
              'failed',
              'running',
              'stopped',
              'rolled_back',
            ]"
            :key="value"
            :value="value"
          >
            {{ statusName(value) }}
          </option></select
        ><button>筛选</button>
      </form>
    </ResponsiveFilterDrawer>
    <p v-if="message" class="governance-notice">{{ message }}</p>
    <section v-if="state !== 'ready'" class="governance-state">
      <h3>
        {{
          state === "loading"
            ? "正在读取治理事实"
            : state === "empty"
              ? "当前没有治理记录"
              : "治理数据暂不可用"
        }}
      </h3>
      <button v-if="state !== 'loading'" @click="load">重新加载</button>
    </section>
    <template v-else>
      <div class="governance-summary">
        <article v-for="(value, key) in data.summary" :key="key">
          <small>{{ summaryName(String(key)) }}</small
          ><strong>{{ value }}</strong>
        </article>
      </div>
      <nav aria-label="治理数据类型">
        <button
          v-for="item in sections"
          :key="item.value"
          :aria-current="section === item.value ? 'page' : undefined"
          @click="section = item.value"
        >
          {{ item.label }}
        </button>
      </nav>
      <div class="governance-table">
        <ResponsiveDataView
          :rows="rows"
          :row-key="(item) => item.id"
          :title="current.label"
          :detail-title="(item) => item.name"
          empty-message="当前分类没有匹配记录。"
        >
          <template #desktop
            ><table>
              <thead>
                <tr>
                  <th>名称 / 版本</th>
                  <th>组织 / 工作区</th>
                  <th>类型</th>
                  <th>状态</th>
                  <th>版本</th>
                  <th>更新时间</th>
                  <th>操作</th>
                  <th>技术信息</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in rows" :key="item.id">
                  <td>
                    <strong>{{ item.name }}</strong>
                  </td>
                  <td>
                    {{ item.organization_name || "平台全局"
                    }}<small>{{ item.workspace_name || item.stage || "—" }}</small>
                  </td>
                  <td>
                    {{
                      typeName(
                        item.trigger_event_type || item.resource_type || item.platform || section,
                      )
                    }}
                  </td>
                  <td>
                    <b>{{ statusName(item.status) }}</b>
                  </td>
                  <td>v{{ item.revision || item.version || item.current_version || "—" }}</td>
                  <td>
                    {{ item.updated_at ? new Date(item.updated_at).toLocaleString("zh-CN") : "—" }}
                  </td>
                  <td>
                    <button type="button" @click="selected = item">查看详情</button
                    ><RouterLink :to="editHref(item)">{{
                      section === "releases" ? "进入管理" : "编辑"
                    }}</RouterLink>
                  </td>
                  <td>
                    <details>
                      <summary>技术详情</summary>
                      <code>{{ item.version_code || item.id }}</code>
                    </details>
                  </td>
                </tr>
              </tbody>
            </table></template
          >
          <template #summary="{ row }">
            <span class="responsive-record-summary">
              <strong>{{ row.name }} · {{ statusName(row.status) }}</strong>
              <small
                >{{ row.organization_name || "平台全局" }} · 第
                {{ row.revision || row.version || row.current_version || "—" }} 版</small
              >
            </span>
          </template>
          <template #detail="{ row }">
            <dl>
              <div>
                <dt>所属组织</dt>
                <dd>{{ row.organization_name || "平台全局" }}</dd>
              </div>
              <div>
                <dt>工作区或阶段</dt>
                <dd>{{ row.workspace_name || row.stage || "—" }}</dd>
              </div>
              <div>
                <dt>类型</dt>
                <dd>
                  {{
                    typeName(row.trigger_event_type || row.resource_type || row.platform || section)
                  }}
                </dd>
              </div>
              <div>
                <dt>当前状态</dt>
                <dd>{{ statusName(row.status) }}</dd>
              </div>
              <div>
                <dt>版本</dt>
                <dd>第 {{ row.revision || row.version || row.current_version || "—" }} 版</dd>
              </div>
              <div>
                <dt>更新时间</dt>
                <dd>
                  {{ row.updated_at ? new Date(row.updated_at).toLocaleString("zh-CN") : "—" }}
                </dd>
              </div>
            </dl>
            <details>
              <summary>技术详情</summary>
              <dl>
                <div>
                  <dt>记录 ID</dt>
                  <dd>{{ row.id }}</dd>
                </div>
                <div v-if="row.version_code">
                  <dt>版本代码</dt>
                  <dd>{{ row.version_code }}</dd>
                </div>
              </dl>
            </details>
            <RouterLink :to="editHref(row)">{{
              section === "releases" ? "进入管理页面" : "进入编辑页面"
            }}</RouterLink>
          </template>
        </ResponsiveDataView>
      </div>
      <aside>
        <strong>配置版本</strong
        ><span
          >来源配置历史版本 {{ data.summary.provider_versions }} 个；最近变更
          {{
            data.provider_versions_latest_at
              ? new Date(data.provider_versions_latest_at).toLocaleString("zh-CN")
              : "暂无"
          }}。</span
        ><RouterLink to="/platform-admin/providers">进入来源版本管理</RouterLink>
      </aside>
      <footer>
        跨组织查看不会绕过业务权限；编辑、启停和发布仍使用版本锁并写入审计记录。
        <details v-if="requestId">
          <summary>技术详情</summary>
          <span>请求 ID {{ requestId }}</span>
        </details>
      </footer>
    </template>
    <dialog :open="Boolean(selected)" class="governance-detail">
      <section v-if="selected">
        <header>
          <div>
            <small>{{ current.label }}详情</small>
            <h3>{{ selected.name }}</h3>
          </div>
          <button aria-label="关闭" @click="selected = null">×</button>
        </header>
        <dl>
          <div>
            <dt>所属组织</dt>
            <dd>{{ selected.organization_name || "平台全局" }}</dd>
          </div>
          <div>
            <dt>工作区或阶段</dt>
            <dd>{{ selected.workspace_name || selected.stage || "—" }}</dd>
          </div>
          <div>
            <dt>当前状态</dt>
            <dd>{{ statusName(selected.status) }}</dd>
          </div>
          <div>
            <dt>版本</dt>
            <dd>
              第
              {{ selected.revision || selected.version || selected.current_version || "—" }}
              版
            </dd>
          </div>
          <div v-if="selected.trigger_event_type">
            <dt>触发条件</dt>
            <dd>
              {{ typeName(selected.trigger_event_type) }}，严重程度
              {{
                selected.condition_severity === "any"
                  ? "不限"
                  : statusName(selected.condition_severity)
              }}
            </dd>
          </div>
          <div v-if="selected.action_type">
            <dt>执行动作</dt>
            <dd>{{ typeName(selected.action_type) }}：{{ selected.action_title }}</dd>
          </div>
          <div v-if="selected.rate_limit_count">
            <dt>执行频率上限</dt>
            <dd>
              {{ selected.rate_limit_count }} 次 / {{ selected.rate_limit_window_minutes }} 分钟
            </dd>
          </div>
          <div>
            <dt>更新时间</dt>
            <dd>
              {{
                selected.updated_at ? new Date(selected.updated_at).toLocaleString("zh-CN") : "—"
              }}
            </dd>
          </div>
        </dl>
        <details>
          <summary>技术详情</summary>
          <dl>
            <div>
              <dt>记录 ID</dt>
              <dd>{{ selected.id }}</dd>
            </div>
            <div v-if="selected.version_code">
              <dt>版本代码</dt>
              <dd>{{ selected.version_code }}</dd>
            </div>
          </dl>
        </details>
        <footer>
          <button @click="selected = null">关闭</button
          ><RouterLink :to="editHref(selected)">{{
            section === "releases" ? "进入管理页面" : "进入编辑页面"
          }}</RouterLink>
        </footer>
      </section>
    </dialog>
  </section>
</template>

<style scoped>
.platform-governance {
  display: grid;
  gap: 16px;
  color: var(--so-text);
}
.platform-governance > header {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  padding: 22px;
  border: 1px solid var(--so-border);
  border-radius: 16px;
  background: var(--so-panel);
}
.platform-governance p {
  margin: 0;
}
.platform-governance header p {
  color: var(--so-primary);
  font-size: 10px;
  font-weight: 850;
  letter-spacing: 0.16em;
}
.platform-governance h2 {
  margin: 7px 0;
}
.platform-governance header span,
.platform-governance footer,
.platform-governance small {
  color: var(--so-text-muted);
}
.platform-governance a,
.platform-governance button {
  padding: 9px 12px;
  border: 1px solid var(--so-border);
  border-radius: 9px;
  background: var(--so-panel-soft);
  color: var(--so-text);
  text-decoration: none;
}
.platform-governance header > a {
  align-self: flex-start;
  background: var(--so-primary-strong);
  color: var(--so-on-primary);
}
.platform-governance form,
.platform-governance nav {
  display: flex;
  gap: 8px;
}
.platform-governance input,
.platform-governance select {
  padding: 9px 12px;
  border: 1px solid var(--so-border);
  border-radius: 9px;
  background: var(--so-panel-soft);
  color: var(--so-text);
}
.platform-governance form input:first-child {
  flex: 1;
}
.platform-governance nav {
  flex-wrap: wrap;
}
.platform-governance nav button[aria-current="page"] {
  background: var(--so-primary-strong);
  color: var(--so-on-primary);
}
.governance-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 9px;
}
.governance-summary article,
.governance-table,
.platform-governance aside,
.governance-state,
.governance-notice {
  padding: 16px;
  border: 1px solid var(--so-border);
  border-radius: 13px;
  background: var(--so-panel);
}
.governance-summary small,
.governance-summary strong,
.governance-table small {
  display: block;
}
.governance-summary strong {
  margin-top: 6px;
  font-size: 23px;
}
.governance-table {
  overflow: auto;
}
.governance-table table {
  width: 100%;
  border-collapse: collapse;
}
.governance-table th,
.governance-table td {
  padding: 11px 9px;
  border-bottom: 1px solid var(--so-border);
  text-align: left;
  font-size: 12px;
}
.governance-table td small {
  margin-top: 4px;
}
.governance-table details summary,
.platform-governance footer details summary,
.governance-detail > section > details summary {
  display: inline-flex;
  min-height: var(--so-touch-target);
  align-items: center;
  color: var(--so-primary);
  cursor: pointer;
}
.governance-table code,
.platform-governance footer span,
.governance-detail > section > details dd {
  overflow-wrap: anywhere;
}
.platform-governance aside {
  display: flex;
  align-items: center;
  gap: 12px;
}
.platform-governance aside span {
  flex: 1;
  color: var(--so-text-muted);
}
.platform-governance footer {
  text-align: right;
  font-size: 11px;
}
.governance-detail {
  position: fixed;
  inset: 50% auto auto 50%;
  transform: translate(-50%, -50%);
  width: min(620px, calc(100% - 28px));
  max-height: calc(100vh - 32px);
  overflow: auto;
  padding: 0;
  border: 1px solid var(--so-border);
  border-radius: 16px;
  background: var(--so-bg-elevated);
  color: var(--so-text);
  z-index: 100;
}
.governance-detail section {
  padding: 22px;
}
.governance-detail header,
.governance-detail footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.governance-detail header h3 {
  margin: 5px 0 0;
}
.governance-detail header button {
  border: 0;
  background: transparent;
  font-size: 24px;
}
.governance-detail dl {
  display: grid;
  gap: 8px;
  margin: 18px 0;
}
.governance-detail dl div {
  display: grid;
  grid-template-columns: 145px 1fr;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--so-border);
}
.governance-detail dt {
  color: var(--so-text-muted);
}
.governance-detail dd {
  margin: 0;
}
.governance-detail footer {
  justify-content: flex-end;
}
.governance-detail footer a {
  background: var(--so-primary-strong);
  color: var(--so-on-primary);
}
@media (max-width: 760px) {
  .platform-governance > header,
  .platform-governance form,
  .platform-governance aside {
    flex-direction: column;
  }
  .platform-governance form input,
  .platform-governance form select,
  .platform-governance form button {
    width: 100%;
  }
}
</style>
