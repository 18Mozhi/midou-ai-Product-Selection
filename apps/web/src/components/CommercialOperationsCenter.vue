<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ApiClientError, createApiClient } from "../api-client";
import { useModalDialog } from "../use-modal-dialog";
import "../platform-polish.css";

const props = defineProps<{ apiBaseUrl: string }>();
const request = createApiClient(props.apiBaseUrl);
const state = ref("loading");
const data = ref<any>({
  plans: [],
  assignment: null,
  adjustments: [],
  usage: {},
  effective_quotas: {},
});
const organizationId = ref(new URLSearchParams(location.search).get("organization_id") ?? "");
const notice = ref("");
const requestId = ref("");
const pending = ref<any>(null);
const editingPlan = ref<any>(null);
const { dialogElement: planDialogElement, handleCancel: handlePlanCancel } = useModalDialog(
  () => Boolean(editingPlan.value),
  () => (editingPlan.value = null),
);
const plan = ref({
  code: "",
  name: "",
  description: "",
  collection_tasks: 100,
  open_api_requests: 1000,
  report_exports: 20,
  reason: "商业配置变更",
});
const assignment = ref({
  plan_id: "",
  period_start: "",
  period_end: "",
  reason: "分配或调整配额方案",
});
const adjustment = ref({
  quota_key: "collection_tasks",
  delta_value: 0,
  reason: "人工配额调整",
});
const quotaNames: Record<string, string> = {
  collection_tasks: "采集任务",
  open_api_requests: "外部接口请求",
  report_exports: "报表导出",
};

const localDate = (value?: string | null) =>
  value ? new Date(value).toISOString().slice(0, 16) : "";
const statusText = (value: string) =>
  (
    ({
      draft: "草稿",
      active: "启用",
      retired: "已退役",
      suspended: "已暂停",
      ended: "已结束",
      unassigned: "未分配",
      revoked: "已撤销",
    }) as Record<string, string>
  )[value] ?? value;
async function call(path: string, method = "GET", body?: any) {
  try {
    const response = await request<any>(path, { method, ...(body ? { body } : {}) });
    requestId.value = response.request_id;
    return response.data;
  } catch (error) {
    const failure = error instanceof ApiClientError ? error : null;
    requestId.value = failure?.requestId ?? "";
    throw error;
  }
}
async function load() {
  state.value = "loading";
  notice.value = "";
  try {
    data.value = await call(
      `/platform/commercial${organizationId.value ? `?organization_id=${encodeURIComponent(organizationId.value)}` : ""}`,
    );
    if (data.value.assignment) {
      assignment.value.plan_id = data.value.assignment.plan_id;
      assignment.value.period_start = localDate(data.value.assignment.period_start);
      assignment.value.period_end = localDate(data.value.assignment.period_end);
    } else {
      assignment.value.plan_id = "";
      assignment.value.period_start = "";
      assignment.value.period_end = "";
    }
    state.value = data.value.plans.length || data.value.assignment ? "ready" : "empty";
  } catch (error) {
    notice.value = error instanceof ApiClientError ? error.actionHint : "读取失败";
    const status = (error as any)?.status;
    state.value = status === 429 ? "rate_limited" : status >= 500 ? "blocked" : "error";
  }
}
async function createPlan() {
  try {
    await call("/platform/commercial/plans", "POST", {
      code: plan.value.code,
      name: plan.value.name,
      description: plan.value.description,
      quotas: {
        collection_tasks: Number(plan.value.collection_tasks),
        open_api_requests: Number(plan.value.open_api_requests),
        report_exports: Number(plan.value.report_exports),
      },
      reason: plan.value.reason,
    });
    notice.value = "配额方案草稿已创建；启用前不影响任何组织。";
    await load();
  } catch (error) {
    notice.value = error instanceof ApiClientError ? error.actionHint : "创建失败";
  }
}
function beginEditPlan(item: any) {
  editingPlan.value = {
    id: item.id,
    expected_version: item.version,
    name: item.name,
    description: item.description ?? "",
    status: item.status,
    collection_tasks: Number(item.quotas.collection_tasks ?? 0),
    open_api_requests: Number(item.quotas.open_api_requests ?? 0),
    report_exports: Number(item.quotas.report_exports ?? 0),
    reason: "编辑配额方案",
  };
}
function prepare(
  title: string,
  path: string,
  method: string,
  body: any,
  success = "变更已写入审计。",
) {
  pending.value = { title, path, method, body, success };
}
function savePlan() {
  const item = editingPlan.value;
  if (!item) return;
  prepare(
    "保存配额方案修改",
    `/platform/commercial/plans/${item.id}`,
    "PATCH",
    {
      name: item.name,
      description: item.description,
      quotas: {
        collection_tasks: Number(item.collection_tasks),
        open_api_requests: Number(item.open_api_requests),
        report_exports: Number(item.report_exports),
      },
      status: item.status,
      expected_version: item.expected_version,
      reason: item.reason,
    },
    "配额方案版本已更新。",
  );
  editingPlan.value = null;
}
function assignOrRenew() {
  prepare(
    data.value.assignment ? "调整组织配额方案" : "分配组织配额方案",
    "/platform/commercial/assignments",
    "POST",
    { organization_id: organizationId.value, ...assignment.value },
    data.value.assignment ? "组织配额方案已调整并保留审计事件。" : "组织配额方案已分配。",
  );
}
async function confirm() {
  if (!pending.value) return;
  const operation = pending.value;
  pending.value = null;
  try {
    await call(operation.path, operation.method, operation.body);
    await load();
    notice.value = operation.success;
  } catch (error) {
    notice.value = error instanceof ApiClientError ? error.actionHint : "变更未完成";
  }
}
onMounted(load);
</script>

<template>
  <section class="commercial">
    <header class="commercial-hero">
      <div>
        <p>配额管理</p>
        <h2>组织配额与用量</h2>
        <span
          >创建配额方案、设置使用额度、分配给组织并处理有效期、暂停和临时额度调整。当前不包含计费、价格或支付。</span
        >
      </div>
      <form @submit.prevent="load">
        <label>组织编号<input v-model="organizationId" placeholder="查看组织配额时填写" /></label
        ><button>读取</button>
      </form>
    </header>
    <p v-if="notice" class="notice">
      {{ notice }} <code v-if="requestId">关联编号：{{ requestId }}</code>
    </p>
    <aside v-if="pending" class="confirm">
      <strong>确认{{ pending.title }}？</strong>
      <p>该操作会改变配额方案版本、分配状态或组织额度，并写入平台审计。</p>
      <button @click="pending = null">取消</button><button @click="confirm">确认执行</button>
    </aside>
    <section v-if="state === 'loading'" class="state">正在读取真实配额方案与用量…</section>
    <section v-else-if="['error', 'rate_limited', 'blocked'].includes(state)" class="state">
      <strong>{{
        state === "rate_limited"
          ? "请求过于频繁"
          : state === "blocked"
            ? "配额管理依赖受阻"
            : "请求字段或组织范围无效"
      }}</strong
      ><button @click="load">重新读取</button>
    </section>
    <template v-else>
      <aside class="commercial-guide">
        <article>
          <strong>1. 创建配额方案</strong><span>先保存草稿，填写名称、说明和三项额度。</span>
        </article>
        <article>
          <strong>2. 启用配额方案</strong><span>确认内容后启用，才能分配给组织。</span>
        </article>
        <article>
          <strong>3. 分配与调整</strong><span>输入组织编号，选择配额方案和有效期即可完成。</span>
        </article>
      </aside>
      <section class="create">
        <h3>创建配额方案草稿</h3>
        <label
          >内部标识<input
            v-model="plan.code"
            placeholder="例如 basic_2026"
            required
            pattern="[a-z0-9][a-z0-9_-]{0,79}" /></label
        ><label>方案名称<input v-model="plan.name" required maxlength="120" /></label
        ><label class="wide"
          >方案说明<textarea
            v-model="plan.description"
            maxlength="500"
            placeholder="适用对象、包含内容和使用限制"
          ></textarea></label
        ><label
          >采集任务<input v-model.number="plan.collection_tasks" type="number" min="0" /></label
        ><label
          >外部接口请求<input
            v-model.number="plan.open_api_requests"
            type="number"
            min="0" /></label
        ><label>报表导出<input v-model.number="plan.report_exports" type="number" min="0" /></label
        ><label class="wide">创建原因<input v-model="plan.reason" required maxlength="500" /></label
        ><button @click="createPlan">创建草稿</button>
      </section>
      <p v-if="state === 'empty'" class="state">
        暂无配额方案。系统不会自动编造默认额度，也不会展示价格或计费结论。
      </p>
      <section class="plans">
        <article v-for="item in data.plans" :key="item.id" :data-status="item.status">
          <header>
            <span>{{ statusText(item.status) }}</span>
            <h3>{{ item.name }}</h3>
            <small>内部标识：{{ item.code }} · 第 {{ item.version }} 版</small>
          </header>
          <p>{{ item.description || "未填写说明" }}</p>
          <dl>
            <div v-for="(amount, key) in item.quotas" :key="key">
              <dt>{{ quotaNames[String(key)] || key }}</dt>
              <dd>{{ amount }}</dd>
            </div>
          </dl>
          <small
            >最近更新：{{
              item.updated_at ? new Date(item.updated_at).toLocaleString("zh-CN") : "暂无时间"
            }}</small
          >
          <footer>
            <button @click="beginEditPlan(item)">编辑</button
            ><button
              v-if="item.status === 'draft'"
              @click="
                prepare('启用配额方案', `/platform/commercial/plans/${item.id}`, 'PATCH', {
                  name: item.name,
                  description: item.description,
                  quotas: item.quotas,
                  status: 'active',
                  expected_version: item.version,
                  reason: plan.reason,
                })
              "
            >
              启用</button
            ><button
              v-else-if="item.status === 'active'"
              @click="
                prepare('退役配额方案', `/platform/commercial/plans/${item.id}`, 'PATCH', {
                  name: item.name,
                  description: item.description,
                  quotas: item.quotas,
                  status: 'retired',
                  expected_version: item.version,
                  reason: plan.reason,
                })
              "
            >
              退役
            </button>
          </footer>
        </article>
      </section>
      <section v-if="organizationId" class="membership">
        <header>
          <div>
            <h3>组织配额与本周期用量</h3>
            <small>{{ organizationId }}</small>
          </div>
          <b :data-status="data.assignment?.status || 'unassigned'">{{
            statusText(data.assignment?.status || "unassigned")
          }}</b>
        </header>
        <div v-if="data.assignment" class="assignment">
          <div>
            <strong>{{ data.assignment.plan_name }}</strong
            ><small>{{ data.assignment.period_start }} — {{ data.assignment.period_end }}</small>
          </div>
          <nav>
            <button
              v-if="data.assignment.status === 'active'"
              @click="
                prepare(
                  '暂停组织配额',
                  `/platform/commercial/assignments/${data.assignment.id}/actions`,
                  'POST',
                  {
                    action: 'suspend',
                    expected_version: data.assignment.version,
                    reason: assignment.reason,
                  },
                )
              "
            >
              暂停</button
            ><button
              v-if="data.assignment.status === 'suspended'"
              @click="
                prepare(
                  '恢复组织配额',
                  `/platform/commercial/assignments/${data.assignment.id}/actions`,
                  'POST',
                  {
                    action: 'resume',
                    expected_version: data.assignment.version,
                    reason: assignment.reason,
                  },
                )
              "
            >
              恢复</button
            ><button
              v-if="data.assignment.status !== 'ended'"
              @click="
                prepare(
                  '结束组织配额',
                  `/platform/commercial/assignments/${data.assignment.id}/actions`,
                  'POST',
                  {
                    action: 'end',
                    expected_version: data.assignment.version,
                    reason: assignment.reason,
                  },
                )
              "
            >
              结束
            </button>
          </nav>
        </div>
        <form class="renew" @submit.prevent="assignOrRenew">
          <h4>{{ data.assignment ? "调整配额方案" : "首次分配配额方案" }}</h4>
          <label
            >配额方案<select v-model="assignment.plan_id" required>
              <option value="">选择已启用配额方案</option>
              <option
                v-for="item in data.plans.filter((x: any) => x.status === 'active')"
                :key="item.id"
                :value="item.id"
              >
                {{ item.name }}
              </option>
            </select></label
          ><label
            >开始<input v-model="assignment.period_start" type="datetime-local" required /></label
          ><label
            >结束<input v-model="assignment.period_end" type="datetime-local" required /></label
          ><label>原因<input v-model="assignment.reason" required minlength="2" /></label
          ><button>{{ data.assignment ? "确认调整" : "确认分配" }}</button>
        </form>
        <template v-if="data.assignment"
          ><div class="usage">
            <article v-for="(limit, key) in data.effective_quotas" :key="key">
              <span>{{ quotaNames[String(key)] || key }}</span
              ><strong>{{ data.usage[key] || 0 }} / {{ limit }}</strong
              ><b
                ><i
                  :style="{
                    width: `${Math.min(100, Number(limit) ? ((data.usage[key] || 0) / Number(limit)) * 100 : 100)}%`,
                  }"
                ></i
              ></b>
            </article>
          </div>
          <form
            class="adjust"
            @submit.prevent="
              prepare('人工调整配额', '/platform/commercial/adjustments', 'POST', {
                organization_id: organizationId,
                assignment_id: data.assignment.id,
                ...adjustment,
              })
            "
          >
            <label
              >计量项<select v-model="adjustment.quota_key">
                <option v-for="(_, key) in data.effective_quotas" :key="key" :value="key">
                  {{ quotaNames[String(key)] || key }}
                </option>
              </select></label
            ><label
              >调整量<input v-model.number="adjustment.delta_value" type="number" required /></label
            ><label>原因<input v-model="adjustment.reason" required /></label
            ><button>提交调整</button>
          </form>
          <ul>
            <li v-for="item in data.adjustments" :key="item.id">
              <span
                >{{ quotaNames[item.quota_key] }} {{ item.delta_value > 0 ? "+" : ""
                }}{{ item.delta_value }}</span
              ><small>{{ item.reason }} · {{ statusText(item.status) }}</small
              ><button
                v-if="item.status === 'active'"
                @click="
                  prepare(
                    '撤销人工调整',
                    `/platform/commercial/adjustments/${item.id}/revoke`,
                    'POST',
                    { expected_version: item.version, reason: '撤销人工调整' },
                  )
                "
              >
                撤销
              </button>
            </li>
          </ul></template
        >
      </section>
    </template>
    <Teleport to="body"
      ><dialog ref="planDialogElement" aria-label="编辑配额方案" @cancel="handlePlanCancel">
        <form v-if="editingPlan" @submit.prevent="savePlan">
          <h3>编辑配额方案</h3>
          <label>名称<input v-model="editingPlan.name" required maxlength="120" /></label
          ><label>说明<textarea v-model="editingPlan.description" maxlength="500"></textarea></label
          ><label
            >采集任务<input
              v-model.number="editingPlan.collection_tasks"
              type="number"
              min="0"
              required /></label
          ><label
            >外部接口请求<input
              v-model.number="editingPlan.open_api_requests"
              type="number"
              min="0"
              required /></label
          ><label
            >报表导出<input
              v-model.number="editingPlan.report_exports"
              type="number"
              min="0"
              required /></label
          ><label
            >状态<select v-model="editingPlan.status">
              <option value="draft">草稿</option>
              <option value="active">启用</option>
              <option value="retired">退役</option>
            </select></label
          ><label
            >原因<input v-model="editingPlan.reason" required minlength="2" maxlength="500"
          /></label>
          <footer>
            <button type="button" @click="editingPlan = null">取消</button
            ><button>保存新版本</button>
          </footer>
        </form>
      </dialog></Teleport
    >
  </section>
</template>

<style scoped>
.commercial {
  display: grid;
  gap: 18px;
  color: var(--so-text);
}
.commercial-hero {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  padding: 24px;
  border: 1px solid var(--so-border);
  border-radius: 17px;
  background: linear-gradient(135deg, var(--so-panel-soft), var(--so-bg-elevated));
}
.commercial-hero p {
  margin: 0;
  color: var(--so-primary);
  font: 700 11px monospace;
}
.commercial-hero h2 {
  margin: 6px 0;
}
.commercial-hero span,
small {
  color: var(--so-text-muted);
}
.commercial form {
  display: grid;
  gap: 10px;
}
.commercial label {
  display: grid;
  gap: 5px;
  font-size: 12px;
}
.commercial button,
.commercial input,
.commercial select,
.commercial textarea {
  box-sizing: border-box;
  border: 1px solid var(--so-border-strong);
  border-radius: 9px;
  background: var(--so-panel);
  color: var(--so-text);
  padding: 9px 12px;
}
.commercial button {
  cursor: pointer;
  font-weight: 700;
}
.notice,
.confirm,
.state,
.create,
.membership,
.plans article {
  padding: 16px;
  border: 1px solid var(--so-border);
  border-radius: 13px;
  background: var(--so-panel);
}
.confirm {
  border-color: var(--so-border-strong);
}
.create {
  display: grid;
  grid-template-columns: repeat(6, minmax(100px, 1fr));
  gap: 10px;
  align-items: end;
}
.create h3 {
  grid-column: 1/-1;
  margin: 0;
}
.plans {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.plans article header span,
.membership > b {
  color: var(--so-primary);
}
.plans article dl {
  display: grid;
  gap: 6px;
}
.plans article dl div {
  display: flex;
  justify-content: space-between;
}
.plans footer,
.assignment nav,
dialog footer {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.membership {
  display: grid;
  gap: 16px;
}
.membership > header,
.assignment {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
}
.assignment div {
  display: grid;
  gap: 5px;
}
.renew {
  grid-template-columns: repeat(5, minmax(0, 1fr));
  align-items: end;
}
.renew h4 {
  grid-column: 1/-1;
  margin: 0;
}
.usage {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.usage article {
  display: grid;
  gap: 8px;
  padding: 12px;
  background: var(--so-panel);
  border-radius: 10px;
}
.usage article > b {
  height: 6px;
  background: var(--so-panel-muted);
  border-radius: 5px;
  overflow: hidden;
}
.usage i {
  display: block;
  height: 100%;
  background: var(--so-primary);
}
.adjust {
  grid-template-columns: repeat(4, 1fr);
  align-items: end;
}
.membership ul {
  list-style: none;
  padding: 0;
  display: grid;
  gap: 8px;
}
.membership li {
  display: grid;
  grid-template-columns: 1fr 2fr auto;
  gap: 10px;
  align-items: center;
  padding: 10px;
  border-bottom: 1px solid var(--so-border);
}
dialog {
  position: fixed;
  inset: 0;
  margin: auto;
  width: min(480px, calc(100% - 28px));
  border: 1px solid var(--so-border-strong);
  border-radius: 14px;
  background: var(--so-bg-elevated);
  color: var(--so-text);
  z-index: 20;
}
dialog form {
  padding: 10px;
}
dialog textarea {
  min-height: 80px;
}
@media (max-width: 800px) {
  .commercial {
    padding-bottom: 78px;
  }
  .commercial-hero {
    display: grid;
  }
  .create,
  .renew,
  .adjust {
    grid-template-columns: 1fr 1fr;
  }
  .plans {
    grid-template-columns: 1fr;
  }
  .usage {
    grid-template-columns: 1fr;
  }
  .membership > header,
  .assignment {
    align-items: flex-start;
    display: grid;
  }
  .membership li {
    grid-template-columns: 1fr;
  }
  .create h3,
  .renew h4 {
    grid-column: 1/-1;
  }
}
@media (max-width: 480px) {
  .create,
  .renew,
  .adjust {
    grid-template-columns: 1fr;
  }
}
dialog {
  inset: 50% auto auto 50%;
  transform: translate(-50%, -50%);
  margin: 0;
  max-height: calc(100vh - 28px);
  overflow: auto;
  z-index: 100;
}
</style>
