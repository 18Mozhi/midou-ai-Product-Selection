import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { expiredVueDriver } from "./ui-phase2-org-approvals-expired-driver.mjs";

export const readFeedbackOutput = "output/playwright/p34-read-feedback-vue-c-r1";
export function readFeedbackVueDriver(input) {
  assert.equal(
    createHash("sha256")
      .update(
        readFileSync("scripts/lib/ui-phase2-org-approvals-expired-driver.mjs", "utf8").replaceAll(
          "\r\n",
          "\n",
        ),
      )
      .digest("hex"),
    "65c4174ec438d60a551d3d37e3bd8110782ff54bef3c101bd4b7fa5fd742de6b",
  );
  let source = expiredVueDriver(input);
  const replace = (before, after) => {
    assert.equal(source.split(before).length, 2, `One read-feedback driver anchor: ${before}`);
    source = source.replace(before, after);
  };
  replace(
    'const output = "output/playwright/p34-expired-vue-c-r1";',
    `const output = "${readFeedbackOutput}";`,
  );
  replace(
    "previewApprovalsExpired(previewApprovalsPermission(previewApprovalsParentFrame(sourceOriginals.get(approvalsParentFile))))",
    "previewApprovalsReadFeedback(previewApprovalsExpired(previewApprovalsPermission(previewApprovalsParentFrame(sourceOriginals.get(approvalsParentFile)))))",
  );
  replace(
    "const currentSources = new Set([...sources,",
    `const currentSources = new Set([...sources,
  "scripts/lib/ui-phase2-org-approvals-read-feedback-preview.mjs",
  "scripts/lib/ui-phase2-org-approvals-read-feedback-driver.mjs",
  "scripts/verify-ui-phase2-org-approvals-read-feedback-vue.mjs", approvalsReadFeedbackCss,`,
  );
  replace('kind: "P34-EXPIRED-VUE-C-r1",', 'kind: "P34-READ-FEEDBACK-VUE-C-r1",');
  replace(
    "approvalsPermissionCss, approvalsExpiredCss].map",
    "approvalsPermissionCss, approvalsExpiredCss, approvalsReadFeedbackCss].map",
  );
  replace("[401, 403].includes(f.status)", "[500, 503, 409, 429, 0].includes(f.status)");
  replace(
    "            await shot(name);",
    `            const remainingFeedback = ![401,403].includes(failure.status) && (phase === "background" || [503,409,0].includes(failure.status));
            await shot(name);
            if (remainingFeedback) {
              const feedback = center.locator(".org-approval-read-feedback-c"), trace = feedback.locator("details");
              const readCount = reads.length;
              check(name + ": one read feedback region", await feedback.count(), 1);
              check(name + ": retained marker matches original state", await feedback.getAttribute("data-retained"), String(!replace));
              check(name + ": feedback title distinguishes retained data", await feedback.locator("h3").textContent(), !replace ? "审批内容未能更新" : failure.status === 409 ? "数据版本已变化" : "组织数据暂不可用");
              check(name + ": content boundary matches visibility", await feedback.locator(".org-approval-permission-boundary").textContent(), !replace ? "仍显示上次成功读取的内容，本次更新尚未完成。" : "审批内容目前未显示，不代表记录或模板为空。");
              check(name + ": no duplicate legacy state visible", await center.locator(".org-admin-state:visible").count(), 0);
              check(name + ": original action inventory", await center.getByRole("button", { name: "重新加载", exact: true }).count(), replace ? 1 : 0);
              check(name + ": read trace starts closed", await trace.getAttribute("open"), null);
              await trace.locator("summary").focus();
              await page.keyboard.press("Enter");
              check(name + ": read trace opens natively", await trace.getAttribute("open"), "");
              const originalError = failure.status === 0 ? "网络连接暂不可用。 请检查网络后重试；系统已完成安全的读取重试。" : failure.status === 409 ? "数据已被其他操作更新，请先刷新并确认最新内容。 检查服务或权限后重新加载。" : "隔离" + failure.id + "读取失败 检查服务或权限后重新加载。";
              check(name + ": original failure detail retained", await trace.locator("p").textContent(), originalError);
              check(name + ": original failure trace retained", await trace.locator("code").textContent(), failure.status === 0 ? failedReads[0].requestId : "p34-" + failure.id + "-" + target);
              await shot(name + "-details");
              await page.keyboard.press(replace ? "Tab" : "Shift+Tab");
              const recovery = center.getByRole("button", { name: replace ? "重新加载" : "刷新数据", exact:true });
              check(name + ": native keyboard reaches original recovery", await recovery.evaluate(n => n === document.activeElement && n.matches(":focus-visible")));
              check(name + ": recovery visible and unobscured", await recovery.evaluate(n => {
                const r = n.getBoundingClientRect(), hit = document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
                return r.top >= 0 && r.bottom <= innerHeight && (hit === n || n.contains(hit));
              }));
              check(name + ": disclosure performs no reads", reads.length, readCount);
              await shot(name + "-reload-focus");
            }`,
  );
  replace(
    '            if ([401, 403].includes(failure.status)) await page.keyboard.press("Enter");',
    '            if ([401, 403].includes(failure.status) || remainingFeedback) await page.keyboard.press("Enter");',
  );
  const url = pathToFileURL(
    path.resolve("scripts/lib/ui-phase2-org-approvals-read-feedback-preview.mjs"),
  ).href;
  return (
    `import { approvalsReadFeedbackCss, previewApprovalsReadFeedback } from ${JSON.stringify(url)};\n` +
    source
  );
}
