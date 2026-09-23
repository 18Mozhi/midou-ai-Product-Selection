<script setup lang="ts">
type CapacityEvidence = {
  observed_at: string;
  boundary: {
    measured_concurrency: number;
    capacity_claim: "unverified" | "measured_single_host_limited";
    stop_reason: "next_stage_gate_failed" | "planning_ceiling_reached" | null;
    failed_next_concurrency: number | null;
    failed_next_code: string | null;
  };
  performance: {
    read_p95_ms: number;
    write_p95_ms: number;
    error_rate_basis_points: number;
    async_lag_seconds: number;
  };
  resource: {
    load_basis_points: number;
    available_memory_mb: number;
    free_disk_mb: number;
  };
  resilience: { archive_verified: boolean; recovery_verified: boolean };
  degradation: { mode: "normal" | "shed_background" | "stop_new_work"; actions: string[] };
  findings: Array<{
    code: string;
    severity: "warning" | "blocked";
    reason: string;
    owner_role_code: "platform_operations_admin";
    owner_label: "平台运维管理员";
    action_hint: string;
  }>;
};

type Props = {
  data: CapacityEvidence;
  state: "ready" | "warning" | "blocked";
  boundaryHint: string;
  nextStageHint: string;
  pct: (value: number) => string;
  time: (value: string) => string;
};

const props = defineProps<Props>();
</script>

<template>
  <section class="p71-paper">
    <section class="p71-conclusion" :data-verdict="props.state">
      <div>
        <small>S0 / {{ props.state }}</small>
        <h2>
          {{
            props.state === "ready"
              ? "当前单机容量门满足"
              : props.state === "warning"
                ? "当前容量需人工关注"
                : "当前容量门阻断"
          }}
        </h2>
        <p>声明仅限当前返回的单机事实；不构成压测授权或扩容承诺。</p>
      </div>
      <div>
        <b>观测时间</b
        ><time :datetime="props.data.observed_at">{{ props.time(props.data.observed_at) }}</time>
      </div>
    </section>

    <section class="p71-stages">
      <header>
        <div>
          <h2>通过档位与停止事实</h2>
          <p>最后通过与下一档停止必须成对阅读；缺失不补成承诺。</p>
        </div>
        <b>{{
          props.data.boundary.capacity_claim === "measured_single_host_limited"
            ? "单机有限实测"
            : "未验证"
        }}</b>
      </header>
      <dl>
        <div>
          <dt>最后通过并发档位</dt>
          <dd>{{ props.data.boundary.measured_concurrency }}</dd>
        </div>
        <div>
          <dt>下一档事实</dt>
          <dd>{{ props.nextStageHint }}</dd>
        </div>
        <div>
          <dt>停止原因</dt>
          <dd>{{ props.data.boundary.stop_reason || "未返回" }}</dd>
        </div>
        <div>
          <dt>失败代码</dt>
          <dd>{{ props.data.boundary.failed_next_code || "未返回" }}</dd>
        </div>
      </dl>
      <p class="p71-note">{{ props.boundaryHint }}</p>
    </section>

    <section class="p71-performance">
      <header>
        <div>
          <h2>性能参考与停止线</h2>
          <p>这是返回值及参考线，不在浏览器重新判定服务状态。</p>
        </div>
      </header>
      <dl>
        <div>
          <dt>读取 P95</dt>
          <dd>{{ props.data.performance.read_p95_ms }} ms<small>停止线 300 ms</small></dd>
        </div>
        <div>
          <dt>写入 P95</dt>
          <dd>{{ props.data.performance.write_p95_ms }} ms<small>停止线 600 ms</small></dd>
        </div>
        <div>
          <dt>错误率</dt>
          <dd>
            {{ props.pct(props.data.performance.error_rate_basis_points) }}<small>停止线 1%</small>
          </dd>
        </div>
        <div>
          <dt>异步滞后</dt>
          <dd>{{ props.data.performance.async_lag_seconds }} 秒<small>停止线 60 秒</small></dd>
        </div>
      </dl>
    </section>

    <div class="p71-evidence">
      <section class="p71-resilience">
        <header>
          <div>
            <h2>归档与恢复签认</h2>
            <p>签认只记录已核验事实，不执行恢复。</p>
          </div>
        </header>
        <dl>
          <div>
            <dt>归档</dt>
            <dd>{{ props.data.resilience.archive_verified ? "已核验" : "未核验" }}</dd>
          </div>
          <div>
            <dt>隔离恢复</dt>
            <dd>{{ props.data.resilience.recovery_verified ? "已核验" : "未核验" }}</dd>
          </div>
          <div>
            <dt>降载模式</dt>
            <dd>{{ props.data.degradation.mode }}</dd>
          </div>
        </dl>
        <p class="p71-note">操作不会启动新服务、删除数据或改变并发上限。</p>
      </section>
      <section class="p71-resources">
        <header>
          <div>
            <h2>资源绝对值</h2>
            <p>绝对值不是容量比例，故不绘制误导性水位条。</p>
          </div>
        </header>
        <dl>
          <div>
            <dt>归一化负载</dt>
            <dd>{{ props.pct(props.data.resource.load_basis_points) }}</dd>
          </div>
          <div>
            <dt>可用内存</dt>
            <dd>{{ props.data.resource.available_memory_mb }} MB</dd>
          </div>
          <div>
            <dt>可用磁盘</dt>
            <dd>{{ props.data.resource.free_disk_mb }} MB</dd>
          </div>
        </dl>
        <p class="p71-note">非正或异常值按原始返回显示，不能据此称为资源充足。</p>
      </section>
    </div>

    <section class="p71-findings">
      <header>
        <div>
          <h2>容量告警与处置</h2>
          <p>{{ props.data.findings.length }} 项返回发现；责任角色与处理提示逐项保留。</p>
        </div>
      </header>
      <article v-for="item in props.data.findings" :key="item.code" :data-severity="item.severity">
        <b>{{ item.severity === "blocked" ? "阻断" : "预警" }}</b>
        <strong>{{ item.reason }}</strong>
        <small>责任人：{{ item.owner_label }}</small>
        <p>{{ item.action_hint }}</p>
        <details>
          <summary>技术详情</summary>
          <code>{{ item.code }} · {{ item.owner_role_code }}</code>
        </details>
      </article>
      <p v-if="!props.data.findings.length" class="p71-note">
        当前返回没有发现；这不证明 100 人、多节点或高可用能力。
      </p>
    </section>
  </section>
</template>
