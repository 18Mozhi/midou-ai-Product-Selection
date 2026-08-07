<template>
  <header class="topbar">
    <div>
      <p class="eyebrow">FOUNDATION / M00-07</p>
      <h1>自动验收框架</h1>
    </div>
    <span class="environment">本地 / CI / 宝塔发布任务</span>
  </header>

  <section class="status-card verification-card" data-state="ready" aria-labelledby="verification-title">
    <div class="status-heading">
      <span class="status-dot" aria-hidden="true"></span>
      <div>
        <p class="status-kicker">VERIFICATION EXECUTORS</p>
        <h2 id="verification-title">三层执行器已注册</h2>
      </div>
    </div>
    <div class="command-list" aria-label="验收命令">
      <code>npm run verify:module -- M00-01</code>
      <code>npm run verify:phase -- P00</code>
      <code>npm run verify:all</code>
    </div>
  </section>

  <section class="verification-grid" aria-label="验收状态语义">
    <article>
      <span class="state-label state-label--passed">PASSED · 通过</span>
      <h3>全部注册命令返回 0</h3>
      <p>报告包含原子任务、命令耗时、run_id、trace_id 和完成时间。</p>
    </article>
    <article>
      <span class="state-label state-label--failed">FAILED · 失败</span>
      <h3>立即阻断当前范围</h3>
      <p>保留首个失败命令、退出码与脱敏输出；修复后必须重新执行。</p>
    </article>
    <article>
      <span class="state-label state-label--blocked">BLOCKED · 前置未满足</span>
      <h3>不进入下游模块</h3>
      <p>缺少依赖、计划或注册表时返回非零，不能由人工勾选改成通过。</p>
    </article>
  </section>

  <section class="verification-footnote">
    <strong>运行边界</strong>
    <p>详细报告只写入项目内的受控目录，不从浏览器触发命令，也不公开密码、Cookie、Token、API Key 或私钥。</p>
  </section>
</template>
