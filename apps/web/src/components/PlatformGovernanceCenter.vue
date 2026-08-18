<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
const props = defineProps<{ apiBaseUrl: string }>();
type Section =
  | "score_rules"
  | "cost_rules"
  | "approval_templates"
  | "automation_rules"
  | "releases";
const section = ref<Section>("score_rules"),
  state = ref<"loading" | "ready" | "empty" | "error">("loading"),
  data = ref<any>(null),
  query = ref(""),
  status = ref(""),
  message = ref(""),
  requestId = ref("");
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
const current = computed(() =>
  sections.find((item) => item.value === section.value)!,
);
const rows = computed<any[]>(() => data.value?.[section.value] ?? []);
async function load() {
  state.value = "loading";
  message.value = "";
  const params = new URLSearchParams({ domain: "governance" });
  if (query.value.trim()) params.set("query", query.value.trim());
  if (status.value) params.set("status", status.value);
  try {
    const response = await fetch(
        `${props.apiBaseUrl}/platform/management?${params}`,
        {
          credentials: "include",
          headers: { accept: "application/json" },
        },
      ),
      body = await response.json().catch(() => null);
    requestId.value = body?.request_id ?? "";
    if (!response.ok)
      throw new Error(body?.error?.action_hint ?? "治理数据暂不可用");
    data.value = body.data;
    state.value = Object.values(body.data.summary).some(Number)
      ? "ready"
      : "empty";
  } catch (error) {
    message.value = error instanceof Error ? error.message : "治理数据暂不可用";
    state.value = "error";
  }
}
onMounted(load);
</script>

<template>
  <section class="platform-governance">
    <header>
      <div>
        <p>RULES & GOVERNANCE</p>
        <h2>规则、工作流与自动化</h2>
        <span
          >统一核对跨组织规则版本、审批、自动化和发布回滚；写操作进入对应受权限保护的工作台。</span
        >
      </div>
      <a :href="current.href">{{ current.action }}</a>
    </header>
    <form @submit.prevent="load">
      <input
        v-model="query"
        placeholder="搜索规则、版本、组织或工作区"
        maxlength="120"
      /><input
        v-model="status"
        placeholder="精确状态（可选）"
        maxlength="40"
      /><button>筛选</button>
    </form>
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
          <small>{{ key }}</small
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
        <table>
          <thead>
            <tr>
              <th>名称 / 版本</th>
              <th>组织 / 工作区</th>
              <th>类型</th>
              <th>状态</th>
              <th>版本</th>
              <th>更新时间</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in rows" :key="item.id">
              <td>
                <strong>{{ item.name }}</strong
                ><small>{{ item.version_code || item.id }}</small>
              </td>
              <td>
                {{ item.organization_name || "平台全局"
                }}<small>{{ item.workspace_name || item.stage || "—" }}</small>
              </td>
              <td>
                {{
                  item.trigger_event_type ||
                  item.resource_type ||
                  item.platform ||
                  section
                }}
              </td>
              <td>
                <b>{{ item.status }}</b>
              </td>
              <td>
                v{{
                  item.revision || item.version || item.current_version || "—"
                }}
              </td>
              <td>
                {{
                  item.updated_at
                    ? new Date(item.updated_at).toLocaleString("zh-CN")
                    : "—"
                }}
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="!rows.length">当前分类没有匹配记录。</p>
      </div>
      <aside>
        <strong>配置版本</strong
        ><span
          >Provider 历史版本 {{ data.summary.provider_versions }} 个；最近变更
          {{
            data.provider_versions_latest_at
              ? new Date(data.provider_versions_latest_at).toLocaleString(
                  "zh-CN",
                )
              : "暂无"
          }}。</span
        ><a href="/platform-admin/providers">进入来源版本管理</a>
      </aside>
      <footer>
        平台页用于跨组织核对；创建、审批、启停、灰度和回滚继续由原业务权限、版本锁与审计接口执行。request_id
        {{ requestId }}
      </footer>
    </template>
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
  color: #fff;
}
.platform-governance form,
.platform-governance nav {
  display: flex;
  gap: 8px;
}
.platform-governance input {
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
  color: #fff;
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
@media (max-width: 760px) {
  .platform-governance > header,
  .platform-governance form,
  .platform-governance aside {
    flex-direction: column;
  }
  .platform-governance form input,
  .platform-governance form button {
    width: 100%;
  }
  .governance-table table {
    min-width: 760px;
  }
}
</style>
