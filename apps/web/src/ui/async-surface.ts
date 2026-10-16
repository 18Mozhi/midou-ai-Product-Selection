import { defineAsyncComponent, defineComponent, h, type Component } from "vue";
import UiStatePanel from "../components/UiStatePanel.vue";

const SurfaceLoading = defineComponent({
  name: "SurfaceLoading",
  setup: () => () => h(UiStatePanel, { kind: "loading", title: "正在准备工作区", compact: true }),
});

const SurfaceLoadError = defineComponent({
  name: "SurfaceLoadError",
  setup: () => () =>
    h(UiStatePanel, {
      kind: "error",
      title: "页面资源未能加载",
      description: "请检查网络连接后重新加载页面。",
      primaryLabel: "重新加载页面",
      hideSecondary: true,
      onPrimary: () => window.location.reload(),
    }),
});

/** Show actual chunk loading without delaying fast or cached navigation. */
export function asyncSurface(loader: () => Promise<{ default: Component }>) {
  return defineAsyncComponent({
    loader,
    loadingComponent: SurfaceLoading,
    errorComponent: SurfaceLoadError,
    delay: 120,
  });
}
