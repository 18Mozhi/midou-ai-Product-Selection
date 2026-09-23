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
  <main class="not-found-page not-found-page--review" aria-labelledby="not-found-title">
    <header class="p73-top">
      <RouterLink to="/home" aria-label="返回智能选品今日行动">
        <span aria-hidden="true">选</span><b>ScoutOps</b>
      </RouterLink>
      <p>页面恢复边界</p>
    </header>
    <section class="p73-hero">
      <p>404 / 页面未登记</p>
      <h1 id="not-found-title" ref="heading" tabindex="-1">没有找到这个页面</h1>
      <span
        >地址可能已变更、页面已下线，或链接输入有误。这里不会把不存在的页面解释为无权限，也不会展示任何受限数据。</span
      >
    </section>
    <section class="p73-workspace" aria-label="页面恢复信息">
      <div class="p73-route">
        <small>当前地址</small>
        <code :title="route.path" dir="ltr">{{ requestedPath }}</code>
      </div>
      <div class="p73-recovery">
        <div>
          <small>下一步</small>
          <h2>回到有效工作区</h2>
          <p>恢复入口只使用现有安全路由；没有网络读取或业务数据访问。</p>
        </div>
        <nav aria-label="页面恢复操作">
          <RouterLink class="not-found-primary" :to="recentDestination.fullPath">
            {{ hasDistinctRecentDestination ? "返回最近页面" : "返回今日行动" }}
          </RouterLink>
          <RouterLink v-if="hasDistinctRecentDestination" class="not-found-secondary" to="/home">
            返回今日行动
          </RouterLink>
        </nav>
      </div>
      <p class="not-found-continuity">
        <template v-if="hasDistinctRecentDestination">将返回：{{ recentTitle }}</template>
        <template v-else>将从今日行动重新进入业务流程</template>
      </p>
    </section>
    <aside class="p73-boundary">
      <b>公开兜底 / 不读业务数据</b>
      <span>未知地址与真实权限状态保持分离；路径仅作本地可读提示。</span>
    </aside>
    <footer class="not-found-footer">
      <span>当前地址未匹配任何已登记页面</span>
      <span>本页不发起业务读取请求</span>
    </footer>
  </main>
</template>

<style scoped>
.not-found-page {
  --p73-blue: #1748a0;
  --p73-ink: #182d4a;
  --p73-muted: #52647b;
  --p73-line: #dce4ee;
  box-sizing: border-box;
  width: 100%;
  min-height: 100dvh;
  margin: 0;
  padding: 28px max(24px, calc((100vw - 940px) / 2)) 44px;
  display: grid;
  align-content: start;
  gap: 16px;
  color: var(--p73-ink);
  background: #f3f6fb;
  font:
    16px/1.65 "Microsoft YaHei",
    sans-serif;
}
.not-found-page *,
.not-found-page *::before,
.not-found-page *::after {
  box-sizing: border-box;
}
.not-found-page :is(h1, h2, p) {
  margin: 0;
}
.not-found-page :is(a, button):focus-visible {
  outline: 3px solid #2465d7;
  outline-offset: 3px;
}
.p73-top,
.not-found-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  color: var(--p73-muted);
  font-size: 13px;
}
.p73-top a {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  gap: 9px;
  color: var(--p73-ink);
  font-size: 17px;
  text-decoration: none;
}
.p73-top a span {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  color: #fff;
  background: var(--p73-blue);
}
.p73-hero {
  padding: 34px 36px;
  color: #fff;
  background: var(--p73-blue);
}
.p73-hero p {
  color: #d9e6ff;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.06em;
}
.p73-hero h1 {
  margin: 5px 0;
  color: #fff;
  font-size: 34px;
  line-height: 1.35;
}
.p73-hero h1:focus {
  outline: none;
}
.p73-hero > span {
  color: #e2ebff;
}
.p73-workspace {
  border: 1px solid var(--p73-line);
  background: #fff;
}
.p73-route {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  gap: 14px;
  align-items: center;
  padding: 18px 22px;
  border-bottom: 1px solid var(--p73-line);
  background: #f6f9ff;
}
.p73-route small,
.p73-recovery small {
  color: var(--p73-muted);
  font-size: 13px;
}
.p73-route code {
  min-width: 0;
  overflow: hidden;
  overflow-wrap: anywhere;
  color: var(--p73-ink);
  font-family: Consolas, "Courier New", monospace;
  text-overflow: ellipsis;
}
.p73-recovery {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 24px 22px;
}
.p73-recovery h2 {
  margin-top: 3px;
  font-size: 23px;
}
.p73-recovery p {
  max-width: 460px;
  margin-top: 5px;
  color: var(--p73-muted);
}
.p73-recovery nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.p73-recovery nav a {
  min-height: 44px;
  padding: 10px 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--p73-blue);
  color: var(--p73-blue);
  background: #fff;
  text-decoration: none;
}
.p73-recovery nav .not-found-primary {
  color: #fff;
  background: var(--p73-blue);
}
.not-found-continuity {
  padding: 13px 22px;
  border-top: 1px solid var(--p73-line);
  color: var(--p73-muted);
  font-size: 13px;
}
.p73-boundary {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  padding: 12px 16px;
  border-left: 3px solid var(--p73-blue);
  background: #edf4ff;
}
.p73-boundary span {
  color: var(--p73-muted);
}
.not-found-footer {
  width: 100%;
  margin-top: 0;
}
@media (max-width: 760px) {
  .not-found-page {
    padding: 18px 16px 36px;
  }
  .p73-top p {
    display: none;
  }
  .p73-hero {
    padding: 24px 18px;
  }
  .p73-hero h1 {
    font-size: 28px;
  }
  .p73-route {
    grid-template-columns: 1fr;
    gap: 4px;
    padding: 18px;
  }
  .p73-recovery {
    align-items: stretch;
    flex-direction: column;
    padding: 20px 18px;
  }
  .p73-recovery nav {
    display: grid;
  }
  .p73-recovery nav a {
    width: 100%;
  }
  .not-found-continuity {
    padding: 13px 18px;
  }
  .p73-boundary,
  .not-found-footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
@media (prefers-reduced-motion: reduce) {
  .not-found-page * {
    transition: none !important;
    animation: none !important;
  }
}
</style>
