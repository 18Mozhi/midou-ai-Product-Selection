import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import type { ErrorEnvelope, SuccessEnvelope } from '@scoutops/contracts';

export interface BuildAppOptions {
  version?: string;
  buildSha?: string;
  now?: () => Date;
  logger?: boolean;
  configFingerprint?: string;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? false });
  const now = options.now ?? (() => new Date());
  const version = options.version ?? process.env.APP_VERSION ?? '0.1.0';
  const buildSha = options.buildSha ?? process.env.BUILD_SHA ?? 'development';
  const configFingerprint = options.configFingerprint ?? 'not-loaded';

  app.addHook('onRequest', async (request, reply) => {
    const requestId = request.headers['x-request-id']?.toString() || randomUUID();
    const traceId = request.headers['x-trace-id']?.toString() || requestId;
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
