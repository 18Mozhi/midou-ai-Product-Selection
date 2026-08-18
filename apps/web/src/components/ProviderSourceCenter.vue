<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";

type ViewState = "loading" | "ready" | "empty" | "error" | "expired" | "forbidden" | "blocked";
interface ProvisionedSource {
  id: string;
  code: string;
  status: "draft" | "disabled" | "enabled";
  version: number;
  schedule_minutes: number;
  timeout_ms: number;
  retry_limit: number;
  updated_at: string;
}
interface SourceItem {
  code: string;
  name: string;
  access_mode: string;
  target_url: string;
  markets: string[];
  languages: string[];
  fields: string[];
  schedule_minutes: number;
  timeout_ms: number;
  retry_limit: number;
  category: "news" | "ecommerce" | "data" | "community" | "product_supply";
  availability: "automatic" | "setup_required" | "manual";
  policy_note: string;
  provisioned: ProvisionedSource | null;
}

const props = defineProps<{ apiBaseUrl: string }>();
const state = ref<ViewState>("loading");
const items = ref<SourceItem[]>([]);
const query = ref("");
const category = ref("");
const availability = ref("");
const message = ref("");
const requestId = ref("");
const editing = ref<SourceItem | null>(null);
const saving = ref(false);
const form = reactive({ schedule_minutes: 15, timeout_ms: 20000, retry_limit: 3, status: "enabled", reason: "调整来源采集配置" });

const filtered = computed(() => items.value.filter((item) => {
  const term = query.value.trim().toLowerCase();
  return (!term || `${item.name} ${item.code} ${item.markets.join(" ")} ${item.target_url}`.toLowerCase().includes(term))
    && (!category.value || item.category === category.value)
    && (!availability.value || item.availability === availability.value);
}));
const counts = computed(() => ({
  all: items.value.length,
  automatic: items.value.filter((item) => item.availability === "automatic").length,
  nonGoogle: items.value.filter((item) => item.availability === "automatic" && !item.target_url.includes("news.google.com")).length,
  markets: new Set(items.value.flatMap((item) => item.markets)).size,
}));
const failure = (status: number): ViewState => status === 401 ? "expired" : status === 403 ? "forbidden" : [408, 425, 429, 502, 503, 504].includes(status) ? "blocked" : "error";
const categoryText = (value: SourceItem["category"]) => ({ news: "新闻", ecommerce: "电商平台", data: "趋势数据", community: "论坛社区", product_supply: "商品供应链" }[value]);
const modeText = (value: string) => ({ public_rss: "公开 RSS/Atom 爬虫", public_page: "公开页面爬虫", authenticated_browser: "网页登录爬虫", import: "文件导入", manual: "人工录入" } as Record<string, string>)[value] ?? value;

async function load() {
  state.value = "loading";
  message.value = "";
  try {
    const response = await fetch(`${props.apiBaseUrl}/platform/provider-sources`, { credentials: "include" });
    const body = await response.json().catch(() => null);
    requestId.value = body?.request_id ?? "";
    if (!response.ok) {
      message.value = body?.error?.action_hint ?? "读取来源失败";
      state.value = failure(response.status);
      return;
    }
    items.value = body.data ?? [];
    state.value = items.value.length ? "ready" : "empty";
  } catch (error) {
    message.value = error instanceof Error ? error.message : "来源服务暂不可用";
    state.value = "blocked";
  }
}

function beginEdit(item: SourceItem) {
  if (!item.provisioned) return;
  editing.value = item;
  Object.assign(form, {
    schedule_minutes: item.provisioned.schedule_minutes,
    timeout_ms: item.provisioned.timeout_ms,
    retry_limit: item.provisioned.retry_limit,
    status: item.provisioned.status === "enabled" ? "enabled" : "disabled",
    reason: "调整来源采集配置",
  });
}

async function save() {
  if (!editing.value?.provisioned) return;
  saving.value = true;
  message.value = "";
  try {
    const source = editing.value.provisioned;
    const response = await fetch(`${props.apiBaseUrl}/platform/provider-sources/${source.id}/configuration`, {
      method: "PUT",
      credentials: "include",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({ ...form, expected_version: source.version }),
    });
    const body = await response.json().catch(() => null);
    requestId.value = body?.request_id ?? requestId.value;
    if (!response.ok) {
      message.value = body?.error?.action_hint ?? "来源配置未保存";
      return;
    }
    editing.value = null;
    await load();
    message.value = "来源配置已保存；频率、超时、重试和启停状态不会再被启动同步覆盖。";
  } catch {
    message.value = "来源配置服务暂不可用，本次没有保存。";
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section class="source-center novice">
    <header class="source-guide">
      <div><p>热点来源</p><h2>多平台、多国家来源已自动登记</h2><span>公开 RSS、论坛与电商内容直接由爬虫采集；需要登录的平台使用平台自有浏览器档案，不要求普通用户配置官方 API。</span></div>
      <a href="/platform-admin/providers">新建或编辑完整技术合同 →</a>
    </header>
    <div class="source-metrics">
      <article><small>全部来源</small><strong>{{ counts.all }}</strong><span>代码目录</span></article>
      <article><small>自动采集</small><strong>{{ counts.automatic }}</strong><span>已进入调度</span></article>
      <article><small>非 Google 自动源</small><strong>{{ counts.nonGoogle }}</strong><span>电商 / 论坛 / RSS</span></article>
      <article><small>市场覆盖</small><strong>{{ counts.markets }}</strong><span>国家与全球市场</span></article>
    </div>
    <aside class="source-help"><strong>已经替你配置好的部分</strong><ol><li>公开 RSS/Atom 和论坛频道会自动采集，不需要 Key。</li><li>频率、超时、重试、启停可直接在本页修改。</li><li>网页登录型平台只在登录失效时由管理员维护浏览器档案。</li></ol></aside>
    <form class="source-filter" @submit.prevent><input v-model="query" placeholder="搜索 Amazon、eBay、Reddit、国家或来源网址"><select v-model="category"><option value="">全部类型</option><option value="news">新闻</option><option value="ecommerce">电商平台</option><option value="data">趋势数据</option><option value="community">论坛社区</option><option value="product_supply">商品供应链</option></select><select v-model="availability"><option value="">全部状态</option><option value="automatic">自动采集</option><option value="setup_required">网页登录待就绪</option><option value="manual">手动来源</option></select></form>
    <p v-if="message" class="source-message" role="status">{{ message }} <code v-if="requestId">{{ requestId }}</code></p>
    <div v-if="state === 'loading'" class="source-state">正在读取来源目录…</div>
    <div v-else-if="state !== 'ready'" class="source-state" :data-kind="state"><strong>{{ state === 'empty' ? '还没有来源目录' : state === 'expired' ? '登录已过期' : state === 'forbidden' ? '当前账号不能管理平台来源' : '来源服务暂不可用' }}</strong><p>{{ message }}</p><button v-if="!['expired','forbidden'].includes(state)" @click="load">重新加载</button></div>
    <section v-else class="source-list">
      <article v-for="item in filtered" :key="item.code" :data-availability="item.availability">
        <header><div><small>{{ categoryText(item.category) }} · {{ item.markets.join(' / ') }}</small><h3>{{ item.name }}</h3></div><b>{{ item.provisioned?.status === 'enabled' ? '已启用' : item.availability === 'automatic' ? '等待同步' : '未启用' }}</b></header>
        <p>{{ item.policy_note }}</p>
        <dl><div><dt>采集方式</dt><dd>{{ modeText(item.access_mode) }}</dd></div><div><dt>频率</dt><dd>{{ item.provisioned?.schedule_minutes ?? item.schedule_minutes }} 分钟</dd></div><div><dt>超时 / 重试</dt><dd>{{ item.provisioned?.timeout_ms ?? item.timeout_ms }} ms / {{ item.provisioned?.retry_limit ?? item.retry_limit }} 次</dd></div></dl>
        <footer><code>{{ item.code }}</code><button v-if="item.provisioned" type="button" @click="beginEdit(item)">编辑采集配置</button><span v-else>统一后端重启后自动同步</span></footer>
      </article>
      <p v-if="!filtered.length" class="source-state">没有符合筛选条件的来源。</p>
    </section>
    <div v-if="editing" class="source-modal" role="dialog" aria-modal="true" aria-labelledby="source-edit-title"><form @submit.prevent="save"><header><div><p>EDIT SOURCE</p><h3 id="source-edit-title">{{ editing.name }}</h3></div><button type="button" aria-label="关闭来源编辑" @click="editing = null">×</button></header><label>采集频率（分钟）<input v-model.number="form.schedule_minutes" type="number" min="1" max="10080" required></label><label>单次超时（毫秒）<input v-model.number="form.timeout_ms" type="number" min="1000" max="120000" required></label><label>失败重试次数<input v-model.number="form.retry_limit" type="number" min="0" max="10" required></label><label>运行状态<select v-model="form.status"><option value="enabled">启用</option><option value="disabled">停用</option></select></label><label>变更原因<textarea v-model="form.reason" minlength="2" maxlength="500" required></textarea></label><footer><button type="button" @click="editing = null">取消</button><button :disabled="saving">{{ saving ? '保存中…' : '保存配置' }}</button></footer></form></div>
  </section>
</template>

<style scoped>
.novice{display:grid;gap:16px}.source-guide{display:flex;justify-content:space-between;align-items:center;padding:24px;border-radius:18px;background:linear-gradient(135deg,#092f37,#12515e);color:#fff}.source-guide p{color:#60e1c1;font-weight:800;margin:0}.source-guide h2{font-size:28px;margin:6px 0}.source-guide span{opacity:.8}.source-guide a{white-space:nowrap;color:#092f37;background:#60e1c1;padding:11px 16px;border-radius:10px;font-weight:800;text-decoration:none}.source-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.source-metrics article{padding:18px;border:1px solid var(--so-border);border-radius:14px;background:var(--so-panel);color:var(--so-text)}.source-metrics small,.source-metrics span{display:block;color:var(--so-text-muted)}.source-metrics strong{display:block;margin:5px 0;font-size:28px}.source-help{padding:16px 20px;border:1px solid color-mix(in srgb,var(--so-success) 35%,transparent);background:color-mix(in srgb,var(--so-success) 8%,var(--so-panel));border-radius:13px;color:var(--so-text)}.source-help ol{margin:8px 0 0;padding-left:20px;color:var(--so-text-muted)}.source-filter{display:flex;gap:10px}.source-filter input,.source-filter select,.source-modal input,.source-modal select,.source-modal textarea{padding:10px;border:1px solid var(--so-border);border-radius:9px;color:var(--so-text);background:var(--so-panel-soft)}.source-filter input{flex:1}.source-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.source-list article{padding:17px;border:1px solid var(--so-border);border-left:5px solid var(--so-success);border-radius:13px;background:var(--so-panel);color:var(--so-text)}.source-list article[data-availability=setup_required]{border-left-color:var(--so-warning)}.source-list article[data-availability=manual]{border-left-color:var(--so-info)}.source-list header,.source-list footer{display:flex;justify-content:space-between;gap:12px}.source-list h3{margin:4px 0}.source-list small,.source-list p,.source-list footer,.source-list dt{color:var(--so-text-muted)}.source-list b{white-space:nowrap;color:var(--so-success)}.source-list dl{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.source-list dl div{padding:9px;border-radius:8px;background:var(--so-panel-soft)}.source-list dt{font-size:11px}.source-list dd{margin:5px 0 0}.source-list footer{align-items:center}.source-list footer button{color:var(--so-text);border:1px solid var(--so-border);background:var(--so-panel-soft)}.source-message{padding:12px 14px;border:1px solid var(--so-border);border-radius:10px;background:var(--so-panel-soft)}.source-state{padding:30px;text-align:center}.source-modal{position:fixed;z-index:80;inset:0;padding:20px;display:grid;place-items:center;background:#020817cc}.source-modal form{width:min(520px,100%);display:grid;gap:14px;padding:24px;border:1px solid var(--so-border);border-radius:18px;background:var(--so-bg-elevated);box-shadow:var(--so-shadow)}.source-modal header,.source-modal footer{display:flex;align-items:center;justify-content:space-between;gap:12px}.source-modal h3,.source-modal p{margin:0}.source-modal label{display:grid;gap:6px}.source-modal header>button{font-size:22px;color:var(--so-text);background:transparent}.source-modal footer{justify-content:flex-end}.source-modal footer button:first-child{color:var(--so-text);background:var(--so-panel-soft)}@media(max-width:760px){.novice{padding-bottom:76px}.source-guide{align-items:flex-start;flex-direction:column;gap:16px}.source-metrics{grid-template-columns:1fr 1fr}.source-filter{flex-direction:column}.source-list{grid-template-columns:1fr}.source-list dl{grid-template-columns:1fr}}
</style>
