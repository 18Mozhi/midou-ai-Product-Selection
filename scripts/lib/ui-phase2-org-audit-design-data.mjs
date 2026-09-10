import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { historicalAuditSource } from "./ui-phase2-audit-copy-baseline.mjs";
const plain = (v) => JSON.parse(JSON.stringify(v));
export async function buildOrgAuditDesignData(repo) {
  const read = (p) => readFile(path.join(repo, p), "utf8"),
    parse = (s) => ts.createSourceFile("source.ts", s, ts.ScriptTarget.Latest, true);
  function find(ast, predicate) {
    const out = [];
    function visit(n) {
      if (predicate(n)) out.push(n);
      ts.forEachChild(n, visit);
    }
    visit(ast);
    assert.equal(out.length, 1);
    return out[0];
  }
  const variable = (ast, name) =>
      find(
        ast,
        (n) => ts.isVariableDeclaration(n) && n.name.getText(ast) === name,
      ).initializer.getText(ast),
    fn = (ast, name) =>
      find(ast, (n) => ts.isFunctionDeclaration(n) && n.name?.text === name).getText(ast);
  function run(s, bindings = {}) {
    const box = { ...bindings };
    vm.runInNewContext(
      ts.transpileModule(s, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
      }).outputText,
      box,
    );
    return box.__result;
  }
  const fixture = parse(await read("tests/e2e/m06-01-organization-admin.spec.ts")),
    events = plain(
      run(
        ["org", "ws", "memberAdmin"]
          .map((k) => "const " + k + "=" + variable(fixture, k) + ";")
          .join("\n") +
          "globalThis.__result=" +
          variable(fixture, "organizationAuditEvents"),
      ),
    ),
    realtime = plain(
      run("globalThis.__result=" + variable(fixture, "realtimeEvents"), {
        organizationAuditEvents: events,
      }),
    ),
    defaults = () => ({
      action: "",
      outcome: "",
      resource_type: "",
      request_id: "",
      trace_id: "",
      occurred_from: "",
      occurred_to: "",
    }),
    child = parse(
      historicalAuditSource(
        "apps/web/src/components/OrganizationAuditPanel.vue",
        await read("apps/web/src/components/OrganizationAuditPanel.vue"),
      )
        .split(/<script setup[^>]*>/)[1]
        .split("</script>")[0],
    ),
    childSource = child.statements
      .filter((n) => !ts.isImportDeclaration(n))
      .map((n) => n.getFullText(child))
      .join("\n"),
    keys =
      "loadedQuery selectedId form validationMessage copyState systemEventsExpanded actionLabels resourceLabels outcomeLabels searchedEvents hiddenSystemEventCount visibleEvents selectedEvent loadedCounts sanitizedMetadata queryText setQuery formFromFilters localDateTime toIso normalizedFilters syncServerQuery submitFilters resetFilters choose sanitizeMetadata copy".split(
        " ",
      );
  function harness(query = {}) {
    const props = {
        events: plain(events.slice(0, 50)),
        filters: defaults(),
        nextCursor: events[49].id,
        busy: false,
      },
      route = { query },
      watches = [],
      applied = [],
      replacements = [];
    let resolveCopy;
    props.applyFilters = async (v) => {
      applied.push(plain(v));
    };
    props.loadMore = async () => {};
    const h = run(childSource + "\nglobalThis.__result={" + keys.join(",") + "};", {
      defineProps: () => props,
      ref: (value) => ({ value }),
      computed: (f) => ({
        get value() {
          return f();
        },
      }),
      watch: (...args) => watches.push(args),
      useRoute: () => route,
      useRouter: () => ({ replace: async (v) => replacements.push(plain(v)) }),
      navigator: {
        clipboard: {
          writeText: () =>
            new Promise((r) => {
              resolveCopy = r;
            }),
        },
      },
    });
    return { h, props, route, watches, applied, replacements, resolveCopy: () => resolveCopy() };
  }
  const { h, props, watches, applied, replacements, resolveCopy } = harness();
  assert.equal(events.length, 55);
  assert.equal(realtime.length, 40);
  assert.deepEqual(plain(h.loadedCounts.value), { succeeded: 17, failed: 17, blocked: 16 });
  assert.equal(h.visibleEvents.value.length, 50);
  assert.equal(h.sanitizedMetadata.value.api_token, "[已脱敏]");
  const oracle = {};
  for (const q of [
    "失败",
    "成员关系",
    "m06-01-audit-trace-001",
    "organization.member.invited",
    "新增采购成员",
    events[0].actor_id,
  ]) {
    h.loadedQuery.value = q;
    oracle[q] = plain(h.visibleEvents.value.map((e) => e.id));
  }
  assert.equal(oracle["失败"].length, 17);
  assert.equal(oracle["新增采购成员"].length, 0);
  assert.equal(oracle[events[0].actor_id].length, 0);
  h.loadedQuery.value = "";
  props.events = [...plain(realtime), ...plain(events.slice(0, 10))];
  assert.equal(h.hiddenSystemEventCount.value, 40);
  assert.equal(h.visibleEvents.value.length, 10);
  h.systemEventsExpanded.value = true;
  assert.equal(h.visibleEvents.value.length, 50);
  h.systemEventsExpanded.value = false;
  h.loadedQuery.value = "实时连接";
  assert.equal(h.visibleEvents.value.length, 40);
  h.loadedQuery.value = "";
  props.filters.action = "realtime.connected";
  assert.equal(h.visibleEvents.value.length, 50);
  props.filters = defaults();
  props.events = plain(events.slice(0, 50));
  h.choose(events[10]);
  assert.equal(h.selectedEvent.value.id, events[10].id);
  h.loadedQuery.value = "m06-01-audit-request-001";
  watches[2][1](h.visibleEvents.value);
  assert.equal(h.selectedId.value, events[0].id);
  h.loadedQuery.value = "no-match";
  watches[2][1](h.visibleEvents.value);
  assert.equal(h.selectedId.value, "");
  h.loadedQuery.value = "";
  h.choose(events[0]);
  const pendingCopy = h.copy(events[0].request_id, "request");
  h.choose(events[1]);
  resolveCopy();
  await pendingCopy;
  assert.equal(h.copyState.value, "request:copied");
  assert.equal(h.selectedEvent.value.id, events[1].id);
  const sensitive = {
    password: "synthetic",
    Authorization: "synthetic",
    nested: {
      api_token: "synthetic",
      private_key: "synthetic",
      ordinary: "SYNTHETIC_VALUE_WITH_NO_SENSITIVE_KEY",
    },
    list: Array.from({ length: 101 }, (_, i) => ({ cookie: "synthetic", i })),
  };
  const sanitized = plain(h.sanitizeMetadata(sensitive));
  assert.equal(sanitized.password, "[已脱敏]");
  assert.equal(sanitized.nested.api_token, "[已脱敏]");
  assert.equal(sanitized.nested.ordinary, sensitive.nested.ordinary);
  assert.equal(sanitized.list.length, 100);
  assert.equal(sanitized.list[0].cookie, "[已脱敏]");
  assert.equal(h.sanitizeMetadata("synthetic", 9), "[层级过深]");
  assert.equal(h.sanitizeMetadata(null).constructor.name, "Object");
  assert.equal(h.sanitizeMetadata(false), false);
  const dates = {
    ...defaults(),
    occurred_from: "2026-08-28T12:00",
    occurred_to: "2026-08-27T12:00",
  };
  h.form.value = dates;
  await h.submitFilters();
  assert.match(h.validationMessage.value, /开始时间/);
  assert.equal(applied.length, 0);
  assert.equal(replacements.length, 0);
  h.form.value = {
    ...defaults(),
    action: " organization.member.invited ",
    outcome: "succeeded",
    resource_type: " membership ",
    request_id: " request-fixture ",
    trace_id: " trace-fixture ",
    occurred_from: "2026-08-27T10:00:00Z",
    occurred_to: "2026-08-27T11:00:00Z",
  };
  await h.submitFilters();
  const filters = {
    ...defaults(),
    action: "organization.member.invited",
    outcome: "succeeded",
    resource_type: "membership",
    request_id: "request-fixture",
    trace_id: "trace-fixture",
    occurred_from: "2026-08-27T10:00:00.000Z",
    occurred_to: "2026-08-27T11:00:00.000Z",
  };
  assert.deepEqual(applied[0], filters);
  assert.equal(h.selectedId.value, "");
  await h.resetFilters();
  assert.deepEqual(applied[1], defaults());
  h.form.value.action = "draft";
  watches[0][1](filters);
  assert.equal(h.form.value.action, filters.action);
  const urlHarness = harness({
    org_audit_query: "x".repeat(170),
    org_audit_selected: "y".repeat(40),
    keep: "yes",
  });
  assert.equal(urlHarness.h.loadedQuery.value.length, 160);
  assert.equal(urlHarness.h.selectedId.value.length, 36);
  urlHarness.h.loadedQuery.value = "失败";
  urlHarness.h.selectedId.value = "";
  urlHarness.watches[1][1]();
  assert.deepEqual(urlHarness.replacements[0].query, { org_audit_query: "失败", keep: "yes" });
  urlHarness.route.query.org_audit_query = "replaced";
  assert.equal(urlHarness.h.loadedQuery.value, "失败");
  assert.equal(h.toIso("invalid-date"), "");
  const parent = parse(
    historicalAuditSource(
      "apps/web/src/components/OrganizationAdminCenter.vue",
      await read("apps/web/src/components/OrganizationAdminCenter.vue"),
    )
      .split(/<script setup[^>]*>/)[1]
      .split("</script>")[0],
  );
  const auditFilters = { value: filters },
    data = { value: { items: plain(events.slice(0, 50)), nextCursor: events[49].id } },
    busy = { value: false },
    calls = [];
  let finish;
  const p = run(
    fn(parent, "auditPath") +
      "\n" +
      fn(parent, "loadAuditPage") +
      "\n" +
      fn(parent, "readView") +
      "\nglobalThis.__result={auditPath,loadAuditPage,readView};",
    {
      URLSearchParams,
      props: { organizationId: events[0].organization_id },
      auditFilters,
      data,
      busy,
      api: (url) => {
        calls.push(url);
        return new Promise((r) => {
          finish = r;
        });
      },
      requestId: { value: "" },
      notice: { value: "" },
      noticeKind: { value: "" },
      state: { value: "ready" },
      applyFailure: () => {},
      rethrowUnexpectedError: () => {},
      ApiClientError: class extends Error {},
    },
  );
  const exactPath = p.auditPath(),
    cursorPath = p.auditPath(events[49].id);
  assert.equal(new URL(exactPath, "https://fixture.invalid").searchParams.size, 8);
  assert.equal(
    new URL(cursorPath, "https://fixture.invalid").searchParams.get("cursor"),
    events[49].id,
  );
  const paging = p.loadAuditPage(defaults(), true);
  assert.equal(busy.value, true);
  await p.loadAuditPage(defaults(), true);
  assert.equal(calls.length, 1);
  // A newer first-page load can replace the shared data while loadAuditPage is pending.
  data.value = { items: [plain(events[5])], nextCursor: null };
  finish({
    data: { items: plain(events.slice(50)), nextCursor: null },
    request_id: "synthetic-page",
  });
  await paging;
  assert.deepEqual(plain(data.value.items.map((e) => e.id)), [
    events[5].id,
    ...events.slice(50).map((e) => e.id),
  ]);
  const auditRead = p.readView("audit");
  assert.equal(calls.length, 2);
  assert.ok(calls.every((v) => v.includes("/audit-events?")));
  finish({ data: { items: [], nextCursor: null }, request_id: "synthetic-read" });
  await auditRead;
  // Real list method executed with inert query responses, never a database connection.
  const repositorySource = await read("apps/api/src/mysql-audit-repository.ts"),
    repoAst = parse(repositorySource),
    list = find(
      repoAst,
      (n) => ts.isMethodDeclaration(n) && n.name.getText(repoAst) === "list",
    ).getText(repoAst),
    listFn = run("globalThis.__result=class {" + list + "}", {
      eventColumns:
        "id,organization_id,workspace_id,actor_id,action,resource_type,resource_id,outcome,request_id,trace_id,metadata,occurred_at,schema_version",
      mapEvent: (r) => ({ ...r, metadata: JSON.parse(r.metadata) }),
      AuditError: class extends Error {},
    });
  const sqlCalls = [],
    repository = new listFn();
  repository.pool = {
    query: async (sql, args) => {
      sqlCalls.push({ sql, args });
      return [events.slice(0, 3).map((e) => ({ ...e, metadata: JSON.stringify(e.metadata) }))];
    },
  };
  const sqlPage = await repository.list({
    organizationId: events[0].organization_id,
    outcome: "failed",
    action: "synthetic-action",
    resourceType: "collection_run",
    requestId: "synthetic-request",
    traceId: "synthetic-trace",
    limit: 2,
  });
  assert.equal(sqlPage.items.length, 2);
  assert.equal(sqlPage.nextCursor, events[1].id);
  assert.match(sqlCalls[0].sql, /UNION ALL/);
  assert.match(sqlCalls[0].sql, /1=0/);
  assert.match(sqlCalls[0].sql, /ORDER BY occurred_at DESC,id DESC LIMIT/);
  assert.equal(sqlCalls[0].args.at(-1), 3);
  assert.equal(sqlCalls[0].args.filter((v) => v === events[0].organization_id).length, 2);
  repository.pool = {
    query: async (sql, args) => {
      sqlCalls.push({ sql, args });
      return [[]];
    },
  };
  await assert.rejects(
    repository.list({ organizationId: events[0].organization_id, cursor: events[49].id }),
    /audit_cursor_invalid/,
  );
  return {
    events,
    realtime,
    actionLabels: plain(h.actionLabels),
    resourceLabels: plain(h.resourceLabels),
    outcomeLabels: plain(h.outcomeLabels),
    oracle,
    filters,
    exactPath,
    cursorPath,
    sourceChecks: [
      "Actual child computed and explicit watchers: loaded-only search, 50-row counts, 40 system-event disclosure, selection fallback, URL truncation and one-way restoration",
      "Actual metadata recursion: sensitive key redaction, 100-item cap, depth>8 cutoff; innocuous-key synthetic value intentionally remains, not universal secret detection",
      "Actual submit/reset/parent path: seven exact filters, ISO dates, inverted range rejected, trimmed URL and 50/cursor contract; audit read does not request admin summary",
      "OG-G05 reproduced: pending old copy marks newly selected event copied; pending loadMore appends its old page onto a replaced shared list",
      "Actual repository list with inert query: UNION ALL, failed outcome excludes audit_logs, organization parameters, limit+1/cursor and missing cursor rejection; no SQL execution",
    ],
  };
}
