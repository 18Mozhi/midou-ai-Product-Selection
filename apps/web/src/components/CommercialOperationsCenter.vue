<script setup lang="ts">
import { onMounted, ref } from "vue";

const props = defineProps<{ apiBaseUrl: string }>();
const state = ref("loading");
const data = ref<any>({ plans: [], assignment: null, adjustments: [], usage: {}, effective_quotas: {} });
const organizationId = ref(new URLSearchParams(location.search).get("organization_id") ?? "");
const notice = ref("");
const requestId = ref("");
const pending = ref<any>(null);
const editingPlan = ref<any>(null);
const plan = ref({ code: "", name: "", description: "", collection_tasks: 100, open_api_requests: 1000, report_exports: 20, reason: "商业配置变更" });
const assignment = ref({ plan_id: "", period_start: "", period_end: "", reason: "续期或分配套餐" });
const adjustment = ref({ quota_key: "collection_tasks", delta_value: 0, reason: "人工配额调整" });
const quotaNames: Record<string, string> = { collection_tasks: "采集任务", open_api_requests: "开放 API 请求", report_exports: "报表导出" };

const localDate = (value?: string | null) => value ? new Date(value).toISOString().slice(0, 16) : "";
async function call(path: string, method = "GET", body?: any) {
  const response = await fetch(`${props.apiBaseUrl}${path}`, {
    method,
    credentials: "include",
    headers: { accept: "application/json", "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    requestId.value = result?.request_id ?? "";
    throw Object.assign(new Error(result?.error?.action_hint ?? result?.error?.message ?? "请求未完成"), { status: response.status });
  }
  return result.data;
}
async function load() {
  state.value = "loading";
  notice.value = "";
  try {
    data.value = await call(`/platform/commercial${organizationId.value ? `?organization_id=${encodeURIComponent(organizationId.value)}` : ""}`);
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
    notice.value = error instanceof Error ? error.message : "读取失败";
    const status = (error as any)?.status;
    state.value = status === 429 ? "rate_limited" : status >= 500 ? "blocked" : "error";
  }
}
async function createPlan() {
  try {
    await call("/platform/commercial/plans", "POST", { code: plan.value.code, name: plan.value.name, description: plan.value.description, quotas: { collection_tasks: Number(plan.value.collection_tasks), open_api_requests: Number(plan.value.open_api_requests), report_exports: Number(plan.value.report_exports) }, reason: plan.value.reason });
    notice.value = "套餐草稿已创建；启用前不影响任何组织。";
    await load();
  } catch (error) { notice.value = error instanceof Error ? error.message : "创建失败"; }
}
function beginEditPlan(item: any) {
  editingPlan.value = { id: item.id, expected_version: item.version, name: item.name, description: item.description ?? "", status: item.status, collection_tasks: Number(item.quotas.collection_tasks ?? 0), open_api_requests: Number(item.quotas.open_api_requests ?? 0), report_exports: Number(item.quotas.report_exports ?? 0), reason: "编辑套餐配置" };
}
function prepare(title: string, path: string, method: string, body: any, success = "变更已写入审计。") { pending.value = { title, path, method, body, success }; }
function savePlan() {
  const item = editingPlan.value;
  if (!item) return;
  prepare("保存套餐修改", `/platform/commercial/plans/${item.id}`, "PATCH", { name: item.name, description: item.description, quotas: { collection_tasks: Number(item.collection_tasks), open_api_requests: Number(item.open_api_requests), report_exports: Number(item.report_exports) }, status: item.status, expected_version: item.expected_version, reason: item.reason }, "套餐版本已更新。");
  editingPlan.value = null;
}
function assignOrRenew() {
  prepare(data.value.assignment ? "续期或变更组织套餐" : "分配组织套餐", "/platform/commercial/assignments", "POST", { organization_id: organizationId.value, ...assignment.value }, data.value.assignment ? "组织套餐已续期并保留审计事件。" : "组织套餐已分配。");
}
async function confirm() {
  if (!pending.value) return;
  const operation = pending.value;
  pending.value = null;
  try { await call(operation.path, operation.method, operation.body); await load(); notice.value = operation.success; }
  catch (error) { notice.value = error instanceof Error ? error.message : "变更未完成"; }
}
onMounted(load);
</script>

<template>
  <section class="commercial">
    <header class="commercial-hero"><div><p>COMMERCIAL OPERATIONS</p><h2>会员、套餐、续期与用量</h2><span>管理版本化套餐和组织有效期；不虚构价格、支付、发票或税务规则。</span></div><form @submit.prevent="load"><label>组织 UUID<input v-model="organizationId" placeholder="查看会员与续期时填写" /></label><button>读取</button></form></header>
    <p v-if="notice" class="notice">{{ notice }} <code v-if="requestId">request_id: {{ requestId }}</code></p>
    <aside v-if="pending" class="confirm"><strong>确认{{ pending.title }}？</strong><p>该操作会改变套餐版本、会员状态或组织配额，并写入平台审计。</p><button @click="pending = null">取消</button><button @click="confirm">确认执行</button></aside>
    <section v-if="state === 'loading'" class="state">正在读取真实会员、套餐与用量…</section>
    <section v-else-if="['error','rate_limited','blocked'].includes(state)" class="state"><strong>{{ state === 'rate_limited' ? '请求过于频繁' : state === 'blocked' ? '商业运营依赖受阻' : '请求字段或组织范围无效' }}</strong><button @click="load">重新读取</button></section>
    <template v-else>
      <section class="create"><h3>创建套餐草稿</h3><label>代码<input v-model="plan.code" /></label><label>名称<input v-model="plan.name" /></label><label>采集任务<input v-model.number="plan.collection_tasks" type="number" min="0" /></label><label>开放 API<input v-model.number="plan.open_api_requests" type="number" min="0" /></label><label>报表导出<input v-model.number="plan.report_exports" type="number" min="0" /></label><button @click="createPlan">创建草稿</button></section>
      <p v-if="state === 'empty'" class="state">暂无套餐定义。系统不会自动编造默认价格或配额。</p>
      <section class="plans"><article v-for="item in data.plans" :key="item.id" :data-status="item.status"><header><span>{{ item.status }}</span><h3>{{ item.name }}</h3><code>{{ item.code }} · v{{ item.version }}</code></header><p>{{ item.description || '未填写说明' }}</p><dl><div v-for="(amount,key) in item.quotas" :key="key"><dt>{{ quotaNames[String(key)] || key }}</dt><dd>{{ amount }}</dd></div></dl><footer><button @click="beginEditPlan(item)">编辑</button><button v-if="item.status === 'draft'" @click="prepare('启用套餐',`/platform/commercial/plans/${item.id}`,'PATCH',{name:item.name,description:item.description,quotas:item.quotas,status:'active',expected_version:item.version,reason:plan.reason})">启用</button><button v-else-if="item.status === 'active'" @click="prepare('退役套餐',`/platform/commercial/plans/${item.id}`,'PATCH',{name:item.name,description:item.description,quotas:item.quotas,status:'retired',expected_version:item.version,reason:plan.reason})">退役</button></footer></article></section>
      <section v-if="organizationId" class="membership"><header><div><h3>组织会员与本账期用量</h3><small>{{ organizationId }}</small></div><b :data-status="data.assignment?.status || 'unassigned'">{{ data.assignment?.status || '未分配' }}</b></header>
        <div v-if="data.assignment" class="assignment"><div><strong>{{ data.assignment.plan_name }}</strong><small>{{ data.assignment.period_start }} — {{ data.assignment.period_end }}</small></div><nav><button v-if="data.assignment.status === 'active'" @click="prepare('暂停组织会员',`/platform/commercial/assignments/${data.assignment.id}/actions`,'POST',{action:'suspend',expected_version:data.assignment.version,reason:assignment.reason})">暂停</button><button v-if="data.assignment.status === 'suspended'" @click="prepare('恢复组织会员',`/platform/commercial/assignments/${data.assignment.id}/actions`,'POST',{action:'resume',expected_version:data.assignment.version,reason:assignment.reason})">恢复</button><button v-if="data.assignment.status !== 'ended'" @click="prepare('结束组织会员',`/platform/commercial/assignments/${data.assignment.id}/actions`,'POST',{action:'end',expected_version:data.assignment.version,reason:assignment.reason})">结束</button></nav></div>
        <form class="renew" @submit.prevent="assignOrRenew"><h4>{{ data.assignment ? '续期或变更套餐' : '首次分配套餐' }}</h4><label>套餐<select v-model="assignment.plan_id" required><option value="">选择已启用套餐</option><option v-for="item in data.plans.filter((x:any)=>x.status==='active')" :key="item.id" :value="item.id">{{ item.name }}</option></select></label><label>开始<input v-model="assignment.period_start" type="datetime-local" required /></label><label>结束<input v-model="assignment.period_end" type="datetime-local" required /></label><label>原因<input v-model="assignment.reason" required minlength="2" /></label><button>{{ data.assignment ? '确认续期/变更' : '确认分配' }}</button></form>
        <template v-if="data.assignment"><div class="usage"><article v-for="(limit,key) in data.effective_quotas" :key="key"><span>{{ quotaNames[String(key)] || key }}</span><strong>{{ data.usage[key] || 0 }} / {{ limit }}</strong><b><i :style="{width:`${Math.min(100,Number(limit)?((data.usage[key]||0)/Number(limit))*100:100)}%`}"></i></b></article></div><form class="adjust" @submit.prevent="prepare('人工调整配额','/platform/commercial/adjustments','POST',{organization_id:organizationId,assignment_id:data.assignment.id,...adjustment})"><label>计量项<select v-model="adjustment.quota_key"><option v-for="(_,key) in data.effective_quotas" :key="key" :value="key">{{ quotaNames[String(key)] || key }}</option></select></label><label>调整量<input v-model.number="adjustment.delta_value" type="number" required /></label><label>原因<input v-model="adjustment.reason" required /></label><button>提交调整</button></form><ul><li v-for="item in data.adjustments" :key="item.id"><span>{{ quotaNames[item.quota_key] }} {{ item.delta_value > 0 ? '+' : '' }}{{ item.delta_value }}</span><small>{{ item.reason }} · {{ item.status }}</small><button v-if="item.status === 'active'" @click="prepare('撤销人工调整',`/platform/commercial/adjustments/${item.id}/revoke`,'POST',{expected_version:item.version,reason:'撤销人工调整'})">撤销</button></li></ul></template>
      </section>
    </template>
    <Teleport to="body"><dialog :open="Boolean(editingPlan)"><form v-if="editingPlan" @submit.prevent="savePlan"><h3>编辑套餐</h3><label>名称<input v-model="editingPlan.name" required maxlength="120" /></label><label>说明<textarea v-model="editingPlan.description" maxlength="500"></textarea></label><label>采集任务<input v-model.number="editingPlan.collection_tasks" type="number" min="0" required /></label><label>开放 API<input v-model.number="editingPlan.open_api_requests" type="number" min="0" required /></label><label>报表导出<input v-model.number="editingPlan.report_exports" type="number" min="0" required /></label><label>状态<select v-model="editingPlan.status"><option value="draft">草稿</option><option value="active">启用</option><option value="retired">退役</option></select></label><label>原因<input v-model="editingPlan.reason" required minlength="2" maxlength="500" /></label><footer><button type="button" @click="editingPlan = null">取消</button><button>保存新版本</button></footer></form></dialog></Teleport>
  </section>
</template>

<style scoped>
.commercial{display:grid;gap:18px;color:#dce8f3}.commercial-hero{display:flex;justify-content:space-between;gap:20px;padding:24px;border:1px solid #28475b;border-radius:17px;background:linear-gradient(135deg,#0a1824,#123246)}.commercial-hero p{margin:0;color:#31d6c4;font:700 11px monospace}.commercial-hero h2{margin:6px 0}.commercial-hero span,small{color:#91a8b9}.commercial form{display:grid;gap:10px}.commercial label{display:grid;gap:5px;font-size:12px}.commercial button,.commercial input,.commercial select,.commercial textarea{box-sizing:border-box;border:1px solid #31536a;border-radius:9px;background:#0b1d29;color:#dce8f3;padding:9px 12px}.commercial button{cursor:pointer;font-weight:700}.notice,.confirm,.state,.create,.membership,.plans article{padding:16px;border:1px solid #28475b;border-radius:13px;background:#0e2234}.confirm{border-color:#9c7533}.create{display:grid;grid-template-columns:repeat(6,minmax(100px,1fr));gap:10px;align-items:end}.create h3{grid-column:1/-1;margin:0}.plans{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.plans article header span,.membership>b{color:#42d8ba}.plans article dl{display:grid;gap:6px}.plans article dl div{display:flex;justify-content:space-between}.plans footer,.assignment nav,dialog footer{display:flex;gap:8px;flex-wrap:wrap}.membership{display:grid;gap:16px}.membership>header,.assignment{display:flex;justify-content:space-between;gap:16px;align-items:center}.assignment div{display:grid;gap:5px}.renew{grid-template-columns:repeat(5,minmax(0,1fr));align-items:end}.renew h4{grid-column:1/-1;margin:0}.usage{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.usage article{display:grid;gap:8px;padding:12px;background:#091a28;border-radius:10px}.usage article>b{height:6px;background:#243b50;border-radius:5px;overflow:hidden}.usage i{display:block;height:100%;background:#31d6c4}.adjust{grid-template-columns:repeat(4,1fr);align-items:end}.membership ul{list-style:none;padding:0;display:grid;gap:8px}.membership li{display:grid;grid-template-columns:1fr 2fr auto;gap:10px;align-items:center;padding:10px;border-bottom:1px solid #28475b}dialog{position:fixed;inset:0;margin:auto;width:min(480px,calc(100% - 28px));border:1px solid #31536a;border-radius:14px;background:#0e2234;color:#dce8f3;z-index:20}dialog form{padding:10px}dialog textarea{min-height:80px}@media(max-width:800px){.commercial{padding-bottom:78px}.commercial-hero{display:grid}.create,.renew,.adjust{grid-template-columns:1fr 1fr}.plans{grid-template-columns:1fr}.usage{grid-template-columns:1fr}.membership>header,.assignment{align-items:flex-start;display:grid}.membership li{grid-template-columns:1fr}.create h3,.renew h4{grid-column:1/-1}}@media(max-width:480px){.create,.renew,.adjust{grid-template-columns:1fr}}
dialog{inset:50% auto auto 50%;transform:translate(-50%,-50%);margin:0;max-height:calc(100vh - 28px);overflow:auto;z-index:100}
</style>
