<script setup lang="ts">
import UiStatePanel from "./UiStatePanel.vue";

type LandingState = "loading" | "blocked";

const props = defineProps<{
  state: LandingState;
  requestId: string;
}>();

const emit = defineEmits<{ retry: [] }>();
</script>

<template>
  <main class="landing-redirect" :data-state="props.state" aria-live="polite">
    <div class="landing-frame">
      <header class="p01-top">
        <span class="p01-brand">ScoutOps</span>
        <small>入口解析 · 不预设角色或工作区</small>
      </header>

      <section class="p01-hero" aria-labelledby="landing-title">
        <p>正在进入</p>
        <h1 id="landing-title">正在确定可进入的工作区</h1>
        <span>先依据当前会话解析真实入口，再进入允许的工作范围。</span>
      </section>

      <aside class="p01-boundary" aria-label="会话入口说明">
        <b>会话入口 / 只读解析</b>
        <span>加载时不展示可重复动作；失败时仅重新检查，不生成角色、数据或成功结论。</span>
      </aside>

      <section
        class="p01-workspace"
        :data-state="props.state"
        aria-labelledby="landing-status-title"
      >
        <header>
          <small>{{ props.state === "loading" ? "正在解析" : "需要重新检查" }}</small>
          <h2 id="landing-status-title">
            {{ props.state === "loading" ? "入口仍在确认中" : "当前无法确定入口" }}
          </h2>
        </header>
        <UiStatePanel
          :kind="props.state === 'loading' ? 'loading' : 'blocked'"
          :title="props.state === 'loading' ? '请稍候' : '依赖暂时受阻'"
          :description="
            props.state === 'loading'
              ? '正在安全读取当前会话允许的入口。'
              : '请求因限流、超时或依赖暂时不可用而停止；不会伪装为成功。'
          "
          :request-id="props.requestId"
          :primary-label="props.state === 'loading' ? '正在进入工作台' : '重新检查'"
          @primary="emit('retry')"
        />
        <p class="p01-note">此页只处理入口解析；成功后由原路由替换进入目标页。</p>
      </section>

      <footer class="p01-footer">
        <span>无业务侧栏 · 无业务写入</span>
        <span>请求标识仅在失败时显示</span>
      </footer>
    </div>
  </main>
</template>

<style scoped>
.landing-redirect {
  --p01-blue: #1748a0;
  --p01-ink: #182d4a;
  --p01-muted: #52647b;
  --p01-line: #dce4ee;
  min-height: 100dvh;
  color: var(--p01-ink);
  background: #f3f6fb;
  font-size: 17px;
  line-height: 1.65;
}

.landing-frame {
  width: min(860px, calc(100% - 48px));
  min-height: 100dvh;
  margin: 0 auto;
  padding: 28px 0 44px;
  display: grid;
  align-content: start;
  gap: 16px;
}

.landing-redirect :is(h1, h2, p) {
  margin: 0;
}

.p01-top,
.p01-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  color: var(--p01-muted);
  font-size: 13px;
}

.p01-brand {
  min-height: 32px;
  padding: 4px 10px;
  display: inline-flex;
  align-items: center;
  color: #fff;
  background: var(--p01-blue);
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0.04em;
}

.p01-hero {
  padding: 34px 36px;
  color: #fff;
  background: var(--p01-blue);
}

.p01-hero p {
  color: #d9e6ff;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.06em;
}

.p01-hero h1 {
  margin: 5px 0;
  color: #fff;
  font-size: 34px;
  line-height: 1.35;
}

.p01-hero > span {
  color: #e2ebff;
}

.p01-boundary {
  padding: 12px 16px;
  display: flex;
  gap: 12px;
  border-left: 3px solid var(--p01-blue);
  background: #edf4ff;
}

.p01-boundary span {
  color: var(--p01-muted);
}

.p01-workspace {
  border: 1px solid var(--p01-line);
  background: #fff;
}

.p01-workspace > header {
  padding: 20px 24px;
  border-bottom: 1px solid var(--p01-line);
  background: #f6f9ff;
}

.p01-workspace > header small {
  color: var(--p01-muted);
  font-size: 13px;
}

.p01-workspace > header h2 {
  margin-top: 3px;
  font-size: 23px;
}

.p01-workspace :deep(.ui-state-panel) {
  width: 100%;
  min-height: 0;
  padding: 28px 24px;
  border: 0;
  border-radius: 0;
  background: #fff;
  box-shadow: none;
}

.p01-workspace :deep(.ui-state-symbol) {
  border-radius: 0;
  color: var(--p01-blue);
  background: #edf4ff;
}

.p01-workspace :deep(.ui-state-panel h2) {
  color: var(--p01-ink);
  font-size: 26px;
}

.p01-workspace :deep(.ui-state-panel > p),
.p01-workspace :deep(.ui-state-panel > div:not(.ui-state-skeleton)) {
  color: var(--p01-muted);
}

.p01-workspace :deep(.ui-state-panel dl) {
  border-color: var(--p01-line);
  border-radius: 0;
  background: #f6f9ff;
}

.p01-workspace :deep(.ui-state-panel dd) {
  overflow-wrap: anywhere;
}

.p01-workspace :deep(.ui-state-panel footer button) {
  cursor: pointer;
  min-height: 44px;
  border: 1px solid var(--p01-blue);
  border-radius: 0;
  color: #fff;
  background: var(--p01-blue);
  box-shadow: none;
  font-size: 17px;
}

.p01-workspace :deep(.ui-state-panel footer button:hover:not(:disabled)) {
  border-color: #103b85;
  background: #103b85;
}

.p01-workspace :deep(.ui-state-panel footer button:active:not(:disabled)) {
  border-color: #0e3474;
  background: #0e3474;
}

.p01-workspace :deep(.ui-state-panel footer button:not(.primary)) {
  display: none;
}

.p01-workspace :deep(.ui-state-panel button:focus-visible) {
  outline: 3px solid #2465d7;
  outline-offset: 3px;
}

.p01-note {
  padding: 13px 24px;
  border-top: 1px solid var(--p01-line);
  color: var(--p01-muted);
}

@media (max-width: 760px) {
  .landing-frame {
    width: min(calc(100% - 32px), 520px);
    padding-top: 18px;
  }

  .p01-top small {
    max-width: 190px;
    text-align: right;
  }

  .p01-hero {
    padding: 24px 18px;
  }

  .p01-hero h1 {
    font-size: 28px;
  }

  .p01-boundary {
    align-items: flex-start;
    flex-direction: column;
  }

  .p01-workspace > header,
  .p01-workspace :deep(.ui-state-panel) {
    padding: 20px 18px;
  }

  .p01-workspace :deep(.ui-state-panel footer) {
    display: grid;
  }

  .p01-workspace :deep(.ui-state-panel footer button) {
    width: 100%;
  }

  .p01-footer {
    align-items: flex-start;
    flex-direction: column;
  }
}

@media (prefers-reduced-motion: reduce) {
  .landing-redirect :deep(*) {
    scroll-behavior: auto;
    transition: none;
    animation: none;
  }
}
</style>
