import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const parent = await readFile("apps/web/src/components/OrganizationAdminCenter.vue", "utf8");
const panel = await readFile("apps/web/src/components/OrganizationAuditPanel.vue", "utf8");
const styles = await readFile("apps/web/src/organization-audit.css", "utf8");

test("P37 production route owns an explicit C scope", () => {
  assert.match(parent, /org-admin-center--audit-review': view === 'audit'/);
});

test("P37 keeps filters before loaded facts in the DOM flow", () => {
  const filters = panel.indexOf('class="org-audit-filters"');
  const metrics = panel.indexOf('class="org-audit-metrics"');
  const ledger = panel.indexOf('class="org-audit-ledger"');

  assert.ok(filters >= 0, "audit filters are present");
  assert.ok(metrics > filters, "loaded counts follow the query controls");
  assert.ok(ledger > metrics, "timeline follows loaded counts");
});

test("P37 C layout keeps detail, copy and mobile boundaries scoped", () => {
  assert.match(styles, /\.org-admin-center--audit-review \.org-audit-panel/);
  assert.match(styles, /\.org-admin-center--audit-review \.org-audit-correlation button/);
  assert.match(styles, /@media \(max-width: 620px\)/);
  assert.match(panel, /copy\(selectedEvent\.request_id, 'request'\)/);
  assert.match(panel, /copy\(selectedEvent\.trace_id, 'trace'\)/);
});
