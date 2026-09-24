import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const panel = await readFile("apps/web/src/components/PlatformAccountCenter.vue", "utf8");
const workspace = await readFile(
  "apps/web/src/components/PlatformAccountDirectoryWorkspace.vue",
  "utf8",
);
const accountSurface = `${panel}\n${workspace}`;
const styles = await readFile("apps/web/src/components/PlatformAccountCenter.css", "utf8");

test("P39 production account center opts into the scoped C composition", () => {
  assert.match(panel, /class="account-center account-center--review"/);
});

test("P39 keeps the account facts, tabs, filters and records on the real page", () => {
  assert.match(accountSurface, /class="account-metrics"/);
  assert.match(accountSurface, /账号与组织二级导航/);
  assert.match(accountSurface, /class="account-filter"/);
  assert.match(
    accountSurface,
    /<label v-else class="account-query-field">\s*<span>\{\{ props\.searchPlaceholder \}\}<\/span>/,
  );
  assert.doesNotMatch(accountSurface, /:aria-label="props\.searchPlaceholder"/);
  assert.match(accountSurface, /PlatformOrganizationRecords/);
  assert.match(accountSurface, /PlatformUserRecords/);
  assert.match(accountSurface, /PlatformAdminRecords/);
});

test("P39 C composition has desktop rail, responsive collapse and focus treatment", () => {
  assert.match(styles, /\.account-center--review \.account-hero/);
  assert.match(styles, /grid-template-columns: minmax\(0, 1fr\) minmax\(330px, 0\.7fr\)/);
  assert.match(styles, /@media \(max-width: 940px\)/);
  assert.match(styles, /@media \(max-width: 700px\)/);
  assert.match(
    styles,
    /\.account-center--review \.account-query-field\s*\{[\s\S]*?font-size: 16px;/,
  );
  assert.match(
    styles,
    /\.account-center--review :is\(a, button, input, select, textarea\):focus-visible/,
  );
});
