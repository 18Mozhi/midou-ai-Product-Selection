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
