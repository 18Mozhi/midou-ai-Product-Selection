import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import type { ErrorEnvelope, SuccessEnvelope } from '@scoutops/contracts';
import { ApiError, normalizeCorrelationId, type ReadinessCheck } from './api-foundation.js';
import { AuthError, authErrorMessage } from '@scoutops/auth';
import { registerLocalAuthRoutes, type LocalAuthRouteOptions } from './auth-routes.js';
import { TenancyError } from '@scoutops/tenancy';
import { registerTenancyRoutes, type TenancyRouteOptions } from './tenancy-routes.js';

export interface BuildAppOptions {
  version?: string;
  buildSha?: string;
  now?: () => Date;
  logger?: boolean;
  configFingerprint?: string;
  readinessChecks?: ReadinessCheck[];
  localAuth?: LocalAuthRouteOptions;
  tenancy?: TenancyRouteOptions;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? false });
  const now = options.now ?? (() => new Date());
  const version = options.version ?? process.env.APP_VERSION ?? '0.1.0';
  const buildSha = options.buildSha ?? process.env.BUILD_SHA ?? 'development';
  const configFingerprint = options.configFingerprint ?? 'not-loaded';

  app.addHook('onRequest', async (request, reply) => {
    const requestId = normalizeCorrelationId(request.headers['x-request-id'], randomUUID);
    const traceId = normalizeCorrelationId(request.headers['x-trace-id'], () => requestId);
    request.headers['x-request-id'] = requestId;
    request.headers['x-trace-id'] = traceId;
    reply.header('x-request-id', requestId).header('x-trace-id', traceId);
  });

  app.get('/api/v1/health/live', async (request): Promise<SuccessEnvelope<{
    status: 'ok';
    service: 'product-scout-api';
    version: string;
    build_sha: string;
  }>> => {
    const requestId = request.headers['x-request-id']!.toString();
    const traceId = request.headers['x-trace-id']!.toString();
    return {
      data: {
        status: 'ok',
        service: 'product-scout-api',
        version,
        build_sha: buildSha,
      },
      meta: { observed_at: now().toISOString() },
      request_id: requestId,
      trace_id: traceId,
    };
  });

  app.get('/api/v1/health/version', async (request): Promise<SuccessEnvelope<{
    version: string; build_sha: string; config_fingerprint: string;
  }>> => ({
    data: { version, build_sha: buildSha, config_fingerprint: configFingerprint },
    request_id: request.headers['x-request-id']!.toString(),
    trace_id: request.headers['x-trace-id']!.toString(),
  }));

  app.get('/api/v1/health/ready', async (request, reply): Promise<SuccessEnvelope<{
    status:'ready';dependencies:{mysql:'available';redis:'available'}
  }> | ErrorEnvelope> => {
    const requestId=request.headers['x-request-id']!.toString();const traceId=request.headers['x-trace-id']!.toString();
    const checks=options.readinessChecks??[];const results=await Promise.all(checks.map(async item=>[item.name,await item.check(requestId,traceId)] as const));
    const dependencies=Object.fromEntries(results) as Partial<Record<'mysql'|'redis','available'|'unavailable'>>;
    if(dependencies.mysql!=='available'||dependencies.redis!=='available'){
      reply.code(503);return{error:{code:'dependency_unavailable',message:'API 依赖暂不可用。',action_hint:'稍后重试；运维人员在宝塔检查 MySQL 与 Redis。'},request_id:requestId,trace_id:traceId};
    }
    return{data:{status:'ready',dependencies:{mysql:'available',redis:'available'}},meta:{observed_at:now().toISOString()},request_id:requestId,trace_id:traceId};
  });

  if (options.localAuth) registerLocalAuthRoutes(app, options.localAuth);
  if (options.tenancy) registerTenancyRoutes(app, options.tenancy);

  app.setErrorHandler(async (error: FastifyError | ApiError, request, reply): Promise<ErrorEnvelope> => {
    const requestId=request.headers['x-request-id']!.toString();const traceId=request.headers['x-trace-id']!.toString();
    const apiError=error instanceof ApiError?error as ApiError:null;const authError=error instanceof AuthError?error as AuthError:null;const tenancyError=error instanceof TenancyError?error as TenancyError:null;const validation='validation' in error&&Boolean(error.validation);
    const statusCode=apiError?.statusCode??authError?.statusCode??tenancyError?.statusCode??(validation?400:500);reply.code(statusCode);
    const tenancyMessages:Record<string,string>={organization_forbidden:'无权访问该组织。',workspace_not_found:'工作区不存在。',workspace_archived:'工作区已归档。',organization_slug_conflict:'组织标识已存在。'};
    return{error:{code:apiError?.code??authError?.code??tenancyError?.code??(validation?'schema_validation_failed':'internal_error'),message:apiError?.message??(authError?authErrorMessage(authError.code):tenancyError?tenancyMessages[tenancyError.code]??'租户请求无法处理。':validation?'请求字段不符合接口合同。':'服务暂时无法处理请求。'),action_hint:apiError?.actionHint??authError?.actionHint??tenancyError?.actionHint??(validation?'按 OpenAPI 修正字段后重试。':'携带 request_id 联系管理员。')},request_id:requestId,trace_id:traceId};
  });

  app.setNotFoundHandler(async (request, reply): Promise<ErrorEnvelope> => {
    const requestId = request.headers['x-request-id']!.toString();
    const traceId = request.headers['x-trace-id']!.toString();
    reply.code(404);
    return {
      error: {
        code: 'route_not_found',
        message: '请求的接口不存在。',
        action_hint: '检查 API 版本和路径后重试。',
      },
      request_id: requestId,
      trace_id: traceId,
    };
  });

  return app;
}
