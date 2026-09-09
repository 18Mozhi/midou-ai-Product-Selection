import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";

// A real mounted control, not injected :hover/:active classes or simulated busy attributes.
export function journeyControlCapture({
  page,
  width,
  root,
  capture,
  screenshots,
  checks,
  requests,
}) {
  const records = [];
  const snapshot = () =>
    page.evaluate(() => ({
      url: location.href,
      activeId: localStorage.getItem("scoutops.selection-journey.active-id"),
      fields: [
        ...document.querySelectorAll(".selection-journey input,.selection-journey textarea"),
      ].map((node) => [node.name, node.value, node.checked ?? null]),
      timeline: document.querySelector(".selection-timeline-disclosure")?.open ?? null,
      state: document.querySelector(".selection-status")?.getAttribute("data-state") ?? null,
    }));
  async function take(
    key,
    actionId,
    selector,
    states = ["default", "hover", "focus", "pressed"],
    busyLabel = "",
  ) {
    const control = page.locator(selector);
    assert.equal(await control.count(), 1, `${key}: unique control`);
    for (const state of states) {
      const before = await snapshot(),
        traffic = requests.length;
      await control.evaluate((node) => {
        node.blur();
        node.scrollIntoView({ block: "center", inline: "nearest" });
      });
      await page.mouse.move(0, 0);
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
      let down = false;
      try {
        if (state === "hover" || state === "pressed") await control.hover();
        if (state === "focus") {
          await control.focus();
          await page.keyboard.press("Tab");
          await page.keyboard.press("Shift+Tab");
        }
        if (state === "pressed") {
          await page.mouse.down();
          down = true;
        }
        const metrics = await control.evaluate((node, state) => {
          const r = node.getBoundingClientRect(),
            css = getComputedStyle(node),
            hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return {
            state,
            label: node.textContent.trim(),
            disabled: node.matches(":disabled"),
            hover: node.matches(":hover"),
            active: node.matches(":active"),
            focus: node.matches(":focus-visible"),
            outline: css.outlineStyle,
            controlWidth: r.width,
            controlHeight: r.height,
            fontSize: css.fontSize,
            color: css.color,
            background: css.backgroundColor,
            opacity: css.opacity,
            centerHit: node === hit || node.contains(hit),
            box: { x: r.x, y: r.y, right: r.right, bottom: r.bottom },
            hit: hit?.tagName + "." + hit?.className,
            viewport: { width: innerWidth, height: innerHeight },
          };
        }, state);
        assert.ok(
          metrics.controlWidth >= 44 && metrics.controlHeight >= 44,
          `${key}/${state} touch target`,
        );
        assert.ok(
          metrics.centerHit,
          `${width} ${key}/${state} center obscured: ${JSON.stringify(metrics)}`,
        );
        assert.ok(parseFloat(metrics.fontSize) >= 16, `${key}/${state} readable control text`);
        if (state === "hover") assert.ok(metrics.hover);
        if (state === "pressed") assert.ok(metrics.active && metrics.hover);
        if (state === "focus") assert.ok(metrics.focus && metrics.outline !== "none");
        if (state === "default") assert.ok(!metrics.active && !metrics.hover && !metrics.focus);
        if (state === "disabled" || state === "busy") assert.ok(metrics.disabled);
        else assert.ok(!metrics.disabled);
        if (state === "busy") {
          assert.ok(busyLabel);
          assert.equal(metrics.label, busyLabel);
        }
        const scene = `control-${key}-${state}`,
          file = `${width}-${scene}.png`;
        if (capture) {
          const bytes = await page.screenshot({ animations: "disabled" });
          await writeFile(path.join(root, file), bytes);
          screenshots.push({
            file,
            scene,
            width,
            captureType: "control-viewport",
            control: { key, actionId, selector, state },
            sha256: createHash("sha256").update(bytes).digest("hex"),
          });
        }
        records.push({ key, actionId, selector, width, ...metrics });
      } finally {
        // Release outside the target; capturing :active must never submit, reset, expand or navigate.
        if (down) {
          await page.mouse.move(0, 0);
          await page.mouse.up();
        }
      }
      assert.deepEqual(await snapshot(), before, `${key}/${state} capture mutated page intent`);
      assert.equal(requests.length, traffic, `${key}/${state} capture triggered HTTP`);
      checks.push({
        width,
        name: `${key}/${state}: native state, hit target and unchanged intent`,
      });
    }
  }
  return { take, records };
}
