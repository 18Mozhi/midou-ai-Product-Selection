import assert from "node:assert/strict";

const template = `<template>
  <section class="acceptance-1688 p49-acceptance" :data-state="state" :aria-busy="refreshing">
    <header class="p49-acceptance__masthead">
      <div>
        <p>来源治理 / 登录来源</p>
        <h2>1688 启用检查</h2>
        <span>核对真实浏览器运行、固定样本回放与审批结论；不展示 Cookie 或账号秘密。</span>
      </div>
      <div class="acceptance-1688__refresh">
        <small>最近读取 {{ lastUpdatedLabel }}</small>
        <button type="button" :disabled="refreshing" @click="load">
          {{ refreshing ? "刷新中…" : "刷新检查结果" }}
        </button>
      </div>
    </header>

    <p
      v-if="notice"
      class="acceptance-1688__notice"
      :data-tone="noticeTone"
      role="status"
      aria-live="polite"
    >
      {{ notice }}
    </p>

    <section v-if="state !== 'ready'" class="acceptance-1688__state" :data-kind="state">
      <span aria-hidden="true">{{ state === "loading" ? "···" : "!" }}</span>
      <div aria-live="polite">
        <p>启用检查</p>
        <h3>{{ stateTitle }}</h3>
        <p>{{ message || "正在核对登录、验证码和字段解析三项证据。" }}</p>
        <details v-if="requestId">
          <summary>故障详情</summary>
          <code>关联编号：{{ requestId }}</code>
        </details>
      </div>
      <RouterLink v-if="state === 'expired'" to="/login">重新登录</RouterLink>
      <RouterLink v-else-if="state === 'forbidden'" to="/platform-admin">返回平台概览</RouterLink>
      <button v-else-if="state !== 'loading'" type="button" :disabled="refreshing" @click="load">
        重新读取
      </button>
    </section>

    <div v-else-if="data" class="p49-acceptance__layout">
      <aside class="acceptance-1688__verdict" :data-overall="data.overall">
        <div class="acceptance-1688__verdict-copy">
          <span>当前结论</span>
          <h3>{{ title }}</h3>
          <p>{{ conclusion }}</p>
        </div>
        <dl aria-label="当前启用概览">
          <div>
            <dt>来源状态</dt>
            <dd>{{ sourceState[data.source_status] }}</dd>
          </div>
          <div>
            <dt>通过门禁</dt>
            <dd>{{ passedGateCount }} / 3</dd>
          </div>
          <div>
            <dt>责任人</dt>
            <dd>{{ data.owner_label }}</dd>
          </div>
        </dl>
        <p class="p49-acceptance__boundary">三项门禁与来源启用互相独立；系统不会自动启用或停用来源。</p>
      </aside>

      <main class="p49-acceptance__body">
        <section class="acceptance-1688__section p49-acceptance__gates" aria-labelledby="acceptance-1688-gates-title">
          <header>
            <div>
              <p>01 / 启用门禁</p>
              <h3 id="acceptance-1688-gates-title">逐项核对三类证据</h3>
            </div>
            <small>三项必须全部通过；它们不是顺序步骤。</small>
          </header>
          <div class="acceptance-1688__gates" aria-label="1688 启用条件">
            <article v-for="gate in data.gates" :key="gate.key" :data-gate-state="gate.state">
              <div class="acceptance-1688__card-title">
                <span>{{ gateName[gate.key] }}</span>
                <strong>{{ gateState[gate.state] }}</strong>
              </div>
              <p>{{ gate.reason }}</p>
              <dl>
                <div><dt>应采取的动作</dt><dd>{{ gateAction[gate.key] }}</dd></div>
                <div><dt>证据时间</dt><dd><time :datetime="gate.evidence_at || undefined">{{ time(gate.evidence_at) }}</time></dd></div>
              </dl>
            </article>
          </div>
        </section>

        <section class="acceptance-1688__actions" aria-labelledby="p49-next-title">
          <header>
            <div>
              <p>02 / 下一步</p>
              <h3 id="p49-next-title">{{ data.pending_reasons.length ? "先处理当前未通过项" : "门禁已全部通过" }}</h3>
            </div>
          </header>
          <ol v-if="data.pending_reasons.length">
            <li v-for="reason in data.pending_reasons" :key="reason">{{ reason }}</li>
          </ol>
          <p v-else>当前没有待配置原因；由 {{ data.owner_label }} 复核后显式启用来源。</p>
          <nav aria-label="1688 启用检查下一步操作">
            <RouterLink :to="credentialsLink">配置或续期登录档案</RouterLink>
            <RouterLink :to="sampleLink">定位 1688 固定样本</RouterLink>
          </nav>
        </section>

        <section class="acceptance-1688__start" aria-labelledby="acceptance-1688-start-title">
          <header>
            <div>
              <p>03 / 受控运行</p>
              <h3 id="acceptance-1688-start-title">发起一次真实登录验收</h3>
            </div>
            <small>只创建本次人工验收；不会启用来源或加入自动调度。</small>
          </header>
          <form @submit.prevent="scheduleAcceptanceRun">
            <label>
              <span>组织</span>
              <select v-model="selectedOrganizationId" aria-label="组织" :disabled="scopeLoading || scheduling" @change="loadWorkspaces">
                <option value="">请选择组织</option>
                <option v-for="organization in organizations" :key="organization.id" :value="organization.id">{{ organization.name }}</option>
              </select>
            </label>
            <label>
              <span>工作区</span>
              <select v-model="selectedWorkspaceId" aria-label="工作区" :disabled="scopeLoading || scheduling">
                <option value="">请选择工作区</option>
                <option v-for="workspace in workspaces" :key="workspace.id" :value="workspace.id">{{ workspace.name }}</option>
              </select>
            </label>
            <label class="acceptance-1688__query">
              <span>验收关键词</span>
              <input v-model="acceptanceQuery" type="text" aria-label="验收关键词" maxlength="200" autocomplete="off" placeholder="例如：桌面灯" :disabled="scheduling" />
            </label>
            <button class="acceptance-1688__start-button" type="submit" :disabled="!canSchedule">
              {{ scheduling ? "提交中…" : "发起登录验收运行" }}
            </button>
          </form>
          <p v-if="scopeMessage" class="acceptance-1688__form-message" role="alert">{{ scopeMessage }}</p>
          <details v-if="scheduledTaskId">
            <summary>运行详情</summary>
            <code>任务编号：{{ scheduledTaskId }}</code>
          </details>
        </section>

        <div class="p49-acceptance__diagnostics">
          <section class="acceptance-1688__section" aria-labelledby="acceptance-1688-matrix-title">
            <header>
              <div>
                <p>04 / 运行覆盖</p>
                <h3 id="acceptance-1688-matrix-title">搜索、详情与翻页矩阵</h3>
              </div>
              <small>诊断证据，不计入三项启用门禁。</small>
            </header>
            <div class="p49-acceptance__matrix-meta">
              <span>解析器版本</span><code>{{ data.coverage_matrix.parser_version }}</code>
              <span>最近观测</span><time>{{ time(data.coverage_matrix.observed_at) }}</time>
            </div>
            <div class="acceptance-1688__matrix">
              <article v-for="row in data.coverage_matrix.rows" :key="row.key" :data-matrix-state="row.state">
                <div class="acceptance-1688__card-title">
                  <span>{{ matrixName[row.key] }}</span>
                  <strong>{{ matrixState[row.state] }}</strong>
                </div>
                <p>{{ row.reason }}</p>
                <small>{{ row.contract }} · {{ row.observed_count }} 项</small>
              </article>
            </div>
          </section>

          <section class="acceptance-1688__run" aria-labelledby="p49-run-title">
            <header>
              <div>
                <p>05 / 最近运行</p>
                <h3 id="p49-run-title">{{ currentRunState }}</h3>
              </div>
            </header>
            <dl v-if="data.latest_run">
              <div><dt>开始</dt><dd>{{ time(data.latest_run.started_at) }}</dd></div>
              <div><dt>完成</dt><dd>{{ time(data.latest_run.finished_at) }}</dd></div>
              <div><dt>错误分类</dt><dd>{{ data.latest_run.error_code || "无" }}</dd></div>
            </dl>
            <p v-else>配置有效登录档案后，从真实业务采集任务发起一次 1688 浏览器运行。</p>
            <details>
              <summary>技术详情</summary>
              <code>overall {{ data.overall }}</code>
              <code>来源内部编号：{{ data.provider_id }}</code>
              <code>关联编号：{{ requestId || "—" }}</code>
            </details>
          </section>
        </div>
      </main>
    </div>
  </section>
</template>`;

export const acceptancePageCopy = {
  privacy: "核对真实浏览器运行、固定样本回放与审批结论；不展示 Cookie 或账号秘密。",
  independence: "三项门禁与来源启用互相独立；系统不会自动启用或停用来源。",
  coverage: "诊断证据，不计入三项启用门禁。",
};

export function previewAlibaba1688AcceptanceCenter(source) {
  const start = source.indexOf("<template>"),
    end = source.indexOf("<style scoped>", start),
    styleEnd = source.indexOf("</style>", end);
  assert.ok(start >= 0 && end > start, "P49 template boundaries");
  assert.ok(styleEnd > end, "P49 style boundaries");
  assert.equal(source.slice(styleEnd + "</style>".length).trim(), "", "P49 style is final block");
  return source.slice(0, start) + template + "\n\n<style scoped></style>\n";
}
