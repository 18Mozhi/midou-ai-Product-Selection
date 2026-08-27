<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

type TokenStatusFilter =
  "all" | "active" | "expiring" | "never_used" | "revoked" | "rotated" | "expired";

interface CreateTokenInput {
  name: string;
  scopes: string[];
  ttl_days: number;
  reason: string;
}

const props = defineProps<{
    tokens: any[];
    secret: string;
    busy: boolean;
    formatTime: (value: string) => string;
    createToken: (value: CreateTokenInput) => Promise<boolean>;
    performTokenAction: (item: any, action: "rotate" | "revoke") => Promise<boolean>;
    dismissSecret: () => void;
  }>(),
  route = useRoute(),
  router = useRouter(),
  tokenQuery = ref(queryText("org_token_query")),
  statusFilter = ref<TokenStatusFilter>(
    queryChoice(
      "org_token_status",
      ["all", "active", "expiring", "never_used", "revoked", "rotated", "expired"],
      "all",
    ) as TokenStatusFilter,
  ),
  scopeFilter = ref(
    queryChoice(
      "org_token_scope",
      ["all", "task:read", "trend:read", "opportunity:read", "report:read"],
      "all",
    ),
  ),
  tokenSort = ref(
    queryChoice(
      "org_token_sort",
      ["created_desc", "expires_asc", "last_used_desc", "name_asc", "status_asc"],
      "created_desc",
    ),
  ),
  tokenPage = ref(queryPage("org_token_page")),
  createForm = ref<CreateTokenInput>({ name: "", scopes: [], ttl_days: 90, reason: "" }),
  scopeError = ref(""),
  copyState = ref<"" | "copied" | "failed">("");

const pageSize = 6,
  scopeOptions = [
    {
      value: "task:read",
      label: "任务只读",
      description: "读取授权范围内的任务状态与基础信息。",
    },
    {
      value: "trend:read",
      label: "热点趋势只读",
      description: "读取授权范围内的热点主题与趋势事实。",
    },
    {
      value: "opportunity:read",
      label: "选品机会只读",
      description: "读取授权范围内的机会与评估事实。",
    },
    {
      value: "report:read",
      label: "报表只读",
      description: "读取授权范围内的报表元数据与结果。",
    },
  ],
  statusLabels: Record<string, string> = {
    active: "正常使用",
    revoked: "已撤销",
    rotated: "已轮换",
    expired: "已过期",
  };

const activeTokens = computed(() => props.tokens.filter((item) => item.status === "active")),
  expiringTokens = computed(() => activeTokens.value.filter((item) => isExpiring(item))),
  neverUsedTokens = computed(() => activeTokens.value.filter((item) => !item.last_used_at)),
  inactiveTokens = computed(() => props.tokens.filter((item) => item.status !== "active")),
  selectedScopeLabels = computed(() => createForm.value.scopes.map(scopeLabel)),
  expiryPreview = computed(() => {
    const ttl = Number(createForm.value.ttl_days);
    if (!Number.isInteger(ttl) || ttl < 1 || ttl > 365) return "有效期需为 1–365 天";
    return new Date(Date.now() + ttl * 86_400_000).toLocaleDateString("zh-CN");
  }),
  filteredTokens = computed(() => {
    const query = tokenQuery.value.trim().toLocaleLowerCase("zh-CN");
    return [...props.tokens]
      .filter((item) => {
        const scopes = Array.isArray(item.scopes) ? item.scopes : [];
        return (
          (!query ||
            [
              item.name,
              item.token_prefix,
              statusLabel(item.status),
              ...scopes.map(scopeLabel),
            ].some((value) =>
              String(value ?? "")
                .toLocaleLowerCase("zh-CN")
                .includes(query),
            )) &&
          matchesStatus(item) &&
          (scopeFilter.value === "all" || scopes.includes(scopeFilter.value))
        );
      })
      .sort((left, right) => {
        if (tokenSort.value === "expires_asc")
          return time(left.expires_at) - time(right.expires_at) || compareName(left, right);
        if (tokenSort.value === "last_used_desc")
          return time(right.last_used_at) - time(left.last_used_at) || compareName(left, right);
        if (tokenSort.value === "name_asc") return compareName(left, right);
        if (tokenSort.value === "status_asc")
          return (
            statusLabel(left.status).localeCompare(statusLabel(right.status), "zh-CN") ||
            compareName(left, right)
          );
        return time(right.created_at) - time(left.created_at) || compareName(left, right);
      });
  }),
  pageCount = computed(() => Math.max(1, Math.ceil(filteredTokens.value.length / pageSize))),
  visibleTokens = computed(() =>
    filteredTokens.value.slice((tokenPage.value - 1) * pageSize, tokenPage.value * pageSize),
  );

watch([tokenQuery, statusFilter, scopeFilter, tokenSort], () => (tokenPage.value = 1));
watch(pageCount, (count) => {
  if (tokenPage.value > count) tokenPage.value = count;
});
watch(
  [tokenQuery, statusFilter, scopeFilter, tokenSort, tokenPage],
  () => {
    const query = { ...route.query } as Record<string, string | string[] | null | undefined>;
    setQuery(query, "org_token_query", tokenQuery.value, "");
    setQuery(query, "org_token_status", statusFilter.value, "all");
    setQuery(query, "org_token_scope", scopeFilter.value, "all");
    setQuery(query, "org_token_sort", tokenSort.value, "created_desc");
    setQuery(query, "org_token_page", String(tokenPage.value), "1");
    void router.replace({ query });
  },
  { flush: "post" },
);
watch(
  () => props.secret,
  () => (copyState.value = ""),
);

function statusLabel(value: string) {
  return statusLabels[value] ?? `未知状态（${value || "空"}）`;
}
function scopeLabel(value: string) {
  return scopeOptions.find((item) => item.value === value)?.label ?? `未知 scope（${value}）`;
}
function time(value: unknown) {
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
}
function compareName(left: any, right: any) {
  return String(left.name ?? "").localeCompare(String(right.name ?? ""), "zh-CN");
}
function daysUntil(value: unknown) {
  const timestamp = time(value);
  return timestamp ? Math.ceil((timestamp - Date.now()) / 86_400_000) : null;
}
function isExpiring(item: any) {
  const days = daysUntil(item.expires_at);
  return item.status === "active" && days !== null && days >= 0 && days <= 7;
}
function expiryHint(item: any) {
  const days = daysUntil(item.expires_at);
  if (item.status !== "active" || days === null) return "";
  if (days <= 0) return "今天到期";
  if (days <= 7) return `${days} 天内到期`;
  return "";
}
function matchesStatus(item: any) {
  if (statusFilter.value === "all") return true;
  if (statusFilter.value === "expiring") return isExpiring(item);
  if (statusFilter.value === "never_used") return item.status === "active" && !item.last_used_at;
  return item.status === statusFilter.value;
}
function queryText(key: string) {
  const value = route.query[key];
  return typeof value === "string" ? value.slice(0, 200) : "";
}
function queryChoice(key: string, allowed: string[], fallback: string) {
  const value = queryText(key);
  return allowed.includes(value) ? value : fallback;
}
function queryPage(key: string) {
  const value = Number(queryText(key));
  return Number.isSafeInteger(value) && value > 0 ? value : 1;
}
function setQuery(
  query: Record<string, string | string[] | null | undefined>,
  key: string,
  value: string,
  fallback: string,
) {
  if (value && value !== fallback) query[key] = value;
  else delete query[key];
}
function toggleScope(scope: string) {
  const selected = createForm.value.scopes;
  createForm.value.scopes = selected.includes(scope)
    ? selected.filter((item) => item !== scope)
    : [...selected, scope];
  if (createForm.value.scopes.length) scopeError.value = "";
}
function resetFilters() {
  tokenQuery.value = "";
  statusFilter.value = "all";
  scopeFilter.value = "all";
  tokenSort.value = "created_desc";
}
async function submitCreate() {
  if (!createForm.value.scopes.length) {
    scopeError.value = "至少选择一个只读权限范围。";
    return;
  }
  scopeError.value = "";
  const succeeded = await props.createToken({
    name: createForm.value.name.trim(),
    scopes: [...createForm.value.scopes],
    ttl_days: Number(createForm.value.ttl_days),
    reason: createForm.value.reason.trim(),
  });
  if (succeeded) createForm.value = { name: "", scopes: [], ttl_days: 90, reason: "" };
}
async function copySecret() {
  try {
    await navigator.clipboard.writeText(props.secret);
    copyState.value = "copied";
  } catch {
    copyState.value = "failed";
  }
}
</script>

<template>
  <section class="org-token-panel" aria-labelledby="org-token-title">
    <header class="org-token-overview">
      <div>
        <p>ACCESS LEDGER · 当前组织</p>
        <h3 id="org-token-title">组织只读访问凭据</h3>
        <span>为受控系统创建最小只读权限，核对调用状态，并及时轮换或撤销不再使用的凭据。</span>
      </div>
      <aside aria-label="令牌安全边界">
        <b>安全边界</b>
        <strong>固定只读 scope</strong>
        <span>明文不进入数据库、审计、事件或日志</span>
      </aside>
    </header>

    <div class="org-token-metrics" aria-label="组织令牌汇总">
      <article>
        <span>全部令牌</span><b>{{ tokens.length }}</b
        ><small>当前组织生命周期记录</small>
      </article>
      <article data-tone="active">
        <span>正常使用</span><b>{{ activeTokens.length }}</b
        ><small>未撤销且尚未到期</small>
      </article>
      <article data-tone="warning">
        <span>7 天内到期</span><b>{{ expiringTokens.length }}</b
        ><small>应确认续用或轮换</small>
      </article>
      <article data-tone="idle">
        <span>从未调用</span><b>{{ neverUsedTokens.length }}</b
        ><small>仅统计活动令牌</small>
      </article>
      <article data-tone="inactive">
        <span>历史记录</span><b>{{ inactiveTokens.length }}</b
        ><small>撤销、轮换或过期</small>
      </article>
    </div>

    <aside class="org-token-truth" aria-label="组织令牌安全说明">
      <span aria-hidden="true">只读</span>
      <div>
        <b>令牌不是成员账号，也不能绕过组织权限</b>
        <p>当前能力只发放四种固定读取范围；页面不提供写入 scope、跨组织共享或明文找回。</p>
      </div>
    </aside>

    <section v-if="secret" class="org-token-secret" aria-labelledby="org-token-secret-title">
      <header>
        <div>
          <p>ONE-TIME SECRET</p>
          <h4 id="org-token-secret-title">仅本次响应可见的令牌明文</h4>
        </div>
        <span>离开本页即清除</span>
      </header>
      <code>{{ secret }}</code>
      <footer>
        <p role="status">
          {{
            copyState === "copied"
              ? "已复制到剪贴板，请立即保存到受限凭据位置。"
              : copyState === "failed"
                ? "浏览器拒绝复制，请手动选择并保存。"
                : "复制后请保存到受限凭据位置；系统无法再次找回。"
          }}
        </p>
        <div>
          <button type="button" class="org-admin-secondary" @click="copySecret">复制明文</button>
          <button type="button" @click="dismissSecret">我已安全保存</button>
        </div>
      </footer>
    </section>

    <div class="org-token-workbench">
      <form class="org-token-create" @submit.prevent="submitCreate">
        <header>
          <div>
            <p>CREATE · 最小权限</p>
            <h4>创建组织令牌</h4>
          </div>
          <span>明文只显示一次</span>
        </header>

        <label class="org-token-field">
          <span>令牌名称</span>
          <input
            v-model="createForm.name"
            required
            maxlength="120"
            autocomplete="off"
            placeholder="例如：月度经营报表"
          />
          <small>使用系统或用途命名，不要填写密钥、密码或个人隐私。</small>
        </label>

        <fieldset
          class="org-token-scope-field"
          :aria-describedby="scopeError ? 'token-scope-error' : undefined"
        >
          <legend>允许读取的内容</legend>
          <p>必须明确选择；未选择时不会静默添加默认权限。</p>
          <div>
            <label
              v-for="scope in scopeOptions"
              :key="scope.value"
              :data-selected="createForm.scopes.includes(scope.value)"
            >
              <input
                type="checkbox"
                :checked="createForm.scopes.includes(scope.value)"
                @change="toggleScope(scope.value)"
              />
              <span
                ><b>{{ scope.label }}</b
                ><small>{{ scope.description }}</small></span
              >
            </label>
          </div>
          <strong v-if="scopeError" id="token-scope-error" role="alert">{{ scopeError }}</strong>
        </fieldset>

        <div class="org-token-duration">
          <label class="org-token-field">
            <span>有效天数</span>
            <input v-model.number="createForm.ttl_days" type="number" min="1" max="365" required />
            <small>预计到期：{{ expiryPreview }}</small>
          </label>
          <div aria-label="常用有效期">
            <button
              v-for="days in [30, 90, 180, 365]"
              :key="days"
              type="button"
              class="org-admin-secondary"
              :aria-pressed="createForm.ttl_days === days"
              @click="createForm.ttl_days = days"
            >
              {{ days }} 天
            </button>
          </div>
        </div>

        <label class="org-token-field">
          <span>创建原因</span>
          <textarea
            v-model="createForm.reason"
            required
            maxlength="500"
            rows="3"
            placeholder="说明接入系统、负责人和业务用途"
          ></textarea>
          <small>{{ createForm.reason.length }} / 500；原因会写入组织审计。</small>
        </label>

        <aside class="org-token-preview" aria-label="令牌创建预览">
          <b>提交前核对</b>
          <dl>
            <div>
              <dt>数据边界</dt>
              <dd>仅当前组织</dd>
            </div>
            <div>
              <dt>权限范围</dt>
              <dd>{{ selectedScopeLabels.join("、") || "尚未选择" }}</dd>
            </div>
            <div>
              <dt>到期日期</dt>
              <dd>{{ expiryPreview }}</dd>
            </div>
            <div>
              <dt>生命周期</dt>
              <dd>可轮换、可撤销、不可找回明文</dd>
            </div>
          </dl>
        </aside>

        <button type="submit" :disabled="busy">
          {{ busy ? "正在创建并写入审计…" : "创建并显示一次明文" }}
        </button>
      </form>

      <section class="org-token-ledger" aria-labelledby="org-token-ledger-title">
        <header class="org-token-ledger-heading">
          <div>
            <p>LIFECYCLE · 真实记录</p>
            <h4 id="org-token-ledger-title">令牌生命周期</h4>
          </div>
          <span>共 {{ filteredTokens.length }} 条匹配记录</span>
        </header>

        <div class="org-token-toolbar">
          <label class="org-token-search">
            <span>搜索令牌</span>
            <input v-model="tokenQuery" type="search" placeholder="名称、前缀、scope 或状态" />
          </label>
          <label>
            <span>生命周期</span>
            <select v-model="statusFilter">
              <option value="all">全部状态</option>
              <option value="active">正常使用</option>
              <option value="expiring">7 天内到期</option>
              <option value="never_used">从未调用</option>
              <option value="revoked">已撤销</option>
              <option value="rotated">已轮换</option>
              <option value="expired">已过期</option>
            </select>
          </label>
          <label>
            <span>读取范围</span>
            <select v-model="scopeFilter">
              <option value="all">全部 scope</option>
              <option v-for="scope in scopeOptions" :key="scope.value" :value="scope.value">
                {{ scope.label }}
              </option>
            </select>
          </label>
          <label>
            <span>排序</span>
            <select v-model="tokenSort">
              <option value="created_desc">创建时间从新到旧</option>
              <option value="expires_asc">到期时间从近到远</option>
              <option value="last_used_desc">最近调用优先</option>
              <option value="name_asc">名称 A–Z</option>
              <option value="status_asc">状态排序</option>
            </select>
          </label>
          <button type="button" class="org-admin-secondary" @click="resetFilters">重置筛选</button>
        </div>

        <div v-if="visibleTokens.length" class="org-token-list" aria-label="组织令牌列表">
          <article v-for="item in visibleTokens" :key="item.id" :data-status="item.status">
            <header>
              <div>
                <span>{{ statusLabel(item.status) }}</span>
                <small v-if="expiryHint(item)">{{ expiryHint(item) }}</small>
                <h5>{{ item.name }}</h5>
              </div>
              <code>{{ item.token_prefix }}…</code>
            </header>
            <div class="org-token-scopes" aria-label="令牌读取范围">
              <span v-for="scope in item.scopes" :key="scope">{{ scopeLabel(scope) }}</span>
            </div>
            <dl>
              <div>
                <dt>到期时间</dt>
                <dd>{{ formatTime(item.expires_at) }}</dd>
              </div>
              <div>
                <dt>最近调用</dt>
                <dd>{{ item.last_used_at ? formatTime(item.last_used_at) : "从未调用" }}</dd>
              </div>
              <div>
                <dt>创建时间</dt>
                <dd>{{ formatTime(item.created_at) }}</dd>
              </div>
            </dl>
            <footer>
              <details>
                <summary>技术详情</summary>
                <code>令牌记录 ID：{{ item.id }}</code>
                <span>版本：{{ item.version }} · 更新于 {{ formatTime(item.updated_at) }}</span>
              </details>
              <div v-if="item.status === 'active'">
                <button
                  type="button"
                  class="org-admin-secondary"
                  :disabled="busy"
                  @click="performTokenAction(item, 'rotate')"
                >
                  轮换密钥
                </button>
                <button
                  type="button"
                  class="org-token-danger"
                  :disabled="busy"
                  @click="performTokenAction(item, 'revoke')"
                >
                  撤销访问
                </button>
              </div>
            </footer>
          </article>
        </div>

        <div v-else class="org-token-empty" role="status">
          <span>0</span>
          <div>
            <h5>{{ tokens.length ? "没有匹配的组织令牌" : "当前组织尚未创建令牌" }}</h5>
            <p>
              {{
                tokens.length
                  ? "调整搜索或重置筛选后再试。"
                  : "仅在有明确系统接入需求时创建最小只读令牌。"
              }}
            </p>
          </div>
        </div>

        <footer v-if="filteredTokens.length" class="org-token-pagination" aria-label="令牌分页">
          <span>第 {{ tokenPage }} / {{ pageCount }} 页 · 共 {{ filteredTokens.length }} 条</span>
          <div>
            <button
              type="button"
              class="org-admin-secondary"
              :disabled="tokenPage <= 1"
              @click="tokenPage -= 1"
            >
              上一页
            </button>
            <button
              type="button"
              class="org-admin-secondary"
              :disabled="tokenPage >= pageCount"
              @click="tokenPage += 1"
            >
              下一页
            </button>
          </div>
        </footer>
      </section>
    </div>
  </section>
</template>
