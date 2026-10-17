import { randomUUID } from "node:crypto";
import {
  CaptureAuthDelivery,
  InMemoryAuthRepository,
  LocalAuthService,
  createArgon2PasswordHasher,
} from "../../packages/auth/dist/index.js";
import {
  AuthorizationService,
  InMemoryAuthorizationRepository,
} from "../../packages/authorization/dist/index.js";
import {
  UiPreferenceService,
  InMemoryUiPreferenceRepository,
} from "../../packages/preferences/dist/index.js";
import {
  OpportunityService,
  OpportunityServiceError,
} from "../../apps/api/dist/opportunity-service.js";
import { HomeDashboardService } from "../../apps/api/dist/home-dashboard-service.js";
import { ScoringService } from "../../apps/api/dist/scoring-service.js";
import { ProfitService } from "../../apps/api/dist/profit-service.js";
import { CompetitorService } from "../../apps/api/dist/competitor-service.js";

// Synthetic, process-local data. These credentials and records never enter production.
export const selectionHttpAccounts = {
  member: "selection-http@example.test",
  viewer: "selection-viewer@example.test",
  foreign: "selection-foreign@example.test",
  password: "Local-Selection-Only-42!",
};
export const selectionHttpIds = {
  organization: "00000000-0000-4000-8000-000000009101",
  workspace: "00000000-0000-4000-8000-000000009102",
  product: "00000000-0000-4000-8000-000000009103",
};

export async function createSelectionHttpStack(webOrigin) {
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(webOrigin))
    throw new Error("selection_http_fixture_loopback_only");
  const now = new Date(),
    observed = now.toISOString();
  const authorizationRepository = new InMemoryAuthorizationRepository();
  const preferences = new InMemoryUiPreferenceRepository();
  const users = new Map();
  class FixtureAuthRepository extends InMemoryAuthRepository {
    async createSession(session) {
      await super.createSession(session);
      const owner = users.get(session.user_id);
      authorizationRepository.contexts.set(session.id, {
        user_id: session.user_id,
        organization_id: owner.organization,
        workspace_id: owner.workspace,
      });
      preferences.scopes.set(session.id, {
        userId: session.user_id,
        organizationId: owner.organization,
        workspaceId: owner.workspace,
      });
    }
  }
  const repository = new FixtureAuthRepository();
  const hasher = createArgon2PasswordHasher({ memoryCost: 19456, timeCost: 2, parallelism: 1 });
  const passwordHash = await hasher.hash(selectionHttpAccounts.password);
  for (const role of ["member", "viewer", "foreign"]) {
    const id = randomUUID(),
      foreign = role === "foreign";
    const organization = foreign ? randomUUID() : selectionHttpIds.organization;
    const workspace = foreign ? randomUUID() : selectionHttpIds.workspace;
    users.set(id, { organization, workspace });
    await repository.createUser({
      id,
      email: selectionHttpAccounts[role],
      email_normalized: selectionHttpAccounts[role],
      username: null,
      username_normalized: null,
      password_hash: passwordHash,
      status: "active",
      email_verified_at: now,
      failed_login_count: 0,
      locked_until: null,
      password_changed_at: now,
      must_change_password: false,
      must_enroll_mfa: false,
      security_setup_completed_at: now,
      version: 1,
      created_at: now,
      updated_at: now,
    });
    authorizationRepository.workspaceOrganizations.set(workspace, organization);
    authorizationRepository.subjects.set(authorizationRepository.key(id, organization), {
      actor_id: id,
      membership_id: randomUUID(),
      membership_active: true,
      role_codes: ["member"],
      capabilities:
        role === "viewer"
          ? ["task:read"]
          : ["task:read", "opportunity:read", "opportunity:decide", "competitor:read"],
      scopes: [{ scope: "organization" }],
      platform_role_codes: [],
      platform_capabilities: [],
    });
  }
  const auth = new LocalAuthService({
    repository,
    delivery: new CaptureAuthDelivery(),
    passwordHasher: hasher,
    policy: {
      passwordMinLength: 12,
      passwordMaxLength: 128,
      sessionTtlMinutes: 60,
      actionTokenTtlMinutes: 15,
      maxFailedAttempts: 5,
      lockMinutes: 15,
    },
  });
  const authorization = new AuthorizationService(authorizationRepository);
  const operations = new Map();
  const execute = async (input, work) => {
    const key = [input.scope, input.method, input.route, input.key].join(":");
    if (operations.has(key)) return { ...operations.get(key), replayed: true };
    const value = await work();
    operations.set(key, value);
    return value;
  };
  const inScope = (input) =>
    input.organizationId === selectionHttpIds.organization &&
    input.workspaceId === selectionHttpIds.workspace;
  const primary = (price) => ({
    price,
    currency: "USD",
    rating_value: 4.3,
    review_count: 125,
    captured_at: observed,
    public_signals: null,
  });
  const base = {
    image_url: null,
    market: "US",
    category: "accessories",
    source_type: "manual",
    source_ref_id: null,
    owner_id: [...users.keys()][0],
    lifecycle_status: "candidate",
    lifecycle_entered_at: observed,
    lifecycle_dwell_seconds: 0,
    recommendation_status: "insufficient_data",
    overall_score: null,
    trend_score: null,
    competition_score: null,
    profit_status: "insufficient_data",
    risk_level: "unknown",
    confidence: { status: "insufficient_data", score: null },
    evidence_count: 0,
    source_count: 0,
    competitor_count: 5,
    supplier_candidate_count: 0,
    matched_rule_count: 0,
    selection_stage: "not_eligible",
    quality_gates: {
      score: false,
      market: false,
      competition: false,
      cost: false,
      risk: false,
      all_passed: false,
    },
    coverage_status: "partial",
    blocking_reasons: ["recommendation_insufficient"],
    decision_status: "pending",
    version: 1,
    updated_at: observed,
  };
  const products = [
    {
      ...base,
      id: selectionHttpIds.product,
      main_asin: "B0HTTP0000",
      name: "HTTP 验证耳机收纳盒",
      primary_product: primary(19.95),
    },
    {
      ...base,
      id: "00000000-0000-4000-8000-000000009104",
      main_asin: "B0HTTP0010",
      name: "HTTP 验证旅行收纳袋",
      market: "DE",
      primary_product: primary(12.5),
    },
  ];
  const decisions = [];
  const opportunities = new OpportunityService({
    async list(input) {
      if (!inScope(input)) return { items: [], total: 0 };
      let items = products.filter(
        (item) =>
          (!input.query || item.name.includes(input.query)) &&
          (!input.market || item.market === input.market) &&
          (!input.decisionStatus || item.decision_status === input.decisionStatus),
      );
      if (input.selectionView === "recommended" || input.selectionView === "rule_candidates")
        items = [];
      const total = items.length;
      return {
        items: structuredClone(
          items.slice((input.page - 1) * input.pageSize, input.page * input.pageSize),
        ),
        total,
      };
    },
    async memberOptions(input) {
      return inScope(input) ? [{ id: base.owner_id, label: "HTTP 验证成员" }] : [];
    },
    async get(input) {
      const product = inScope(input) && products.find((item) => item.id === input.opportunityId);
      return product
        ? structuredClone({
            ...product,
            adoption_blockers: [],
            redecision_ready: false,
            score_rule_version: null,
            scored_at: null,
            latest_score_run: null,
            score_components: [],
            evidence: [],
            decisions,
            section_status: {
              market: "insufficient_data",
              competition: "covered",
              profit: "insufficient_data",
              risk: "insufficient_data",
              execution: "not_available",
            },
          })
        : null;
    },
    async decide(input) {
      const operationKey = `${input.organizationId}:${input.route}:${input.idempotencyKey}`;
      const request = JSON.stringify([
        input.opportunityId,
        input.action,
        input.reason,
        input.expectedVersion,
      ]);
      const previous = operations.get(operationKey);
      if (previous) {
        if (previous.request !== request)
          throw new OpportunityServiceError(
            "idempotency_conflict",
            409,
            "同一幂等键不能更改请求。",
          );
        return structuredClone(previous.value);
      }
      const product = inScope(input) && products.find((item) => item.id === input.opportunityId);
      if (!product)
        throw new OpportunityServiceError("opportunity_not_found", 404, "当前范围没有该商品。");
      if (product.version !== input.expectedVersion)
        throw new OpportunityServiceError("version_conflict", 409, "重新读取当前版本。");
      if (input.action !== "observe")
        throw new OpportunityServiceError(
          "fixture_action_unsupported",
          400,
          "此隔离验证只支持观察决策。",
        );
      product.decision_status = "observing";
      product.lifecycle_status = "observing";
      product.version++;
      const decision = {
        id: randomUUID(),
        action: input.action,
        reason: input.reason,
        actor_id: input.actorId,
        created_at: new Date().toISOString(),
        opportunity_version: product.version,
        request_id: input.requestId,
        trace_id: input.traceId,
        route: input.route,
      };
      decisions.push(decision);
      const value = {
        opportunity_id: product.id,
        decision_status: product.decision_status,
        version: product.version,
        decision_id: decision.id,
      };
      operations.set(operationKey, { request, value });
      return value;
    },
  });
  const scope = { auth, authorization, secureCookie: false, webOrigin };
  const competitorItems = Array.from({ length: 5 }, (_, index) => ({
    id: randomUUID(),
    opportunity_id: selectionHttpIds.product,
    market: "US",
    source_site: "amazon",
    external_id: `B0HTTP000${index + 1}`,
    title: `HTTP 验证独立竞品 ${index + 1}`,
    snapshot_count: 1,
    latest_snapshot: {
      current_price: 20 + index,
      currency: "USD",
      review_count: 100 + index,
      rating_value: 4.2,
      captured_at: observed,
      freshness: "fresh",
      source_status: "healthy",
      detail_collected: true,
      source_enabled: true,
      public_signals: null,
    },
  }));
  return {
    localAuth: {
      service: auth,
      idempotency: { execute, executeSensitive: execute },
      webOrigin,
      secureCookie: false,
    },
    authorization: { service: authorization, auth, secureCookie: false },
    uiPreferences: {
      service: new UiPreferenceService(preferences),
      auth,
      webOrigin,
      secureCookie: false,
    },
    opportunities: { ...scope, service: opportunities },
    scoring: { ...scope, service: new ScoringService({ list: async () => [] }) },
    profit: {
      ...scope,
      service: new ProfitService({
        listRules: async () => [],
        getAnalysis: async () => ({ latest_run: null, current_inputs: [], cost_input_reviews: [] }),
      }),
    },
    competitors: {
      ...scope,
      service: new CompetitorService({
        list: async (input) =>
          inScope(input) && input.opportunityId === selectionHttpIds.product
            ? structuredClone(competitorItems)
            : [],
      }),
    },
    homeDashboard: {
      ...scope,
      service: new HomeDashboardService({
        list: async () => [],
        automaticSelection: async (input) => ({
          state: "not_configured",
          enabled_rule_count: 0,
          candidate_count: inScope(input) ? 2 : 0,
          rule_candidate_count: 0,
          recommended_count: 0,
          awaiting_evidence_count: inScope(input) ? 2 : 0,
          adopted_count: 0,
          recommended_items: [],
          last_collection_at: null,
          next_collection_at: null,
          daily_production: {
            date: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(now),
            timezone: "Asia/Shanghai",
            completed_count: 0,
            discovered_count: inScope(input) ? 2 : 0,
            qualified_count: 0,
            target_minimum: 100,
            measured_at: observed,
          },
        }),
      }),
    },
  };
}
