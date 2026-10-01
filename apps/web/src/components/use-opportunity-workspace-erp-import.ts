import type { Ref } from "vue";
import type { RouteLocationNormalizedLoaded } from "vue-router";

interface OpportunityWorkspaceErpImportOptions {
  route: Pick<RouteLocationNormalizedLoaded, "fullPath" | "path">;
  opportunityId: () => string | undefined;
  busy: Ref<boolean>;
  bridgeBusy: Ref<boolean>;
  importLimit: Ref<number>;
  showImport: Ref<boolean>;
  currentDialogGeneration: () => number;
  currentWriteScopeGeneration: () => number;
  beginBridgeIntent: () => number;
  currentBridgeGeneration: () => number;
  write: (path: string, body: unknown) => Promise<any>;
  load: () => Promise<void>;
  message: Ref<string>;
}

export function useOpportunityWorkspaceErpImport(options: OpportunityWorkspaceErpImportOptions) {
  const {
    route,
    opportunityId,
    busy,
    bridgeBusy,
    importLimit,
    showImport,
    currentDialogGeneration,
    currentWriteScopeGeneration,
    beginBridgeIntent,
    currentBridgeGeneration,
    write,
    load,
    message,
  } = options;

  function browserBridge<T>(action: string, payload: Record<string, unknown>) {
    return new Promise<T>((resolve, reject) => {
      const request_id = crypto.randomUUID();
      const timeout = window.setTimeout(() => {
        window.removeEventListener("message", receive);
        reject(new Error("browser_helper_unavailable"));
      }, 120000);
      function receive(event: MessageEvent) {
        if (
          event.source !== window ||
          event.data?.type !== "SCOUTOPS_BROWSER_BRIDGE_RESULT" ||
          event.data?.request_id !== request_id
        )
          return;
        window.clearTimeout(timeout);
        window.removeEventListener("message", receive);
        if (!event.data.ok) reject(new Error(String(event.data.error || "browser_helper_failed")));
        else resolve(event.data.data as T);
      }
      window.addEventListener("message", receive);
      window.postMessage(
        {
          type: "SCOUTOPS_BROWSER_BRIDGE_REQUEST",
          request_id,
          action,
          payload,
        },
        location.origin,
      );
    });
  }

  async function persistErpProducts(
    data: {
      items: unknown[];
      source_url: string;
      captured_at: string;
      total?: number;
    },
    ownsIntent: () => boolean,
    ownsPage: () => boolean,
  ) {
    const result = await write("/imports/erp-products", data);
    if (!result) return;
    if (ownsIntent()) showImport.value = false;
    if (!ownsPage()) return;
    await load();
    if (!ownsPage()) return;
    message.value =
      `ERP 已读取 ${result.received_count} 条：新增 ${result.opportunity_count} 个机会、` +
      `${result.competitor_count} 个亚马逊待采集竞品、` +
      `${result.sourcing_search_count} 个货源匹配任务；原始记录已保存为证据。`;
  }

  async function importFromErpBrowser() {
    if (busy.value || bridgeBusy.value) return;
    const bridgeGeneration = beginBridgeIntent();
    const ownership = captureErpImportOwnership();
    const ownsBridge = () => bridgeGeneration === currentBridgeGeneration() && ownership.ownsPage();
    bridgeBusy.value = true;
    message.value = "正在从已登录的 ERP 商品列表读取数据…";
    try {
      const data = await browserBridge<{
        items: unknown[];
        source_url: string;
        captured_at: string;
        total: number;
      }>("erp.products.read", { limit: Number(importLimit.value) });
      if (!ownsBridge() || !ownership.ownsIntent()) return;
      await persistErpProducts(data, ownership.ownsIntent, ownership.ownsPage);
    } catch (error) {
      if (!ownsBridge() || !ownership.ownsIntent()) return;
      const code = error instanceof Error ? error.message : "";
      message.value =
        code === "erp_login_page_opened"
          ? "已打开 ERP 登录页。登录完成并进入商品列表后，再点击“从当前浏览器读取”。"
          : code === "erp_login_required"
            ? "ERP 登录状态无效，请在 ERP 页面重新登录。"
            : "未检测到浏览器助手或 ERP 权限未授予。请先下载并加载浏览器助手。";
    } finally {
      if (bridgeGeneration === currentBridgeGeneration()) bridgeBusy.value = false;
    }
  }

  async function importErpFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const ownership = captureErpImportOwnership();
    try {
      const parsed = JSON.parse(await file.text());
      if (!ownership.ownsIntent()) return;
      const items = Array.isArray(parsed) ? parsed : parsed?.list;
      await persistErpProducts(
        {
          items,
          source_url: "https://medou.medouai.com/#/ProductList",
          captured_at: new Date().toISOString(),
        },
        ownership.ownsIntent,
        ownership.ownsPage,
      );
    } catch {
      if (ownership.ownsIntent())
        message.value = "ERP JSON 文件格式无效；应为接口返回的 list 数组或商品数组。";
    }
  }

  function captureErpImportOwnership() {
    const dialogGeneration = currentDialogGeneration();
    const scopeGeneration = currentWriteScopeGeneration();
    const routePath = route.fullPath;
    const ownsPage = () =>
      scopeGeneration === currentWriteScopeGeneration() &&
      route.fullPath === routePath &&
      route.path === "/opportunities" &&
      !opportunityId();
    const ownsIntent = () =>
      ownsPage() && showImport.value && dialogGeneration === currentDialogGeneration();
    return { ownsIntent, ownsPage };
  }

  return { importFromErpBrowser, importErpFile };
}
