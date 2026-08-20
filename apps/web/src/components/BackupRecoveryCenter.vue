<script setup lang="ts">
import { onMounted, ref } from "vue";
const props = defineProps<{ apiBaseUrl: string }>();
const state = ref<"loading" | "empty" | "blocked" | "stale" | "verified" | "forbidden" | "expired">(
  "loading",
);
const data = ref<any>(null),
  requestId = ref(""),
  hint = ref("");
const when = (value?: string | null) => (value ? new Date(value).toLocaleString() : "尚无记录");
const bytes = (value: number) => (value ? `${(value / 1024 / 1024).toFixed(1)} MB` : "0 MB");
async function load() {
  state.value = "loading";
  try {
    const response = await fetch(`${props.apiBaseUrl}/platform/operations/backup-recovery`, {
      credentials: "include",
      headers: { accept: "application/json" },
    });
    const body = await response.json().catch(() => null);
    requestId.value = body?.request_id ?? "";
    hint.value = body?.error?.action_hint ?? "";
    if (!response.ok) {
      state.value =
        response.status === 401 ? "expired" : response.status === 403 ? "forbidden" : "blocked";
      return;
    }
    data.value = body.data;
    state.value = body.data.state;
  } catch {
    state.value = "blocked";
  }
}
onMounted(load);
</script>

<template>
  <section class="backup-center">
    <header class="backup-hero">
      <div>
        <p class="eyebrow">备份恢复管理</p>
        <h2>备份与恢复控制台</h2>
        <span>惠州当前主机内的加密副本与隔离恢复；不代表整机或异地灾备。</span>
      </div>
      <button type="button" @click="load">刷新事实</button>
    </header>
    <section v-if="state === 'loading'" class="state-card" data-kind="loading">
      <b>正在读取备份事实</b><span>校验数据库记录、恢复副本和最近演练。</span>
    </section>
    <section
      v-else-if="state === 'forbidden' || state === 'expired'"
      class="state-card"
      :data-kind="state"
    >
      <b>{{ state === "expired" ? "登录已失效" : "你没有平台运维权限" }}</b
      ><span>{{ hint || "请重新登录或联系平台管理员。" }}</span>
    </section>
    <template v-else-if="data">
      <section class="truth-banner" :data-kind="state">
        <div>
          <small>当前结论</small
          ><strong>{{
            state === "verified"
              ? "同机恢复链路已验证"
              : state === "stale"
                ? "恢复演练已过期"
                : state === "empty"
                  ? "尚无备份记录"
                  : "恢复链路受阻"
          }}</strong>
        </div>
        <p>
          {{
            state === "verified"
              ? "同机加密副本与隔离恢复均在有效期内；整机故障仍不受保护。"
              : "未满足的条件不会被标记为健康；请按阻断项完成宝塔任务与隔离演练。"
          }}
        </p>
      </section>
      <div class="policy-grid">
        <article>
          <span>主站</span><strong>{{ data.policy.primary_region }}</strong
          ><small>单机运行</small>
        </article>
        <article>
          <span>恢复目标</span><strong>{{ data.policy.recovery_region }}</strong
          ><small>{{ data.recovery_copy_verified ? "同机副本已核验" : "同机副本未核验" }}</small>
        </article>
        <article>
          <span>数据库最多可丢失时间</span><strong>{{ data.policy.rpo_minutes }} min</strong
          ><small>目标上限</small>
        </article>
        <article>
          <span>数据库恢复耗时</span><strong>{{ data.policy.rto_minutes }} min</strong
          ><small>目标上限</small>
        </article>
      </div>
      <div class="backup-grid">
        <section class="panel">
          <div class="panel-title">
            <h3>备份资产</h3>
            <span>高强度加密</span>
          </div>
          <div v-if="!data.targets.length" class="empty">没有可展示的备份资产。</div>
          <table v-else>
            <thead>
              <tr>
                <th>对象</th>
                <th>角色</th>
                <th>区域</th>
                <th>数量</th>
                <th>体积</th>
                <th>完整性</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="target in data.targets"
                :key="`${target.asset_kind}-${target.region}-${target.storage_role}`"
              >
                <td>{{ target.asset_kind }}</td>
                <td>
                  {{ target.storage_role === "recovery_copy" ? "恢复副本" : "主备份" }}
                </td>
                <td>{{ target.region }}</td>
                <td>{{ target.bundle_count }}</td>
                <td>{{ bytes(target.size_bytes) }}</td>
                <td>{{ target.integrity_verified ? "已核验" : "未核验" }}</td>
              </tr>
            </tbody>
          </table>
        </section>
        <section class="panel">
          <div class="panel-title">
            <h3>恢复证据</h3>
            <span>90 天有效期</span>
          </div>
          <dl>
            <div>
              <dt>最近备份</dt>
              <dd>{{ when(data.latest_backup?.finished_at) }}</dd>
            </div>
            <div>
              <dt>实际最多可丢失时间</dt>
              <dd>
                {{
                  data.latest_backup?.actual_rpo_minutes == null
                    ? "未记录"
                    : `${data.latest_backup.actual_rpo_minutes} min`
                }}
              </dd>
            </div>
            <div>
              <dt>最近隔离恢复</dt>
              <dd>{{ when(data.latest_drill?.finished_at) }}</dd>
            </div>
            <div>
              <dt>实际恢复耗时</dt>
              <dd>
                {{
                  data.latest_drill?.actual_rto_minutes == null
                    ? "未记录"
                    : `${data.latest_drill.actual_rto_minutes} min`
                }}
              </dd>
            </div>
            <div>
              <dt>权限边界</dt>
              <dd>
                {{ data.latest_drill?.permission_boundary_verified ? "已核验" : "未核验" }}
              </dd>
            </div>
            <div>
              <dt>审计链 / 证据哈希</dt>
              <dd>
                {{
                  data.latest_drill?.audit_chain_verified &&
                  data.latest_drill?.evidence_hash_verified
                    ? "已核验"
                    : "未核验"
                }}
              </dd>
            </div>
          </dl>
        </section>
      </div>
      <section v-if="data.blockers.length" class="blockers">
        <h3>阻断项</h3>
        <article v-for="item in data.blockers" :key="item.code">
          <code>{{ item.code }}</code>
          <p>{{ item.action_hint }}</p>
        </article>
      </section>
      <footer>
        观测时间 {{ when(data.observed_at) }} · request_id {{ requestId || "—" }} ·
        恢复动作仅由宝塔受控任务执行
      </footer>
    </template>
  </section>
</template>

<style scoped>
.backup-center {
  --ink: var(--so-text);
  --muted: var(--so-text-muted);
  --line: var(--so-border);
  --blue: var(--so-primary);
  --cyan: var(--so-primary);
  --green: var(--so-success);
  --amber: var(--so-warning);
  color: var(--ink);
  display: grid;
  gap: 18px;
}
.backup-hero {
  align-items: end;
  background:
    radial-gradient(
      circle at 78% 0,
      color-mix(in srgb, var(--so-info) 40%, transparent),
      transparent 42%
    ),
    linear-gradient(135deg, var(--so-bg-elevated), var(--so-bg-elevated));
  border: 1px solid var(--line);
  border-radius: 18px;
  display: flex;
  justify-content: space-between;
  min-height: 148px;
  padding: 28px;
}
.eyebrow {
  color: var(--cyan);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.18em;
  margin: 0 0 8px;
}
.backup-hero h2 {
  font-family: "Microsoft YaHei UI", sans-serif;
  font-size: 28px;
  margin: 0 0 8px;
}
.backup-hero span,
.state-card span {
  color: var(--muted);
}
button {
  background: var(--so-primary-strong);
  border: 1px solid var(--so-border-strong);
  border-radius: 9px;
  color: var(--so-on-primary);
  cursor: pointer;
  padding: 10px 16px;
}
.truth-banner {
  align-items: center;
  background: var(--so-panel);
  border: 1px solid var(--line);
  border-left: 4px solid var(--amber);
  border-radius: 12px;
  display: flex;
  justify-content: space-between;
  padding: 17px 20px;
}
.truth-banner[data-kind="verified"] {
  border-left-color: var(--green);
}
.truth-banner small,
.policy-grid span,
.policy-grid small {
  color: var(--muted);
  display: block;
}
.truth-banner strong {
  display: block;
  font-size: 19px;
  margin-top: 4px;
}
.truth-banner p {
  color: var(--so-text);
  margin: 0;
  max-width: 610px;
}
.policy-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(4, 1fr);
}
.policy-grid article,
.panel,
.blockers,
.state-card {
  background: linear-gradient(160deg, var(--so-panel-soft), var(--so-panel-soft));
  border: 1px solid var(--line);
  border-radius: 13px;
}
.policy-grid article {
  padding: 17px;
}
.policy-grid strong {
  display: block;
  font-size: 23px;
  margin: 8px 0;
}
.backup-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: 1.55fr 1fr;
}
.panel {
  overflow: hidden;
  padding: 19px;
}
.panel-title {
  align-items: center;
  display: flex;
  justify-content: space-between;
}
.panel-title h3,
.blockers h3 {
  font-size: 15px;
  margin: 0 0 15px;
}
.panel-title span {
  color: var(--cyan);
  font-size: 11px;
}
table {
  border-collapse: collapse;
  width: 100%;
}
th,
td {
  border-bottom: 1px solid var(--so-border);
  padding: 12px 8px;
  text-align: left;
}
th {
  color: var(--muted);
  font-size: 11px;
  text-transform: uppercase;
}
td {
  font-size: 13px;
}
dl {
  display: grid;
  gap: 0;
  margin: 0;
}
dl div {
  border-bottom: 1px solid var(--so-border);
  padding: 11px 0;
}
dt {
  color: var(--muted);
  font-size: 12px;
}
dd {
  font-weight: 700;
  margin: 5px 0 0;
}
.blockers {
  padding: 19px;
}
.blockers article {
  align-items: start;
  border-top: 1px solid var(--so-border);
  display: grid;
  gap: 13px;
  grid-template-columns: minmax(180px, 0.5fr) 1fr;
  padding: 13px 0;
}
.blockers code {
  color: var(--amber);
}
.blockers p {
  color: var(--so-text);
  margin: 0;
}
.state-card {
  display: grid;
  gap: 7px;
  padding: 24px;
}
.empty,
footer {
  color: var(--muted);
  font-size: 12px;
  padding: 18px 0;
}
footer {
  text-align: right;
}
@media (max-width: 760px) {
  .backup-hero,
  .truth-banner {
    align-items: flex-start;
    flex-direction: column;
    gap: 16px;
  }
  .policy-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .backup-grid {
    grid-template-columns: 1fr;
  }
  .panel {
    overflow-x: auto;
  }
  .blockers article {
    grid-template-columns: 1fr;
  }
  .backup-hero {
    padding: 21px;
  }
  .backup-hero h2 {
    font-size: 24px;
  }
}
</style>
