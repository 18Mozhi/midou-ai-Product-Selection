import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("cached opportunity surfaces do not reload the hidden list or create retired manual tasks", async () => {
  const [source, lifecycle] = await Promise.all([
    readFile("apps/web/src/components/OpportunityWorkspace.vue", "utf8"),
    readFile("apps/web/src/components/use-opportunity-workspace-lifecycle.ts", "utf8"),
  ]);

  assert.match(
    lifecycle,
    /if \(opportunityId\(\) \|\| route\.path !== "\/opportunities"\) return;/,
  );
  assert.doesNotMatch(source, /createEvidenceTask|evidence-completion-tasks/);
});
