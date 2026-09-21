import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { readFeedbackVueDriver } from "./ui-phase2-org-approvals-read-feedback-driver.mjs";

export const loadingOutput = "output/playwright/p34-loading-vue-c-r2";
export function loadingVueDriver(input) {
  assert.equal(
    createHash("sha256")
      .update(
        readFileSync(
          "scripts/lib/ui-phase2-org-approvals-read-feedback-driver.mjs",
          "utf8",
        ).replaceAll("\r\n", "\n"),
      )
      .digest("hex"),
    "bcce5abad35bc3ff5e92b37788893a580bd9955c9b949d0f19cdbeb52009a956",
  );
  let source = readFeedbackVueDriver(input);
  const replace = (before, after) => {
    assert.equal(source.split(before).length, 2, `One loading driver anchor: ${before}`);
    source = source.replace(before, after);
  };
  replace(
    'const output = "output/playwright/p34-read-feedback-vue-c-r1";',
    `const output = "${loadingOutput}";`,
  );
  replace(
    "previewApprovalsReadFeedback(previewApprovalsExpired(previewApprovalsPermission(previewApprovalsParentFrame(sourceOriginals.get(approvalsParentFile)))))",
    "previewApprovalsLoading(previewApprovalsReadFeedback(previewApprovalsExpired(previewApprovalsPermission(previewApprovalsParentFrame(sourceOriginals.get(approvalsParentFile))))))",
  );
  replace(
    "const currentSources = new Set([...sources,",
    `const currentSources = new Set([...sources,
  "scripts/lib/ui-phase2-org-approvals-loading-preview.mjs",
  "scripts/lib/ui-phase2-org-approvals-loading-driver.mjs",
  "scripts/verify-ui-phase2-org-approvals-loading-vue.mjs", approvalsLoadingCss,`,
  );
  replace('kind: "P34-READ-FEEDBACK-VUE-C-r1",', 'kind: "P34-LOADING-VUE-C-r2",');
  replace(
    "approvalsExpiredCss, approvalsReadFeedbackCss].map",
    "approvalsExpiredCss, approvalsReadFeedbackCss, approvalsLoadingCss].map",
  );
  replace(
    '      await shot("initial-loading");',
    `      const loading = center.locator(".org-approval-loading-c");
      check("initial C loading region is status", await loading.getAttribute("role"), "status");
      check("initial C loading retains original message", await loading.locator("h3").textContent(), "正在读取当前组织数据…");
      check("loading heading uses explicit C typography", await loading.locator("h3").evaluate(n => {const s=getComputedStyle(n);return {family:s.fontFamily,weight:s.fontWeight};}), {family:'"Microsoft YaHei", sans-serif',weight:"700"});
      check("initial C loading announces busy parent", await center.getAttribute("aria-busy"), "true");
      check("loading placeholders hidden from assistive technology", await loading.locator(".org-approval-loading-placeholder").getAttribute("aria-hidden"), "true");
      check("loading placeholder count is decorative", await loading.locator("i").count(), 3);
      check("loading has no fake numeric progress or controls", await loading.locator("button,a,input,[role=progressbar],[aria-valuenow]").count(), 0);
      const loadingStyle = () => loading.evaluate(n => { const s=getComputedStyle(n);return {minHeight:s.minHeight,background:s.backgroundColor,columns:s.gridTemplateColumns.split(" ").length}; });
      check("loading uses compact white C panel", await loadingStyle(), {minHeight:"0px",background:"rgb(255, 255, 255)",columns:width<=760?1:2});
      const placeholderMotion = () => loading.locator("i").evaluateAll(nodes => nodes.every(n=>getComputedStyle(n).animationName==="none"&&getComputedStyle(n).transitionDuration==="0s"));
      check("reduced motion loading remains static", await placeholderMotion());
      await shot("initial-loading");
      await page.emulateMedia({reducedMotion:"no-preference"});
      check("normal motion loading also remains static", await placeholderMotion());
      await shot("initial-loading-motion-allowed");
      await page.emulateMedia({reducedMotion:"reduce"});
      const initialReadCount=reads.length;
      await center.getByRole("button",{name:"刷新数据",exact:true}).evaluate(n=>n.click());
      check("native disabled initial refresh cannot duplicate reads", reads.length,initialReadCount);`,
  );
  replace(
    '      await shot("background-refreshing");',
    `      check("background refresh never installs first-load placeholder", await center.locator(".org-approval-loading-c").count(), 0);
      check("background refresh exposes original busy state", await center.getAttribute("aria-busy"), "true");
      check("background refresh keeps original status text", await center.locator(".org-admin-refresh small").textContent(), "正在刷新当前组织数据…");
      const backgroundReadCount=reads.length;
      await center.getByRole("button",{name:"正在刷新…",exact:true}).evaluate(n=>n.click());
      check("native disabled background refresh cannot duplicate reads", reads.length,backgroundReadCount);
      await shot("background-refreshing");`,
  );
  replace(
    '      await shot("refresh-success");',
    `      check("successful read removes loading placeholder", await center.locator(".org-approval-loading-c").count(), 0);
      check("successful read clears parent busy state", await center.getAttribute("aria-busy"), "false");
      await shot("refresh-success");`,
  );
  const url = pathToFileURL(
    path.resolve("scripts/lib/ui-phase2-org-approvals-loading-preview.mjs"),
  ).href;
  return (
    `import { approvalsLoadingCss, previewApprovalsLoading } from ${JSON.stringify(url)};\n` +
    source
  );
}
