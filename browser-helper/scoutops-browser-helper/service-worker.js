const ERP_PAGE_ORIGIN = "https://medou.medouai.com";
const ERP_API_ORIGIN = "https://medo2.mozhiz.cn";
const BRIDGE_ORIGINS = new Set([
  "https://midouai.medouai.com",
  "http://127.0.0.1:5173",
  "http://localhost:5173",
]);

const reply = (data) => ({ ok: true, data });
const fail = (error) => ({ ok: false, error });

async function permit(origins) {
  const granted = await chrome.permissions.request({ origins });
  if (!granted) throw new Error("browser_permission_denied");
}

async function readCookies(payload) {
  let target;
  try {
    target = new URL(String(payload?.target_url || ""));
  } catch {
    throw new Error("browser_target_invalid");
  }
  if (target.protocol !== "https:") throw new Error("browser_target_invalid");
  await permit([`${target.origin}/*`]);
  const cookies = await chrome.cookies.getAll({ url: target.origin });
  return {
    origin: target.origin,
    cookies: cookies.map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      expirationDate: cookie.expirationDate,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
    })),
  };
}

async function readErpToken(tabId) {
  const result = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: () => localStorage.getItem("token"),
  });
  const token = result?.[0]?.result;
  if (typeof token !== "string" || !token.trim())
    throw new Error("erp_login_required");
  return token;
}

async function readErpProducts(payload) {
  await permit([`${ERP_PAGE_ORIGIN}/*`, `${ERP_API_ORIGIN}/*`]);
  const tabs = await chrome.tabs.query({ url: `${ERP_PAGE_ORIGIN}/*` });
  const tab = tabs.find((item) => item.id != null);
  if (!tab?.id) {
    await chrome.tabs.create({ url: `${ERP_PAGE_ORIGIN}/#/ProductList`, active: true });
    throw new Error("erp_login_page_opened");
  }
  const token = await readErpToken(tab.id);
  const maximum = Math.min(500, Math.max(1, Number(payload?.limit || 200)));
  const items = [];
  let page = 1;
  let total = maximum;
  while (items.length < Math.min(maximum, total)) {
    const response = await fetch(
      `${ERP_API_ORIGIN}/store/product/getSheinProductList`,
      {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: token },
        body: JSON.stringify({
          page,
          pageSize: Math.min(200, maximum - items.length),
          shelf_status: 1,
        }),
      },
    );
    if (!response.ok) throw new Error(`erp_request_${response.status}`);
    const body = await response.json();
    const batch = Array.isArray(body?.list) ? body.list : [];
    total = Number.isFinite(Number(body?.total)) ? Number(body.total) : batch.length;
    items.push(...batch);
    if (!batch.length) break;
    page += 1;
  }
  return {
    items: items.slice(0, maximum),
    total,
    source_url: `${ERP_PAGE_ORIGIN}/#/ProductList`,
    captured_at: new Date().toISOString(),
  };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request?.type !== "SCOUTOPS_BROWSER_BRIDGE_REQUEST") return false;
  let senderOrigin = "";
  try {
    senderOrigin = new URL(String(sender.url || "")).origin;
  } catch {}
  if (!BRIDGE_ORIGINS.has(senderOrigin)) {
    sendResponse(fail("browser_bridge_origin_forbidden"));
    return false;
  }
  const operation =
    request.action === "cookies.read"
      ? readCookies(request.payload)
      : request.action === "erp.products.read"
        ? readErpProducts(request.payload)
        : Promise.reject(new Error("browser_action_unsupported"));
  operation
    .then((data) => sendResponse(reply(data)))
    .catch((error) => sendResponse(fail(error?.message || "browser_helper_failed")));
  return true;
});
