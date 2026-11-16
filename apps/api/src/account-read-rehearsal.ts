import type { FastifyRequest } from "fastify";
import { PRIMARY_COST_APPROVER_EMAIL, type LocalAuthService } from "@scoutops/auth";
import { AuthorizationError, AuthorizationService } from "@scoutops/authorization";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { assertAccountCutoverReady } from "@scoutops/database";
import { ApiError } from "./api-foundation.js";
import { sessionToken } from "./auth-routes.js";

export type AccountReadScope = { accountId: string };

export function requireCrawlerWritesEnabled(accountReadRehearsal?: boolean) {
  if (accountReadRehearsal)
    throw new ApiError(
      403,
      "crawler_writes_disabled_in_account_rehearsal",
      "账号迁移演练库禁止执行或恢复采集任务。",
      "不要将常驻 Crawler 连接到演练 API。",
    );
}

export function retiredLegacyTenancyError() {
  return new AuthorizationError(
    "legacy_tenancy_retired_in_rehearsal",
    403,
    "账号演练不使用组织或工作区，请返回选品库。",
  );
}

// Account routes use the verified account directly. Legacy-only handlers cannot fall back to an
// existing org/workspace session. Inherited platform-role authorization remains unchanged.
export class AccountRehearsalAuthorizationService extends AuthorizationService {
  protected override async findNavigationContext() {
    return null;
  }

  override async resolveSession(
    _actorId: string,
    _sessionId: string,
  ): ReturnType<AuthorizationService["resolveSession"]> {
    throw retiredLegacyTenancyError();
  }
}

// All SQL fragments are fixed source/alias expressions chosen by repositories, never request input.
export const rehearsalOwns = (source: string, rowId: string, account: string) =>
  `EXISTS (SELECT 1 FROM account_owned_records ra WHERE ra.source_table='${source}' AND ra.source_id=${rowId} AND ra.account_id=${account})`;

export function shouldUseAccountReadRehearsal(config: {
  nodeEnv: string;
  app: { host: string };
  database: { name: string; host: string; readHost?: string; writeHost?: string };
}) {
  return (
    (config.nodeEnv === "development" || config.nodeEnv === "test") &&
    config.app.host === "127.0.0.1" &&
    config.database.host === "127.0.0.1" &&
    !config.database.readHost &&
    !config.database.writeHost &&
    /^product_scout_[a-z0-9_]*rehearsal$/.test(config.database.name)
  );
}

type AccountApiConfig = Parameters<typeof shouldUseAccountReadRehearsal>[0] & {
  app: { accountScopeMode?: "retired" };
  database: { user?: string };
};

export async function resolveAccountApiMode(config: AccountApiConfig, db: Pick<Pool, "query">) {
  if (config.app.accountScopeMode !== "retired")
    return shouldUseAccountReadRehearsal(config) ? "rehearsal" : "legacy";
  await assertAccountCutoverReady(config, db, PRIMARY_COST_APPROVER_EMAIL);
  return "retired";
}

export async function authenticatedRehearsalAccount(
  request: FastifyRequest,
  auth: LocalAuthService,
  secureCookie: boolean,
): Promise<AccountReadScope> {
  const { user } = await auth.authenticate(sessionToken(request, secureCookie));
  if (!user.email_verified_at)
    throw new ApiError(403, "account_verification_required", "账号未验证。", "先完成邮箱验证。");
  return { accountId: user.id };
}

export async function requireAccountReadRehearsal(
  pool: Pick<Pool, "query">,
  options?: { lockForTransaction: true },
) {
  try {
    const [receipt] = await pool.query<RowDataPacket[]>(
      "SELECT slot FROM account_ownership_cutover WHERE slot='current' AND contract_version=25 LIMIT 1" +
        (options?.lockForTransaction ? " LOCK IN SHARE MODE" : ""),
    );
    if (receipt.length) return;
  } catch (error) {
    if (
      !["ER_NO_SUCH_TABLE", "ER_BAD_FIELD_ERROR"].includes((error as { code?: string }).code ?? "")
    )
      throw error;
  }
  throw new ApiError(
    503,
    "account_ownership_not_ready",
    "账号归属尚未就绪。",
    "先在隔离副本完成账号归属回填。",
  );
}
