<script setup lang="ts">
import { onMounted, ref } from "vue";
const props = defineProps<{ apiBaseUrl: string }>();
const state = ref("loading"),
  data = ref<any>(null),
  org = ref(""),
  workspace = ref(""),
  requestId = ref(""),
  hint = ref("");
async function load() {
  state.value = "loading";
  const q = new URLSearchParams();
  if (org.value) q.set("organization_id", org.value);
  if (workspace.value) q.set("workspace_id", workspace.value);
  try {
    const r = await fetch(
        `${props.apiBaseUrl}/platform/collection/console?${q}`,
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
    state.value =
      b.data.sources.length +
      b.data.task_states.length +
      b.data.dead_letters.length +
      b.data.quality.length
        ? "ready"
        : "empty";
  } catch {
    state.value = "blocked";
  }
}
onMounted(load);
const when = (v: string | null) =>
  v ? new Date(v).toLocaleString() : "未检查";
</script>
<template>
  <section class="collection-ops">
    <header>
      <div>
        <p>采集运行管理</p>
        <h2>来源与采集控制台</h2>
        <span
          >来源配置、健康、任务尝试、死信和质量问题使用同一事实视图；敏感操作仍进入对应受控页面。</span
        >
      </div>
      <form @submit.prevent="load">
        <input
          v-model="org"
          aria-label="组织 ID 筛选"
          placeholder="组织 ID（可选）"
        /><input
          v-model="workspace"
          aria-label="工作区 ID 筛选"
          placeholder="工作区 ID（可选）"
        /><button>应用范围</button>
      </form>
    </header>
    <section
      v-if="state !== 'ready'"
      class="platform-dashboard-state"
      :data-kind="state"
    >
      <h3>
        {{
          state === "loading"
            ? "正在读取采集运行事实"
            : state === "empty"
              ? "当前范围没有采集事实"
              : state === "expired"
                ? "登录已失效"
                : state === "forbidden"
                  ? "你没有此项权限"
                  : state === "rate_limited"
                    ? "请求过于频繁"
                    : "采集控制台依赖受阻"
        }}
      </h3>
      <p>{{ hint || "刷新或检查宝塔 Node API 与 MySQL 后重试。" }}</p>
      <code v-if="requestId">request_id: {{ requestId }}</code
      ><button
        v-if="!['loading', 'expired', 'forbidden'].includes(state)"
        @click="load"
      >
        重新读取
      </button>
    </section>
    <template v-else-if="data"
      ><nav class="collection-ops-links">
        <a v-for="(path, label) in data.links" :key="path" :href="path">{{
          label
        }}</a>
      </nav>
      <div class="collection-ops-grid">
        <section>
          <h3>来源与健康</h3>
          <table>
            <thead>
              <tr>
                <th>来源</th>
                <th>状态</th>
                <th>健康</th>
                <th>连续失败</th>
                <th>最近检查</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in data.sources" :key="s.id">
                <td>
                  <b>{{ s.name }}</b
                  ><small>{{ s.code }} · {{ s.owner_label }}</small>
                </td>
                <td>{{ s.status }}</td>
                <td>
                  <i :data-health="s.health_status">{{ s.health_status }}</i>
                </td>
                <td>{{ s.consecutive_failures }}</td>
                <td>{{ when(s.last_checked_at) }}</td>
              </tr>
            </tbody>
          </table>
        </section>
        <section>
          <h3>任务状态</h3>
          <div class="collection-state-chips">
            <span v-for="t in data.task_states" :key="t.status"
              ><b>{{ t.total }}</b
              >{{ t.status }}</span
            >
          </div>
          <h3>质量问题</h3>
          <div class="collection-state-chips">
            <span v-for="q in data.quality" :key="q.status + q.severity"
              ><b>{{ q.total }}</b
              >{{ q.status }} · {{ q.severity }}</span
            >
          </div>
        </section>
        <section>
          <h3>最近尝试</h3>
          <table>
            <thead>
              <tr>
                <th>任务</th>
                <th>任务处理器</th>
                <th>状态</th>
                <th>错误</th>
                <th>链路编号</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="a in data.attempts" :key="a.id">
                <td>{{ a.task_id.slice(0, 8) }}… #{{ a.attempt_number }}</td>
                <td>{{ a.worker_id }}</td>
                <td>{{ a.status }}</td>
                <td>{{ a.error_code || "—" }}</td>
                <td>
                  <code>{{ a.trace_id.slice(0, 8) }}…</code>
                </td>
              </tr>
            </tbody>
          </table>
        </section>
        <section>
          <h3>开放与已重放死信</h3>
          <ul>
            <li v-for="d in data.dead_letters" :key="d.id">
              <b>{{ d.error_code }}</b
              ><span
                >{{ d.status }} · {{ d.organization_id.slice(0, 8) }}… ·
                {{ when(d.created_at) }}</span
              ><a :href="`/platform-admin/collection?task=${d.task_id}`"
                >查看并受控重放</a
              >
            </li>
          </ul>
        </section>
      </div>
      <footer>
        观测时间 {{ when(data.observed_at) }} · request_id {{ requestId }}
      </footer></template
    >
  </section>
</template>
