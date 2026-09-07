import assert from "node:assert/strict";

// Local design prototypes only; this does not attest to production accessibility.
export async function checkPrototypeMetrics(page) {
  const metrics = await page.evaluate(() => {
    const scope = document.querySelector("dialog[open]") || document.body;
    const visible = (node) => {
      const style = getComputedStyle(node);
      return node.getClientRects().length && style.visibility !== "hidden";
    };
    const controls = [...scope.querySelectorAll("button,input,select,textarea")]
      .filter(visible)
      .filter((node) => !["checkbox", "hidden"].includes(node.type))
      .map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          name: node.id || node.getAttribute("name") || node.textContent.trim().slice(0, 40),
          fontSize: Number.parseFloat(getComputedStyle(node).fontSize),
          width: rect.width,
          height: rect.height,
        };
      });
    const text = [...scope.querySelectorAll("*")]
      .filter(visible)
      .filter((node) => !["SCRIPT", "STYLE", "OPTION"].includes(node.tagName))
      .filter((node) =>
        [...node.childNodes].some((child) => child.nodeType === 3 && child.textContent.trim()),
      )
      .map((node) => ({
        text: node.textContent.trim().slice(0, 40),
        fontSize: Number.parseFloat(getComputedStyle(node).fontSize),
      }));
    return {
      controlsChecked: controls.length,
      textNodesChecked: text.length,
      minControlFont: Math.min(...controls.map((node) => node.fontSize)),
      minTextFont: Math.min(...text.map((node) => node.fontSize)),
      violations: [
        ...controls.filter((node) => node.fontSize < 16 || node.width < 43.9 || node.height < 43.9),
        ...text.filter((node) => node.fontSize < 13),
      ],
    };
  });
  assert.ok(metrics.controlsChecked > 0 && metrics.textNodesChecked > 0);
  assert.deepEqual(metrics.violations, [], "Prototype font/touch-size contract");
  return metrics;
}
