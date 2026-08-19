import type { FastifyInstance, FastifyRequest } from "fastify";
import type { LocalAuthService } from "@scoutops/auth";
import type { AuthorizationService } from "@scoutops/authorization";
import { sessionToken } from "./auth-routes.js";
import { ApiError, requireIdempotencyKey } from "./api-foundation.js";
import type { ErpProductImportService } from "./erp-product-import-service.js";

export interface ErpProductImportRouteOptions {
  service: ErpProductImportService;
  authorization: AuthorizationService;
  auth: LocalAuthService;
  secureCookie: boolean;
  webOrigin: string;
}

export function registerErpProductImportRoutes(
  app: FastifyInstance,
  options: ErpProductImportRouteOptions,
) {
  const ids = (request: FastifyRequest) => ({
    requestId: request.headers["x-request-id"]!.toString(),
    traceId: request.headers["x-trace-id"]!.toString(),
  });
  app.post(
    "/api/v1/imports/erp-products",
    { bodyLimit: 25_000_000 },
    async (request, reply) => {
      if (request.headers.origin !== options.webOrigin)
        throw new ApiError(
          403,
          "origin_forbidden",
          "请求来源不允许。",
          "从 ai选品 的选品机会页面重试。",
        );
      const authenticated = await options.auth.authenticate(
        sessionToken(request, options.secureCookie),
      );
      const resolved = await options.authorization.resolveSession(
        authenticated.user.id,
        authenticated.session.id,
      );
      await options.authorization.authorize({
        actorId: authenticated.user.id,
        organizationId: resolved.context.organization_id,
        workspaceId: resolved.context.workspace_id,
        capability: "opportunity:decide",
        surface: "api",
        ...ids(request),
      });
      try {
        const data = await options.service.import(request.body as any, {
          organizationId: resolved.context.organization_id,
          workspaceId: resolved.context.workspace_id,
          actorId: authenticated.user.id,
          idempotencyKey: requireIdempotencyKey(request),
          ...ids(request),
        });
        reply.code(201).header("cache-control", "private, no-store");
        return {
          data,
          request_id: ids(request).requestId,
          trace_id: ids(request).traceId,
        };
      } catch (error) {
        const code =
          error instanceof Error ? error.message : "erp_product_import_failed";
        const hints: Record<string, string> = {
          erp_product_source_invalid: "只允许从已确认的米豆 ERP 商品列表导入。",
          erp_product_import_invalid: "ERP 商品列表需包含 1–500 条有效商品。",
          erp_product_row_invalid: "ERP 商品缺少标题、SPU/记录编号或更新时间。",
          erp_product_provider_unavailable:
            "等待平台同步并启用米豆 ERP 商品库来源。",
          erp_product_row_too_large: "单个 ERP 商品原始记录超过证据大小限制。",
        };
        if (!hints[code]) throw error;
        throw new ApiError(400, code, "ERP 商品导入失败。", hints[code]);
      }
    },
  );
}
