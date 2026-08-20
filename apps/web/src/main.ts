import { createApp, h } from "vue";
import { RouterView } from "vue-router";
import "./styles.css";
import "./design/tokens.css";
import "./accessibility.css";
import { applyCachedTheme } from "./design/theme";
import { router } from "./router";

applyCachedTheme();
createApp({ render: () => h(RouterView) })
  .use(router)
  .mount("#app");

function syncIconTooltips(root: ParentNode) {
  const elements = [
    ...(root instanceof HTMLElement && root.matches("button[aria-label],a[aria-label]")
      ? [root]
      : []),
    ...root.querySelectorAll<HTMLElement>("button[aria-label],a[aria-label]"),
  ];
  elements.forEach((element) => {
    const label = element.getAttribute("aria-label")?.trim();
    if (label && !element.hasAttribute("title")) element.title = label;
  });
}

syncIconTooltips(document);
new MutationObserver((records) => {
  for (const record of records) {
    if (record.type === "attributes") {
      const target = record.target as HTMLElement;
      if (target.matches?.("button[aria-label],a[aria-label]"))
        syncIconTooltips(target.parentNode ?? document);
      continue;
    }
    for (const node of record.addedNodes) if (node instanceof HTMLElement) syncIconTooltips(node);
  }
}).observe(document.body, {
  subtree: true,
  childList: true,
  attributes: true,
  attributeFilter: ["aria-label"],
});

document.addEventListener("click", (event) => {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  const target =
    event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
  if (!target || target.target || target.hasAttribute("download")) return;
  const rawHref = target.getAttribute("href") ?? "";
  if (!rawHref || rawHref.startsWith("#")) return;
  const destination = new URL(target.href, window.location.href);
  if (destination.origin !== window.location.origin) return;
  event.preventDefault();
  void router.push(`${destination.pathname}${destination.search}${destination.hash}`);
});
