const BRIDGE_MARKER = 'meta[name="scoutops-browser-bridge"][content="v1"]';

window.addEventListener("message", async (event) => {
  if (
    event.source !== window ||
    event.origin !== location.origin ||
    event.data?.type !== "SCOUTOPS_BROWSER_BRIDGE_REQUEST" ||
    !document.querySelector(BRIDGE_MARKER)
  )
    return;
  const request = event.data;
  try {
    const response = await chrome.runtime.sendMessage({
      type: "SCOUTOPS_BROWSER_BRIDGE_REQUEST",
      request_id: request.request_id,
      action: request.action,
      payload: request.payload,
    });
    window.postMessage(
      {
        type: "SCOUTOPS_BROWSER_BRIDGE_RESULT",
        request_id: request.request_id,
        ok: Boolean(response?.ok),
        data: response?.data,
        error: response?.error,
      },
      location.origin,
    );
  } catch {
    window.postMessage(
      {
        type: "SCOUTOPS_BROWSER_BRIDGE_RESULT",
        request_id: request.request_id,
        ok: false,
        error: "browser_helper_failed",
      },
      location.origin,
    );
  }
});
