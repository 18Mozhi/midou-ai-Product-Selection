import test from "node:test";
import assert from "node:assert/strict";
import { summarizeCoverage } from "../../packages/collection-tasks/dist/index.js";

const outcome = (status, errorCode = null) => ({
  required: true,
  status,
  errorCode,
  availableResultCount: 0,
  missingFields: [],
});
test("an empty successful read is distinct from a blocked or failed source", () => {
  assert.equal(summarizeCoverage([outcome("succeeded_empty")]).terminalStatus, "succeeded_empty");
  for (const [status, code] of [
    ["blocked", "source_circuit_open"],
    ["blocked", "robots_disallowed"],
    ["failed", "parse_failed"],
  ]) {
    const summary = summarizeCoverage([outcome(status, code)]);
    assert.equal(summary.terminalStatus, "completed_with_warnings");
    assert.equal(summary.coverageStatus, "insufficient");
    assert.equal(summary.successfulSubqueryCount, 0);
    assert.equal(summary.availableResultCount, 0);
  }
});
test("a successful empty source does not hide a second source failure", () => {
  const summary = summarizeCoverage([
    outcome("succeeded_empty"),
    outcome("blocked", "source_circuit_open"),
  ]);
  assert.equal(summary.terminalStatus, "completed_with_warnings");
  assert.equal(summary.successfulSubqueryCount, 1);
  assert.equal(summary.blockedSubqueryCount, 1);
});
