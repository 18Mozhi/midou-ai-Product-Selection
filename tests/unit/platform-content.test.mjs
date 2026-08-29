import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PlatformDashboardService } from "../../apps/api/dist/platform-dashboard-service.js";

test("platform content validates read states and pagination before repository access", async () => {
  const calls = [];
  const service = new PlatformDashboardService({
    readManagement: async (input) => (calls.push(input), { items: [] }),
  });
  await service.management({
    actorId: "actor",
    domain: "content",
    query: "跨境",
    status: "archived",
    page: "2",
    pageSize: "20",
    requestId: "request",
    traceId: "trace",
  });
  assert.equal(calls[0].domain, "content");
  assert.equal(calls[0].status, "archived");
  assert.equal(calls[0].page, 2);
  assert.equal(calls[0].pageSize, 20);

  assert.throws(
    () =>
      service.management({
        actorId: "actor",
        domain: "content",
        status: "unknown",
        requestId: "request",
        traceId: "trace",
      }),
    (error) => error.code === "platform_content_status_invalid" && error.statusCode === 400,
  );
  assert.throws(
    () =>
      service.management({
        actorId: "actor",
        domain: "content",
        page: 0,
        requestId: "request",
        traceId: "trace",
      }),
    (error) => error.code === "platform_content_pagination_invalid" && error.statusCode === 400,
  );
});

test("platform content preserves factual states, server pagination and safe multilingual search", async () => {
  const [repository, routes, listLoader, filter, records, presentation] = await Promise.all(
    [
      "apps/api/src/mysql-platform-dashboard-repository.ts",
      "apps/api/src/platform-dashboard-routes.ts",
      "apps/web/src/components/use-platform-content-list.ts",
      "apps/web/src/components/PlatformManagementFilter.vue",
      "apps/web/src/components/PlatformManagementRecordList.vue",
      "apps/web/src/components/platform-management-presentation.ts",
    ].map((path) => readFile(path, "utf8")),
  );
  assert.match(repository, /CONVERT\(t\.market USING utf8mb4\) COLLATE utf8mb4_unicode_ci LIKE \?/);
  assert.match(repository, /LIMIT \? OFFSET \?/);
  assert.match(repository, /pagination:/);
  assert.match(repository, /SUM\(t\.status='archived'\) archived/);
  assert.match(routes, /request_body_required/);
  assert.match(listLoader, /AbortController/);
  assert.match(listLoader, /15000/);
  assert.match(listLoader, /page_size/);
  assert.match(listLoader, /history\.replaceState/);
  assert.match(filter, /value="archived">已归档/);
  assert.match(filter, /重置/);
  assert.match(records, /置信度 \/ 最近观测/);
  assert.match(records, /item\.status === 'active'/);
  assert.match(presentation, /archived: "已归档"/);
});
