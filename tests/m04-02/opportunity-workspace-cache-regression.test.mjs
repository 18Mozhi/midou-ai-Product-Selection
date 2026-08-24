import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("cached opportunity surfaces do not reload the hidden list and refresh task state before leaving", async () => {
  const source = await readFile("apps/web/src/components/OpportunityWorkspace.vue", "utf8");

  assert.match(source, /if \(props\.opportunityId \|\| route\.path !== "\/opportunities"\) return;/);
  assert.match(
    source,
    /evidence-completion-tasks[\s\S]*await load\(\);[\s\S]*await router\.push\(\{ path: `\/tasks\//,
  );
});
