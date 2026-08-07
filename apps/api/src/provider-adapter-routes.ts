import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { LocalAuthService } from '@scoutops/auth';
import type { AuthorizationService } from '@scoutops/authorization';
import type { ProviderAdapterService } from './provider-adapter-service.js';
import { sessionToken } from './auth-routes.js';
import { ApiError, requireIdempotencyKey } from './api-foundation.js';

export interface ProviderAdapterRouteOptions { service: ProviderAdapterService; authorization: AuthorizationService; auth: LocalAuthService; secureCookie: boolean; webOrigin: string; }
const ids = (request: FastifyRequest) => ({ requestId: request.headers['x-request-id']!.toString(), traceId: request.headers['x-trace-id']!.toString() });
const envelope = (data: unknown, request: FastifyRequest) => ({ data, request_id: ids(request).requestId, trace_id: ids(request).traceId });

export function registerProviderAdapterRoutes(app: FastifyInstance, options: ProviderAdapterRouteOptions) {
  const actor = async (request: FastifyRequest) => {
    const authenticated = await options.auth.authenticate(sessionToken(request, options.secureCookie));
    await options.authorization.authorize({ actorId: authenticated.user.id, capability: 'provider:configure', surface: 'api', ...ids(request) });
    return authenticated.user.id;
  };
  app.get('/api/v1/platform/provider-adapters', async (request, reply) => {
    await actor(request);
    reply.header('cache-control', 'private, no-store');
    return envelope(await options.service.list(), request);
  });
  app.post('/api/v1/platform/provider-adapters/:providerId/health-check', async request => {
    if (request.headers.origin !== options.webOrigin) throw new ApiError(403, 'origin_forbidden', '请求来源不允许。', '从 ScoutOps 页面重试。');
    const actorId = await actor(request);
    const providerId = (request.params as { providerId: string }).providerId;
    return envelope(await options.service.probe(providerId, { actorId, idempotencyKey: requireIdempotencyKey(request), ...ids(request) }), request);
  });
}
