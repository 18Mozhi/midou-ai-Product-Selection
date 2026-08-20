import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("responsive data view keeps desktop tables and moves mobile details into a named drawer", async () => {
  const [view, collection, runtime, tasks, quality, management, notifications] = await Promise.all(
    [
      "apps/web/src/components/ResponsiveDataView.vue",
      "apps/web/src/components/CollectionOperationsConsole.vue",
      "apps/web/src/components/CollectionRuntimeCenter.vue",
      "apps/web/src/components/CollectionTaskCenter.vue",
      "apps/web/src/components/DataQualityCenter.vue",
      "apps/web/src/components/PlatformManagementRecordList.vue",
      "apps/web/src/components/PlatformNotificationOperations.vue",
    ].map((path) => readFile(path, "utf8")),
  );

  assert.match(view, /aria-haspopup="dialog"/);
  assert.match(view, /role="dialog"/);
  assert.match(view, /aria-modal="true"/);
  assert.match(view, /@keydown\.esc="close"/);
  assert.match(view, /:close="close"/);
  assert.match(view, /emptyMessage \|\| "暂无记录"/);
  assert.match(view, /max-width: 760px/);
  assert.match(view, /var\(--so-touch-target\)/);
  assert.doesNotMatch(view, /!important|#[0-9a-f]{3,8}\b/i);
  assert.equal((collection.match(/<ResponsiveDataView/g) ?? []).length, 2);
  assert.match(collection, /第 \{\{ a\.attempt_number \}\} 次尝试/);
  assert.match(collection, /<summary>技术详情<\/summary>[\s\S]*任务 \{\{ a\.task_id \}\}/);
  assert.doesNotMatch(collection, /organization_id\.slice/);
  assert.equal((runtime.match(/<ResponsiveDataView/g) ?? []).length, 1);
  assert.equal((tasks.match(/<ResponsiveDataView/g) ?? []).length, 1);
  assert.equal((quality.match(/<ResponsiveDataView/g) ?? []).length, 2);
  for (const component of [runtime, tasks, quality]) {
    assert.match(component, /<summary>技术详情<\/summary>/);
    assert.doesNotMatch(component, /organization_id\.slice/);
  }
  assert.equal((management.match(/<ResponsiveDataView/g) ?? []).length, 2);
  assert.equal((notifications.match(/<ResponsiveDataView/g) ?? []).length, 1);
  for (const component of [management, notifications]) {
    assert.match(component, /<summary>技术详情<\/summary>/);
    assert.doesNotMatch(component, /min-width:\s*760px/);
  }
});
