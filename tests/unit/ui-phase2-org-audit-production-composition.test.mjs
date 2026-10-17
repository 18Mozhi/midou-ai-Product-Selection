import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const parent = await readFile("apps/web/src/components/OrganizationAdminCenter.vue", "utf8");
const panel = await readFile("apps/web/src/components/OrganizationAuditPanel.vue", "utf8");
const styles = await readFile("apps/web/src/organization-audit.css", "utf8");

test("P37 production route owns an explicit C scope", () => {
  assert.match(parent, /org-admin-center--audit-review': view === 'audit'/);
});

test("audit workspace puts loaded facts before filters and ledger", () => {
  const filters = panel.indexOf('class="org-audit-filters"');
  const metrics = panel.indexOf('class="org-audit-metrics"');
  const ledger = panel.indexOf('class="org-audit-ledger"');

  assert.ok(filters >= 0, "audit filters are present");
  assert.ok(metrics >= 0 && metrics < filters, "loaded counts precede query controls");
  assert.ok(ledger > filters, "ledger follows query controls");
});

test("audit workspace keeps detail, copy and responsive boundaries scoped", () => {
  assert.match(styles, /#app \.org-admin-center \.org-audit-panel/);
  assert.match(styles, /\.org-audit-correlation button/);
  assert.match(styles, /@container \(max-width:\s*540px\)/);
  assert.match(panel, /copy\(selectedEvent\.request_id, 'request'\)/);
  assert.match(panel, /copy\(selectedEvent\.trace_id, 'trace'\)/);
});
