<script setup lang="ts">
defineProps<{ apiBaseUrl: string }>();
</script>
<template>
  <header class="topbar">
    <div>
      <p class="eyebrow">系统设置</p>
      <h1>配置边界</h1>
    </div>
    <span class="environment">浏览器安全视图</span>
  </header>
  <section class="status-card" data-state="ready">
    <div class="status-heading">
      <span class="status-dot" aria-hidden="true"></span>
      <div>
        <p class="status-kicker">公开配置</p>
        <h2>仅公开后端接口相对地址</h2>
      </div>
    </div>
    <dl class="metric-grid config-metrics" data-testid="public-config">
      <div>
        <dt>后端接口基础地址</dt>
        <dd>{{ apiBaseUrl }}</dd>
      </div>
      <div>
        <dt>服务端配置</dt>
        <dd>由宝塔受限环境持有</dd>
      </div>
    </dl>
  </section>
  <section class="verification-grid config-grid" aria-label="配置状态">
    <article>
      <span class="state-label state-label--passed">已校验</span>
      <h3>类型、范围与生产必填</h3>
      <p>端口、网址、超时、目录和密钥长度在进程启动前验证。</p>
    </article>
    <article>
      <span class="state-label state-label--failed">拒绝启动</span>
      <h3>缺失或越界不降级</h3>
      <p>错误只显示字段名与调整方式，不回显密码、令牌或主密钥值。</p>
    </article>
    <article>
      <span class="state-label state-label--blocked">需要重启</span>
      <h3>配置在启动时读取</h3>
      <p>在宝塔修改后重启对应后端、任务处理器或采集项目。</p>
    </article>
  </section>
</template>
