<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { getLastValidRoute } from "../navigation-memory";

const route = useRoute();
const router = useRouter();
const heading = ref<HTMLHeadingElement | null>(null);

const requestedPath = computed(() => {
  const path = route.path || "/";
  return path.length > 96 ? `${path.slice(0, 93)}…` : path;
});

const recentDestination = computed(() => {
  void route.fullPath;
  const fallback = router.resolve("/home");
  try {
    const candidate = router.resolve(getLastValidRoute());
    return candidate.meta.notFound === true || candidate.name === "not-found"
      ? fallback
      : candidate;
  } catch {
    return fallback;
  }
});

const hasDistinctRecentDestination = computed(() => recentDestination.value.path !== "/home");
const recentTitle = computed(() => {
  const title = recentDestination.value.meta.title;
  return typeof title === "string" && title.trim() ? title : "最近页面";
});

async function focusHeading() {
  await nextTick();
  heading.value?.focus();
}

onMounted(focusHeading);
watch(() => route.fullPath, focusHeading);
</script>

<template>
  <main class="not-found-page" aria-labelledby="not-found-title">
    <header class="not-found-header">
      <RouterLink to="/home" aria-label="返回智能选品今日行动">
        <span aria-hidden="true">选</span>
        <b>智能选品</b>
      </RouterLink>
      <p>页面未找到</p>
    </header>

    <section class="not-found-layout">
      <div class="not-found-signal" aria-hidden="true">
        <div class="not-found-orbit not-found-orbit-outer"></div>
        <div class="not-found-orbit not-found-orbit-inner"></div>
        <i class="not-found-satellite not-found-satellite-one"></i>
        <i class="not-found-satellite not-found-satellite-two"></i>
        <div class="not-found-code">
          <strong>404</strong>
          <span>信号未抵达</span>
        </div>
      </div>

      <div class="not-found-content">
        <p class="not-found-eyebrow">404 / PAGE NOT FOUND</p>
        <h1 id="not-found-title" ref="heading" tabindex="-1">没有找到这个页面</h1>
        <p class="not-found-description">
          地址可能已变更、页面已下线，或链接输入有误。这里不会把不存在的页面解释为无权限，也不会展示任何受限数据。
        </p>

        <div class="not-found-path">
          <span>当前地址</span>
          <code :title="route.path" dir="ltr">{{ requestedPath }}</code>
        </div>

        <nav aria-label="页面恢复操作">
          <RouterLink class="not-found-primary" :to="recentDestination.fullPath">
            {{ hasDistinctRecentDestination ? "返回最近页面" : "返回今日行动" }}
          </RouterLink>
          <RouterLink v-if="hasDistinctRecentDestination" class="not-found-secondary" to="/home">
            返回今日行动
          </RouterLink>
        </nav>

        <p class="not-found-continuity">
          <template v-if="hasDistinctRecentDestination">将返回：{{ recentTitle }}</template>
          <template v-else>将从今日行动重新进入业务流程</template>
        </p>
      </div>
    </section>

    <footer class="not-found-footer">
      <span>当前地址未匹配任何已登记页面</span>
      <span>未调用接口，未读取业务数据</span>
    </footer>
  </main>
</template>

<style scoped>
.not-found-page {
  min-height: 100vh;
  padding: 24px clamp(18px, 4vw, 58px) 18px;
  display: flex;
  flex-direction: column;
  color: var(--so-text);
  background:
    radial-gradient(
      circle at 72% 38%,
      color-mix(in srgb, var(--so-primary) 10%, transparent),
      transparent 26%
    ),
    var(--so-bg);
}

.not-found-page *:focus-visible {
  outline: 3px solid var(--so-focus);
  outline-offset: 3px;
}

.not-found-header,
.not-found-layout,
.not-found-footer {
  width: min(1180px, 100%);
  margin-inline: auto;
}

.not-found-header,
.not-found-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--so-space-4);
}

.not-found-header > a {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--so-text);
  font-size: 19px;
  text-decoration: none;
}

.not-found-header > a > span {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: var(--so-card-radius);
  color: var(--so-on-primary);
  background: linear-gradient(145deg, var(--so-primary), var(--so-primary-strong));
  font-weight: 850;
}

.not-found-header p,
.not-found-footer {
  margin: 0;
  color: var(--so-text-muted);
  font-size: var(--so-font-meta);
}

.not-found-layout {
  min-height: 650px;
  margin-block: clamp(22px, 5vh, 54px);
  padding: clamp(28px, 5vw, 72px);
  display: grid;
  grid-template-columns: minmax(320px, 0.9fr) minmax(420px, 1.1fr);
  align-items: center;
  gap: clamp(36px, 7vw, 96px);
  border: 1px solid var(--so-border);
  border-radius: var(--so-dialog-radius);
  background: color-mix(in srgb, var(--so-panel) 88%, transparent);
  box-shadow: var(--so-shadow);
  overflow: hidden;
}

.not-found-signal {
  position: relative;
  aspect-ratio: 1;
  width: min(430px, 100%);
  margin-inline: auto;
  display: grid;
  place-items: center;
  border: 1px solid var(--so-border);
  border-radius: 50%;
  background:
    radial-gradient(circle, var(--so-primary-soft), transparent 48%),
    color-mix(in srgb, var(--so-panel-soft) 55%, transparent);
}

.not-found-orbit {
  position: absolute;
  border: 1px solid color-mix(in srgb, var(--so-primary) 42%, transparent);
  border-radius: 50%;
}

.not-found-orbit-outer {
  inset: 9%;
}

.not-found-orbit-inner {
  inset: 25%;
}

.not-found-satellite {
  position: absolute;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: var(--so-primary);
  box-shadow: 0 0 0 7px color-mix(in srgb, var(--so-primary) 12%, transparent);
}

.not-found-satellite-one {
  top: 18%;
  right: 24%;
}

.not-found-satellite-two {
  bottom: 24%;
  left: 16%;
  background: var(--so-chart-3);
  box-shadow: 0 0 0 7px color-mix(in srgb, var(--so-chart-3) 12%, transparent);
}

.not-found-code {
  position: relative;
  z-index: 1;
  display: grid;
  justify-items: center;
  gap: 10px;
}

.not-found-code strong {
  font-size: clamp(66px, 9vw, 108px);
  line-height: 0.95;
  letter-spacing: -0.08em;
  color: var(--so-primary);
}

.not-found-code span,
.not-found-eyebrow {
  color: var(--so-primary);
  font-size: var(--so-font-meta);
  font-weight: 850;
  letter-spacing: 0.16em;
}

.not-found-content {
  max-width: 560px;
}

.not-found-eyebrow {
  margin: 0 0 var(--so-space-4);
}

.not-found-content h1 {
  margin: 0;
  font-size: clamp(38px, 5vw, 62px);
  line-height: 1.08;
  letter-spacing: -0.04em;
}

.not-found-content h1:focus {
  outline: none;
}

.not-found-description {
  margin: var(--so-space-5) 0 0;
  color: var(--so-text-muted);
  line-height: 1.75;
}

.not-found-path {
  margin-top: var(--so-space-5);
  padding: 14px 16px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: var(--so-space-3);
  border: 1px solid var(--so-border);
  border-radius: var(--so-card-radius);
  background: var(--so-panel-soft);
}

.not-found-path span {
  color: var(--so-text-muted);
  font-size: var(--so-font-meta);
}

.not-found-path code {
  min-width: 0;
  overflow: hidden;
  color: var(--so-text);
  font-family: Consolas, "Courier New", monospace;
  font-size: var(--so-font-meta);
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.not-found-content nav {
  margin-top: var(--so-space-5);
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.not-found-content nav a {
  min-height: 44px;
  padding: 10px 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--so-border);
  border-radius: var(--so-control-radius);
  color: var(--so-text);
  text-decoration: none;
  transition:
    border-color var(--so-transition),
    background var(--so-transition),
    transform var(--so-transition);
}

.not-found-content nav a:hover {
  transform: translateY(-1px);
}

.not-found-content nav .not-found-primary {
  color: var(--so-on-primary);
  border-color: transparent;
  background: linear-gradient(120deg, var(--so-primary-strong), var(--so-primary));
  font-weight: 750;
}

.not-found-secondary {
  background: var(--so-panel-soft);
}

.not-found-continuity {
  margin: var(--so-space-4) 0 0;
  color: var(--so-text-muted);
  font-size: var(--so-font-meta);
}

@media (max-width: 780px) {
  .not-found-page {
    padding: 14px 12px 18px;
  }

  .not-found-header p {
    display: none;
  }

  .not-found-layout {
    min-height: 0;
    margin-block: 12px 18px;
    padding: 28px 20px;
    grid-template-columns: 1fr;
    gap: 28px;
  }

  .not-found-signal {
    width: min(270px, 82vw);
  }

  .not-found-content {
    max-width: none;
  }

  .not-found-content h1 {
    font-size: clamp(34px, 11vw, 48px);
  }

  .not-found-description {
    margin-top: var(--so-space-4);
  }

  .not-found-path {
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .not-found-path code {
    text-align: left;
  }

  .not-found-content nav {
    display: grid;
  }

  .not-found-content nav a {
    width: 100%;
  }

  .not-found-footer {
    align-items: flex-start;
    flex-direction: column;
    gap: 6px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .not-found-content nav a {
    transition: none;
  }
}
</style>
