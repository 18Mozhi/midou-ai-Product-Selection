import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { loadRuntimeConfig } from "../packages/config/dist/index.js";
import { createDatabasePool } from "../packages/database/dist/index.js";
import { MINIMUM_SELECTION_COMPETITORS } from "../packages/contracts/dist/index.js";
import { HomeDashboardService } from "../apps/api/dist/home-dashboard-service.js";
import { MySqlHomeDashboardRepository } from "../apps/api/dist/mysql-home-dashboard-repository.js";

function runBaoTaProbe() {
  const result = spawnSync("python", ["scripts/verify-live-baota.py", "home-dashboard"], {
    encoding: "utf8",
    timeout: 150_000,
    windowsHide: true,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error || result.status !== 0) process.exitCode = result.status ?? 2;
}

if (process.argv.includes("--baota-production")) {
  runBaoTaProbe();
} else {
  const requestId = randomUUID(),
    traceId = requestId,
    ids = {
      user: randomUUID(),
      otherUser: randomUUID(),
      org: randomUUID(),
      otherOrg: randomUUID(),
      workspace: randomUUID(),
      otherWorkspace: randomUUID(),
      task: randomUUID(),
      approvalTemplate: randomUUID(),
      approvalVersion: randomUUID(),
      approvalNode: randomUUID(),
      approvalRequest: randomUUID(),
      approvalRun: randomUUID(),
      trendTopic: randomUUID(),
      monitoringRule: randomUUID(),
      scoreRule: randomUUID(),
      opportunity: randomUUID(),
      opportunityRuleMatch: randomUUID(),
      scoreRun: randomUUID(),
      riskScoreComponent: randomUUID(),
    },
    scoreRuleVersion = `home-live-${requestId.slice(0, 8)}`,
    now = new Date(),
    pool = createDatabasePool(loadRuntimeConfig(process.env, "api"));

  async function assertSchemaReady() {
    const transactionalTables = [
      "users",
      "organizations",
      "workspaces",
      "trend_topics",
      "trend_monitoring_rules",
      "score_rules",
      "tasks",
      "approval_templates",
      "approval_template_versions",
      "approval_template_nodes",
      "approval_requests",
      "approval_node_runs",
      "opportunities",
      "opportunity_rule_matches",
      "opportunity_score_runs",
      "opportunity_score_components",
      "home_dashboard_items",
      "collection_tasks",
      "collection_subqueries",
      "file_assets",
      "raw_evidence",
      "normalized_records",
      "collection_task_evidence_links",
      "opportunity_evidence_links",
      "competitors",
      "competitor_snapshots",
      "opportunity_events",
    ];
    const [rows] = await pool.query(
      "SELECT table_name AS name, engine FROM information_schema.tables " +
        "WHERE table_schema=DATABASE() AND table_name IN (?)",
      [transactionalTables],
    );
    const engines = new Map(rows.map(({ name, engine }) => [name, engine]));
    const unsafe = transactionalTables.filter((name) => engines.get(name) !== "InnoDB");
    if (unsafe.length)
      throw new Error(`missing or non-transactional fixture tables: ${unsafe.join(",")}`);
  }

  let db;
  const evidenceTaskId = randomUUID(),
    tenant = { organization_id: ids.org, workspace_id: ids.workspace },
    trace = { request_id: requestId, trace_id: traceId },
    created = { created_by: ids.user, created_at: now };

  // Only static table/column identifiers declared by this fixture reach this helper.
  async function insertFixture(table, row) {
    const columns = Object.keys(row);
    await db.query(
      `INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`,
      Object.values(row),
    );
  }

  async function seedSelectionEvidence() {
    const [[provider]] = await db.query(
      "SELECT id FROM providers WHERE code='amazon_product' AND status='enabled'",
    );
    if (!provider) throw new Error("enabled Amazon product evidence provider missing");
    const provider_id = provider.id,
      stamp = requestId.slice(0, 8).toUpperCase(),
      mainAsin = `${stamp}00`,
      primaryTitle = "M02-06 primary test product",
      productUrl = (asin) => `https://www.amazon.com/dp/${asin}`;
    let ordinal = 0;

    // The task is terminal and is never committed. No outbox or provider call is involved.
    await insertFixture("collection_tasks", {
      id: evidenceTaskId,
      ...tenant,
      ...trace,
      ...created,
      status: "succeeded",
      coverage_status: "complete",
      priority: "normal",
      scheduled_at: now,
      available_at: now,
      finished_at: now,
      missing_fields_json: "[]",
      version: 1,
      updated_at: now,
    });
    const subquery = async (target, count = 1) => {
      const id = randomUUID();
      await insertFixture("collection_subqueries", {
        id,
        ...tenant,
        provider_id,
        task_id: evidenceTaskId,
        ordinal: ++ordinal,
        target_json: JSON.stringify(target),
        is_required: 1,
        status: "succeeded",
        available_result_count: count,
        missing_fields_json: "[]",
        version: 1,
        created_at: now,
        updated_at: now,
      });
      return id;
    };
    const evidence = async (queryId, asin, title) => {
      const raw = randomUUID(),
        normalized = randomUUID(),
        file = randomUUID(),
        url = productUrl(asin),
        content = JSON.stringify({ asin, title, canonical_url: url }),
        hash = createHash("sha256").update(content).digest("hex"),
        size = Buffer.byteLength(content);
      await insertFixture("file_assets", {
        id: file,
        ...tenant,
        ...created,
        category: "evidence",
        relative_path: `home-live/${file}.json`,
        content_sha256: hash,
        size_bytes: size,
        status: "active",
        updated_at: now,
      });
      await insertFixture("raw_evidence", {
        id: raw,
        ...tenant,
        ...trace,
        ...created,
        provider_id,
        collection_task_id: evidenceTaskId,
        collection_subquery_id: queryId,
        file_asset_id: file,
        source_url: url,
        canonical_url: url,
        dedupe_key: raw,
        content_sha256: hash,
        content_type: "application/json",
        size_bytes: size,
        captured_at: now,
        parser_version: "home-live-v1",
        adapter_version: "home-live-v1",
        retention_until: new Date(now.getTime() + 86_400_000),
        status: "active",
      });
      await insertFixture("normalized_records", {
        id: normalized,
        ...tenant,
        ...trace,
        ...created,
        provider_id,
        raw_evidence_id: raw,
        record_key: raw,
        schema_version: "home-live-v1",
        record_version: 1,
        payload_json: content,
        status: "active",
      });
      await insertFixture("collection_task_evidence_links", {
        id: randomUUID(),
        ...tenant,
        ...trace,
        ...created,
        provider_id,
        collection_task_id: evidenceTaskId,
        collection_subquery_id: queryId,
        raw_evidence_id: raw,
        normalized_record_id: normalized,
        link_type: "captured",
      });
      return { raw, normalized };
    };
    const mainQuery = await subquery({ page_url: productUrl(mainAsin) });
    const main = await evidence(mainQuery, mainAsin, primaryTitle);
    await insertFixture("opportunity_evidence_links", {
      id: randomUUID(),
      ...tenant,
      opportunity_id: ids.opportunity,
      provider_id,
      evidence_type: "trend_signal",
      evidence_id: main.normalized,
      raw_evidence_id: main.raw,
      observed_at: now,
      created_at: now,
    });
    const relationQuery = await subquery(
      {
        projection_type: "opportunity_competitors",
        opportunity_id: ids.opportunity,
        main_asin: mainAsin,
      },
      MINIMUM_SELECTION_COMPETITORS,
    );
    const candidates = [],
      classifications = [],
      snapshots = [];
    for (let i = 1; i <= MINIMUM_SELECTION_COMPETITORS; i += 1) {
      const asin = `${stamp}${String(i).padStart(2, "0")}`,
        title = `M02-06 substitute ${i}`,
        competitorId = randomUUID(),
        snapshot = randomUUID();
      await insertFixture("competitors", {
        id: competitorId,
        ...tenant,
        ...created,
        provider_id,
        opportunity_id: ids.opportunity,
        market: "US",
        source_site: "Amazon",
        external_id: asin,
        product_url: productUrl(asin),
        title,
        status: "active",
        updated_at: now,
      });
      const detailQuery = await subquery({
        projection_type: "competitor_snapshot",
        competitor_id: competitorId,
        page_url: productUrl(asin),
      });
      const detail = await evidence(detailQuery, asin, title);
      await insertFixture("competitor_snapshots", {
        id: snapshot,
        ...tenant,
        ...trace,
        provider_id,
        competitor_id: competitorId,
        current_price: 24.5,
        currency: "USD",
        rank_value: 100 + i,
        review_count: 40 + i,
        rating_value: 4.4,
        availability: "in_stock",
        captured_at: now,
        freshness: "fresh",
        source_status: "healthy",
        source_ref_id: `collection:${evidenceTaskId}:${detail.normalized}`,
        evidence_id: detail.raw,
        created_at: now,
      });
      const relation = await evidence(relationQuery, asin, title);
      candidates.push({ source_ref: relation.normalized, asin, title });
      classifications.push({
        source_ref: relation.normalized,
        relation: "substitute",
        candidate_excerpt: title,
        primary_excerpt: primaryTitle,
      });
      snapshots.push(snapshot);
    }
    const input = { primary: { asin: mainAsin, title: primaryTitle }, candidates };
    await insertFixture("opportunity_events", {
      id: randomUUID(),
      ...tenant,
      ...trace,
      event_type: "opportunity.competitors_classified",
      resource_type: "opportunity",
      resource_id: ids.opportunity,
      actor_type: "worker",
      actor_id: "m02-06-fixture",
      occurred_at: now,
      payload_json: JSON.stringify({
        version: "competitor-title-v1",
        task_id: evidenceTaskId,
        subquery_id: relationQuery,
        model_fingerprint: createHash("sha256").update("m02-06-fixture").digest("hex"),
        input_fingerprint: createHash("sha256").update(JSON.stringify(input)).digest("hex"),
        scope: {
          taskId: evidenceTaskId,
          subqueryId: relationQuery,
          organizationId: ids.org,
          workspaceId: ids.workspace,
          opportunityId: ids.opportunity,
          mainAsin,
        },
        input,
        classifications,
      }),
    });
    return snapshots;
  }

  try {
    const [versionRows] = await pool.query(
        "SELECT VERSION() version,@@character_set_server charset,DATABASE() database_name,CURRENT_USER() account_name",
      ),
      runtime = versionRows[0];
    if (
      !String(runtime.version).startsWith("5.7.") ||
      runtime.charset !== "utf8mb4" ||
      runtime.database_name !== "product_scout" ||
      !String(runtime.account_name).startsWith("product_scout@")
    )
      throw new Error("requires MySQL57 utf8mb4 product_scout business account");
    await assertSchemaReady();
    db = await pool.getConnection();
    await db.beginTransaction();
    for (const [id, label] of [
      [ids.user, "viewer"],
      [ids.otherUser, "other"],
    ]) {
      const email = `m02-06-${label}-${requestId}@example.test`;
      await db.query(
        "INSERT INTO users (id,email,email_normalized,password_hash,status,email_verified_at,password_changed_at,version,created_at,updated_at) VALUES (?,?,?,'live-probe','active',?,?,1,?,?)",
        [id, email, email, now, now, now, now],
      );
    }
    for (const [id, name, slug] of [
      [ids.org, "M02 Home Org", `home-${requestId.slice(0, 8)}`],
      [ids.otherOrg, "M02 Other Org", `other-${requestId.slice(0, 8)}`],
    ])
      await db.query(
        "INSERT INTO organizations (id,name,slug,status,timezone,data_retention_days,default_workspace_id,created_by,version,created_at,updated_at) VALUES (?,?,?,'active','Asia/Shanghai',365,NULL,?,1,?,?)",
        [id, name, slug, ids.user, now, now],
      );
    for (const [id, org, name, slug] of [
      [ids.workspace, ids.org, "Home Workspace", "home"],
      [ids.otherWorkspace, ids.otherOrg, "Other Workspace", "other"],
    ])
      await db.query(
        "INSERT INTO workspaces (id,organization_id,name,slug,status,created_by,version,created_at,updated_at) VALUES (?,?,?,?,'active',?,1,?,?)",
        [id, org, name, slug, ids.user, now, now],
      );

    await db.query(
      "INSERT INTO trend_topics (id,organization_id,workspace_id,topic_key,title,category,market,language,status,signal_count,source_count,heat_value,heat_unit,momentum_percent,confidence_score,confidence_status,first_seen_at,last_seen_at,source_fresh_at,version,created_by,created_at,updated_at) VALUES (?,?,?,SHA2(?,256),?,'home-live','US','zh-CN','active',1,1,1,'signals',NULL,NULL,'insufficient_data',?,?,?,1,?,?,?)",
      [
        ids.trendTopic,
        ids.org,
        ids.workspace,
        `home-live-${requestId}`,
        "仪表盘实时验收趋势",
        now,
        now,
        now,
        ids.user,
        now,
        now,
      ],
    );
    await db.query(
      "INSERT INTO trend_monitoring_rules (id,organization_id,workspace_id,name,include_keywords_json,negative_keywords_json,market,language,category,notification_channel,collection_interval_minutes,recommendation_min_source_count,source_cursor,status,last_evaluated_at,last_collection_at,next_collection_at,last_collection_task_id,version,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,'仪表盘实时验收规则',?,'[]','US','zh-CN','home-live','in_app',60,1,0,'enabled',?,NULL,?,NULL,1,?,?,?,?)",
      [
        ids.monitoringRule,
        ids.org,
        ids.workspace,
        JSON.stringify(["home dashboard acceptance"]),
        now,
        new Date(now.getTime() + 60 * 60_000),
        ids.user,
        ids.user,
        now,
        now,
      ],
    );
    await db.query(
      "INSERT INTO score_rules (id,organization_id,workspace_id,version_code,name,status,dimensions_json,thresholds_json,revision,submitted_by,submitted_at,approved_by,approved_at,activated_at,rollback_target_id,rolled_back_at,created_by,created_at,updated_at) VALUES (?,?,?,?,'仪表盘实时验收评分规则','active',?,?,1,?,?,?,?,?,NULL,NULL,?,?,?)",
      [
        ids.scoreRule,
        ids.org,
        ids.workspace,
        scoreRuleVersion,
        JSON.stringify([
          { code: "market_demand", weight: 30, required: true },
          { code: "competition", weight: 20, required: true },
          { code: "profit", weight: 30, required: true },
          { code: "risk", weight: 20, required: true },
        ]),
        JSON.stringify({ recommend_min: 75, observe_min: 55 }),
        ids.user,
        now,
        ids.user,
        now,
        now,
        ids.user,
        now,
        now,
      ],
    );

    await db.query(
      "INSERT INTO tasks (id,organization_id,workspace_id,title,description,status,priority,assignee_id,source_type,source_ref_id,collection_task_id,due_at,completed_at,created_by,version,created_at,updated_at) VALUES (?,?,?,?,?,'paused','critical',?,'collection_followup',NULL,NULL,DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 MINUTE),NULL,?,1,?,?)",
      [
        ids.task,
        ids.org,
        ids.workspace,
        "真实阻断任务",
        "验证阻断任务完整上下文",
        ids.user,
        ids.user,
        now,
        now,
      ],
    );
    await db.query(
      "INSERT INTO approval_templates (id,organization_id,workspace_id,name,resource_type,status,current_version,revision,created_by,published_by,published_at,created_at,updated_at) VALUES (?,?,?,'今日行动审批','task','published',1,1,?,?,?, ?,?)",
      [ids.approvalTemplate, ids.org, ids.workspace, ids.user, ids.user, now, now, now],
    );
    await db.query(
      "INSERT INTO approval_template_versions (id,template_id,organization_id,workspace_id,version_number,status,created_by,created_at,published_at) VALUES (?,?,?,?,1,'published',?,?,?)",
      [ids.approvalVersion, ids.approvalTemplate, ids.org, ids.workspace, ids.user, now, now],
    );
    await db.query(
      "INSERT INTO approval_template_nodes (id,template_version_id,organization_id,workspace_id,ordinal,name,approver_id,sla_minutes,escalation_assignee_id) VALUES (?,?,?,?,1,'风险复核',?,60,?)",
      [ids.approvalNode, ids.approvalVersion, ids.org, ids.workspace, ids.user, ids.otherUser],
    );
    await db.query(
      "INSERT INTO approval_requests (id,organization_id,workspace_id,template_id,template_version_id,resource_type,resource_id,title,status,current_node_ordinal,requested_by,completed_at,version,created_at,updated_at) VALUES (?,?,?,?,?,'task',?,'真实待审批事项','pending',1,?,NULL,1,?,?)",
      [
        ids.approvalRequest,
        ids.org,
        ids.workspace,
        ids.approvalTemplate,
        ids.approvalVersion,
        ids.task,
        ids.otherUser,
        now,
        now,
      ],
    );
    await db.query(
      "INSERT INTO approval_node_runs (id,approval_request_id,organization_id,workspace_id,template_node_id,ordinal,name,approver_id,active_approver_id,escalation_assignee_id,status,due_at,escalated_at,decided_by,decision_reason,decided_at,version,created_at,updated_at) VALUES (?,?,?,?,?,1,'风险复核',?,?,?,'pending',?,NULL,NULL,NULL,NULL,1,?,?)",
      [
        ids.approvalRun,
        ids.approvalRequest,
        ids.org,
        ids.workspace,
        ids.approvalNode,
        ids.user,
        ids.user,
        ids.otherUser,
        new Date(now.getTime() + 3_600_000),
        now,
        now,
      ],
    );
    await db.query(
      "INSERT INTO opportunities (id,organization_id,workspace_id,name,market,category,source_type,source_ref_id,owner_id,lifecycle_status,recommendation_status,overall_score,trend_score,competition_score,profit_status,risk_level,confidence_status,confidence_score,evidence_count,source_count,coverage_status,score_rule_version,scored_at,decision_status,version,created_by,created_at,updated_at) VALUES (?,?,?,'真实高价值机会','US','home-live','trend_topic',?,?,'ready','recommend',92,88,84,'calculated','low','measured',86,1,1,'complete',?,?,'pending',1,?,?,?)",
      [
        ids.opportunity,
        ids.org,
        ids.workspace,
        ids.trendTopic,
        ids.user,
        scoreRuleVersion,
        now,
        ids.user,
        now,
        now,
      ],
    );
    await db.query(
      "INSERT INTO opportunity_rule_matches (id,organization_id,workspace_id,opportunity_id,monitoring_rule_id,topic_id,matched_at) VALUES (?,?,?,?,?,?,?)",
      [
        ids.opportunityRuleMatch,
        ids.org,
        ids.workspace,
        ids.opportunity,
        ids.monitoringRule,
        ids.trendTopic,
        now,
      ],
    );
    await db.query(
      "INSERT INTO opportunity_score_runs (id,organization_id,workspace_id,opportunity_id,score_rule_id,rule_version_code,status,overall_score,coverage_percent,confidence_score,recommendation_status,missing_fields_json,input_snapshot_json,request_id,trace_id,scored_at) VALUES (?,?,?,?,?,?,'calculated',92,100,86,'recommend','[]',?,?,?,?)",
      [
        ids.scoreRun,
        ids.org,
        ids.workspace,
        ids.opportunity,
        ids.scoreRule,
        scoreRuleVersion,
        JSON.stringify([{ dimension_code: "risk", source: "home_dashboard_probe" }]),
        requestId,
        traceId,
        now,
      ],
    );
    await db.query(
      "INSERT INTO opportunity_score_components (id,score_run_id,dimension_code,weight_percent,input_score,weighted_score,evidence_ids_json,missing_fields_json) VALUES (?,?, 'risk',20,20,4,'[]','[]')",
      [ids.riskScoreComponent, ids.scoreRun],
    );

    const projectionRows = [
      [
        ids.org,
        ids.workspace,
        null,
        "action",
        "普通投影待办",
        "normal",
        "task:read",
        "/tasks/normal",
      ],
      [
        ids.org,
        ids.workspace,
        ids.user,
        "health",
        "本人健康告警",
        null,
        "task:read",
        "/platform-admin/collection",
      ],
      [
        ids.org,
        ids.workspace,
        ids.otherUser,
        "health",
        "他人健康告警",
        null,
        "task:read",
        "/platform-admin/collection",
      ],
      [
        ids.org,
        ids.workspace,
        null,
        "change",
        "无权变化",
        null,
        "platform:secure",
        "/trends/secure",
      ],
      [
        ids.otherOrg,
        ids.otherWorkspace,
        null,
        "change",
        "其他组织变化",
        null,
        "task:read",
        "/trends/cross",
      ],
    ];
    for (const [org, ws, audience, kind, title, priority, capability, route] of projectionRows)
      await db.query(
        "INSERT INTO home_dashboard_items (id,organization_id,workspace_id,audience_user_id,kind,title,reason,route,required_capability,priority,owner_label,due_at,source_count,observed_at,severity,source_version,created_at,updated_at) VALUES (?,?,?,?,?,?,'live evidence',?,?,?,'验证人',?,2,?,'warning',1,?,?)",
        [
          randomUUID(),
          org,
          ws,
          audience,
          kind,
          title,
          route,
          capability,
          priority,
          new Date(now.getTime() + 86_400_000),
          now,
          now,
          now,
        ],
      );
    const service = new HomeDashboardService(new MySqlHomeDashboardRepository(db), () => now);
    const readHome = () =>
      service.get({
        organizationId: ids.org,
        workspaceId: ids.workspace,
        actorId: ids.user,
        capabilities: ["task:read", "opportunity:read"],
      });
    const hasOpportunity = (home) => home.actions.some((item) => item.id === ids.opportunity);
    if (hasOpportunity(await readHome()))
      throw new Error("opportunity admitted without source evidence");
    const snapshots = await seedSelectionEvidence();
    const result = await readHome();
    for (const source of ["task", "approval", "opportunity", "projection"])
      if (!result.actions.some((item) => item.source_module === source))
        throw new Error(`cross-module action missing: ${source}`);
    if (result.actions[0].title !== "真实阻断任务" || result.actions[0].priority !== "overdue")
      throw new Error("deadline blocker risk priority mismatch");
    const blocked = result.actions.find((item) => item.id === ids.approvalRequest);
    if (!blocked?.blocked || blocked.route !== `/tasks/approvals?approval=${ids.approvalRequest}`)
      throw new Error("blocking context route mismatch");
    const opportunity = result.actions.find((item) => item.id === ids.opportunity);
    if (opportunity?.value_score !== 92 || opportunity.priority !== "high_value")
      throw new Error("opportunity value ordering mismatch");
    if (result.health.length !== 1 || result.health[0].title !== "本人健康告警")
      throw new Error("health audience mismatch");
    if (
      [...result.changes, ...result.health].some(
        (item) =>
          item.title.includes("其他") || item.title.includes("无权") || item.title.includes("他人"),
      )
    )
      throw new Error("scope capability or audience leak");
    await db.query("UPDATE competitor_snapshots SET source_status='degraded' WHERE id=?", [
      snapshots[0],
    ]);
    if (hasOpportunity(await readHome()))
      throw new Error("opportunity admitted below the valid competitor minimum");
    await db.rollback();
    db.release();
    db = null;
    const [[remaining]] = await pool.query(
      "SELECT (SELECT COUNT(*) FROM organizations WHERE id IN (?,?)) + " +
        "(SELECT COUNT(*) FROM users WHERE id IN (?,?)) + " +
        "(SELECT COUNT(*) FROM collection_tasks WHERE id=?) AS n",
      [ids.org, ids.otherOrg, ids.user, ids.otherUser, evidenceTaskId],
    );
    if (Number(remaining.n) !== 0) throw new Error("home fixture rollback readback failed");
    console.log(
      JSON.stringify({
        status: "passed",
        module: "M02-06",
        mysql: runtime.version,
        isolation: "organization_workspace_exact",
        audience: "current_user_health_only",
        capability: "filtered",
        cross_module_actions: "task_approval_opportunity_projection",
        ordering: "deadline_blocker_risk_value",
        context_routes: "passed",
        selection_evidence: {
          primary: "linked_amazon_product",
          valid_competitors: snapshots.length,
        },
        negative_cases: ["missing_source_evidence", "below_valid_competitor_minimum"],
        cleanup: "passed",
        rollback_remaining: 0,
        request_id: requestId,
        trace_id: traceId,
      }),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        status: "blocked",
        code: error?.code ?? "home_dashboard_live_failed",
        message: error instanceof Error ? error.message : "unknown",
        request_id: requestId,
        trace_id: traceId,
      }),
    );
    process.exitCode = 2;
  } finally {
    try {
      if (db) await db.rollback();
    } finally {
      db?.release();
      await pool.end();
    }
  }
}
