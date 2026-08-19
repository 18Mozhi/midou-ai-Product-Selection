import type { AuthorizationService } from "@scoutops/authorization";
import type { LocalAuthService } from "@scoutops/auth";
import type { RuntimeConfig } from "@scoutops/config";
import type { FastifyInstance } from "fastify";
import type { Pool } from "mysql2/promise";

export interface ApiDomainContext {
  app: FastifyInstance;
  pool: Pool;
  config: RuntimeConfig;
  authorization: AuthorizationService;
  auth: LocalAuthService;
  secureCookie: boolean;
}

export const commonDomainOptions = (context: ApiDomainContext) => ({
  authorization: context.authorization,
  auth: context.auth,
  secureCookie: context.secureCookie,
  webOrigin: context.config.app.webOrigin,
});
