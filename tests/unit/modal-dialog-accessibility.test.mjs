import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("native business dialogs share modal top-layer and focus-return behavior", async () => {
  const componentPaths = (await readdir("apps/web/src/components", { recursive: true }))
    .filter((path) => path.endsWith(".vue"))
    .map((path) => `apps/web/src/components/${path.replaceAll("\\", "/")}`);
  const dialogSources = [];

  for (const path of componentPaths) {
    const source = await readFile(path, "utf8");
    if (!/<dialog[\s>]/.test(source)) continue;
    dialogSources.push({ path, source });
  }

  assert.ok(dialogSources.length >= 10);
  for (const { path, source } of dialogSources) {
    assert.doesNotMatch(source, /<dialog[^>]*\s:open=/, path);
    assert.match(source, /useModalDialog/, path);
    assert.match(source, /<dialog[^>]*\sref=/, path);
    assert.match(source, /<dialog[^>]*\s:?(?:aria-label|aria-labelledby)=/, path);
    assert.match(source, /<dialog[^>]*@cancel=/, path);
  }

  const modal = await readFile("apps/web/src/use-modal-dialog.ts", "utf8");
  assert.match(modal, /showModal\(\)/);
  assert.match(modal, /returnFocus\?\.focus\(\)/);
  assert.match(modal, /event\.preventDefault\(\)/);

  const opaqueDialogStyles = await Promise.all(
    [
      "apps/web/src/approval-workspace.css",
      "apps/web/src/automation-rules.css",
      "apps/web/src/notification-center.css",
      "apps/web/src/task-workspace.css",
      "apps/web/src/components/CommercialOperationsCenter.vue",
      "apps/web/src/components/PlatformAccountDialogs.css",
      "apps/web/src/components/PlatformManagementCenter.vue",
      "apps/web/src/components/platform-message-editor.css",
    ].map((path) => readFile(path, "utf8")),
  );
  for (const source of opaqueDialogStyles)
    assert.match(source, /dialog(?:\[open\])?\s*\{[^}]*background:\s*var\(--so-bg-elevated\)/s);
});

test("custom confirmation and mobile filter surfaces trap and restore focus", async () => {
  const [confirmation, drawer] = await Promise.all(
    [
      "apps/web/src/components/ConfirmDialog.vue",
      "apps/web/src/components/ResponsiveFilterDrawer.vue",
    ].map((path) => readFile(path, "utf8")),
  );

  assert.match(confirmation, /returnFocus\?\.focus\(\)/);
  assert.match(confirmation, /event\.key !== "Tab"/);
  assert.match(drawer, /triggerButton\.value\?\.focus\(\)/);
  assert.match(drawer, /event\.key !== "Tab"/);
  assert.match(drawer, /aria-modal/);
});
