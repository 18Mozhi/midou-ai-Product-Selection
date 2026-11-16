import type { FastifyInstance, FastifyRequest } from "fastify";
import { PRIMARY_COST_APPROVER_EMAIL, type LocalAuthService } from "@scoutops/auth";
import type { AuthorizationService, Capability } from "@scoutops/authorization";
import { sessionToken } from "./auth-routes.js";
import { authenticatedRehearsalAccount } from "./account-read-rehearsal.js";
import { ApiError, requireIdempotencyKey } from "./api-foundation.js";
import type { ApprovalRole, CostRuleAction, ProfitService } from "./profit-service.js";
export interface ProfitRouteOptions {
  service: ProfitService;
  authorization: AuthorizationService;
  auth: LocalAuthService;
  secureCookie: boolean;
  webOrigin: string;
  accountReadRehearsal?: boolean;
}
const ids = (r: FastifyRequest) => ({
    requestId: r.headers["x-request-id"]!.toString(),
    traceId: r.headers["x-trace-id"]!.toString(),
  }),
  envelope = (data: unknown, r: FastifyRequest) => ({
    data,
    request_id: ids(r).requestId,
    trace_id: ids(r).traceId,
  });
export function registerProfitRoutes(app: FastifyInstance, o: ProfitRouteOptions) {
  const accountRuleScope = async (request: FastifyRequest) => {
    const { user } = await o.auth.authenticate(sessionToken(request, o.secureCookie));
    if (!user.email_verified_at)
      throw new ApiError(403, "account_verification_required", "账号未验证。", "先完成邮箱验证。");
    return {
      accountId: user.id,
      isPrimaryApprover: user.email_normalized === PRIMARY_COST_APPROVER_EMAIL,
    };
  };
  const scope = async (r: FastifyRequest, capability: Capability) => {
      const a = await o.auth.authenticate(sessionToken(r, o.secureCookie)),
        resolved = await o.authorization.resolveSession(a.user.id, a.session.id);
      await o.authorization.authorize({
        actorId: a.user.id,
        organizationId: resolved.context.organization_id,
        workspaceId: resolved.context.workspace_id,
        capability,
        surface: "api",
        ...ids(r),
      });
      return {
        organizationId: resolved.context.organization_id,
        workspaceId: resolved.context.workspace_id,
        actorId: a.user.id,
        roleCodes: resolved.subject.role_codes,
        isPrimaryApprover:
          a.user.email_normalized === PRIMARY_COST_APPROVER_EMAIL &&
          a.user.email_verified_at != null,
      };
    },
    write = async (r: FastifyRequest, capability: Capability) => {
      if (r.headers.origin !== o.webOrigin)
        throw new ApiError(403, "origin_forbidden", "请求来源不允许。", "从 ScoutOps 页面重试。");
      return {
        ...(await scope(r, capability)),
        ...ids(r),
        idempotencyKey: requireIdempotencyKey(r),
      };
    };
  app.get("/api/v1/cost-rules", async (r, reply) => {
    const current = o.accountReadRehearsal
      ? await accountRuleScope(r)
      : await scope(r, "opportunity:read");
    reply.header("cache-control", "private, no-store");
    const rules = await o.service.listRules(current);
    const isPrimaryApprover =
      current.isPrimaryApprover &&
      (!("accountId" in current) || (await o.service.isAccountPrimaryApprover(current.accountId)));
    return {
      ...envelope(rules, r),
      meta: { is_primary_approver: isPrimaryApprover },
    };
  });
  app.get("/api/v1/opportunities/:id/profit-analysis", async (r, reply) => {
    if (o.accountReadRehearsal) reply.header("cache-control", "private, no-store");
    const resolved = o.accountReadRehearsal
      ? await authenticatedRehearsalAccount(r, o.auth, o.secureCookie)
      : await scope(r, "opportunity:read");
    return envelope(
      await o.service.getAnalysis({
        ...resolved,
        opportunityId: (r.params as { id: string }).id,
      }),
      r,
    );
  });
  if (!o.accountReadRehearsal)
    app.get("/api/v1/cost-input-reviewers", async (r) => {
      const resolved = await scope(r, "cost:confirm");
      return envelope(await o.service.listCostReviewers(resolved), r);
    });
  app.post("/api/v1/cost-rules", async (r, reply) => {
    if (o.accountReadRehearsal) {
      reply.header("cache-control", "private, no-store");
      if (r.headers.origin !== o.webOrigin)
        throw new ApiError(403, "origin_forbidden", "请求来源不允许。", "从 ScoutOps 页面重试。");
      const account = await accountRuleScope(r);
      if (!account.isPrimaryApprover)
        throw new ApiError(
          403,
          "cost_rule_approval_role_forbidden",
          "仅主账号可创建费用规则。",
          "使用主账号登录。",
        );
      const result = await o.service.createAccountRule({
        ...ids(r),
        actorId: account.accountId,
        idempotencyKey: requireIdempotencyKey(r),
        value: r.body as any,
      });
      reply.code(201);
      return envelope(result, r);
    }
    const result = await o.service.createRule({
      ...(await write(r, "opportunity:approve")),
      value: r.body as any,
    });
    reply.code(201);
    return envelope(result, r);
  });
  app.post("/api/v1/cost-rules/:id/actions", async (r, reply) => {
    const value = r.body as {
      action: CostRuleAction;
      reason: string;
      expected_revision: number;
      approval_role?: ApprovalRole;
      target_rule_id?: string;
      selection_manager_id?: string;
    };
    if (
      o.accountReadRehearsal &&
      (value?.action === "approve" ||
        value?.action === "reject" ||
        value?.action === "publish" ||
        value?.action === "rollback" ||
        value?.action === "submit")
    ) {
      reply.header("cache-control", "private, no-store");
      const ruleId = (r.params as { id: string }).id;
      if (r.headers.origin !== o.webOrigin)
        throw new ApiError(403, "origin_forbidden", "请求来源不允许。", "从 ScoutOps 页面重试。");
      if (value.approval_role === "selection_manager") {
        const { user } = await o.auth.authenticate(sessionToken(r, o.secureCookie));
        return envelope(
          await o.service.actRule({
            ...ids(r),
            idempotencyKey: requireIdempotencyKey(r),
            actorId: user.id,
            roleCodes: [],
            accountOwnedApproval: "manager",
            ruleId,
            value,
          }),
          r,
        );
      }
      const account = await accountRuleScope(r);
      return envelope(
        await o.service.actRule({
          ...ids(r),
          idempotencyKey: requireIdempotencyKey(r),
          accountOwnedApproval: true,
          actorId: account.accountId,
          roleCodes: [],
          isPrimaryApprover: account.isPrimaryApprover,
          ruleId,
          value,
        }),
        r,
      );
    }
    if (o.accountReadRehearsal)
      throw new ApiError(
        403,
        "cost_rule_action_not_available_in_account_mode",
        "账号模式暂不支持此费用规则操作。",
        "刷新费用规则并选择可用操作。",
      );
    return envelope(
      await o.service.actRule({
        ...(await write(r, "opportunity:approve")),
        ruleId: (r.params as { id: string }).id,
        value,
      }),
      r,
    );
  });
  if (o.accountReadRehearsal) return;
  app.post("/api/v1/exchange-rates", async (r, reply) => {
    const result = await o.service.recordRate({
      ...(await write(r, "cost:confirm")),
      value: r.body as any,
    });
    reply.code(201);
    return envelope(result, r);
  });
  app.post("/api/v1/opportunities/:id/cost-inputs", async (r, reply) => {
    const result = await o.service.recordCost({
      ...(await write(r, "cost:confirm")),
      opportunityId: (r.params as { id: string }).id,
      value: r.body as any,
    });
    reply.code(201);
    return envelope(result, r);
  });
  app.post("/api/v1/opportunities/:id/cost-input-reviews/:reviewId/actions", async (r) => {
    const params = r.params as { id: string; reviewId: string };
    return envelope(
      await o.service.reviewCost({
        ...(await write(r, "cost:confirm")),
        opportunityId: params.id,
        reviewId: params.reviewId,
        value: r.body as never,
      }),
      r,
    );
  });
  app.post("/api/v1/opportunities/:id/profit-runs", async (r, reply) => {
    const result = await o.service.queue({
      ...(await write(r, "cost:confirm")),
      opportunityId: (r.params as { id: string }).id,
      value: r.body as any,
    });
    reply.code(202);
    return envelope(result, r);
  });
}
