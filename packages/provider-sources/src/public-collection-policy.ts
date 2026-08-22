import { createHash } from "node:crypto";
import { ProviderAdapterFailure } from "@scoutops/provider-adapters";

const CRAWLER_AGENT = "ScoutOpsPublicCrawler",
  MAX_ROBOTS_BYTES = 512_000,
  cache = new Map<string, { body: string; status: number; expiresAt: number }>();
export const ROBOTS_DECISION_VERSION = "scoutops-robots-policy-v1";

export interface RobotsPolicyDecision {
  decision_version: typeof ROBOTS_DECISION_VERSION;
  allowed: boolean;
  decision_basis: "matched_rule" | "no_matching_rule" | "missing_robots" | "http_status";
  robots_url: string;
  robots_http_status: number;
  matched_user_agent: string | null;
  matched_rule: {
    directive: "allow" | "disallow";
    pattern_preview: string;
    pattern_sha256: string;
    truncated: boolean;
  } | null;
}

interface RobotsRule {
  allow: boolean;
  pattern: string;
}
interface RobotsGroup {
  agents: string[];
  rules: RobotsRule[];
}

const escapeRegex = (value: string) => value.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
const ruleRegex = (pattern: string) => {
  const anchored = pattern.endsWith("$"),
    raw = anchored ? pattern.slice(0, -1) : pattern,
    source = raw.split("*").map(escapeRegex).join(".*");
  return new RegExp(`^${source}${anchored ? "$" : ""}`);
};

export function evaluateRobotsPolicy(
  body: string,
  targetUrl: string,
  crawlerAgent = CRAWLER_AGENT,
) {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim(),
      separator = line.indexOf(":");
    if (separator < 1) continue;
    const field = line.slice(0, separator).trim().toLowerCase(),
      value = line.slice(separator + 1).trim();
    if (field === "user-agent") {
      if (!current || current.rules.length) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if ((field === "allow" || field === "disallow") && current?.agents.length) {
      if (field === "disallow" && !value) continue;
      current.rules.push({ allow: field === "allow", pattern: value });
    }
  }
  const agent = crawlerAgent.toLowerCase(),
    candidates = groups
      .map((group) => ({
        group,
        specificity: Math.max(
          ...group.agents.map((value) =>
            value === "*" ? 0 : agent.includes(value) ? value.length : -1,
          ),
        ),
      }))
      .filter((item) => item.specificity >= 0),
    specificity = Math.max(-1, ...candidates.map((item) => item.specificity)),
    path = `${new URL(targetUrl).pathname}${new URL(targetUrl).search}`,
    matched = candidates
      .filter((item) => item.specificity === specificity)
      .flatMap((item) => item.group.rules)
      .filter((rule) => ruleRegex(rule.pattern).test(path))
      .sort((left, right) => {
        const length = (value: RobotsRule) => value.pattern.replace(/[\*$]/g, "").length;
        return length(right) - length(left) || Number(right.allow) - Number(left.allow);
      });
  const rule = matched[0],
    pattern = rule?.pattern ?? "";
  return {
    allowed: rule?.allow ?? true,
    matched_user_agent: specificity > 0 ? crawlerAgent : specificity === 0 ? "*" : null,
    matched_rule: rule
      ? {
          directive: rule.allow ? ("allow" as const) : ("disallow" as const),
          pattern_preview: pattern.slice(0, 500),
          pattern_sha256: createHash("sha256").update(pattern).digest("hex"),
          truncated: pattern.length > 500,
        }
      : null,
  };
}

export const robotsAllows = (body: string, targetUrl: string, crawlerAgent = CRAWLER_AGENT) =>
  evaluateRobotsPolicy(body, targetUrl, crawlerAgent).allowed;

const policyFailure = (code: string, retryable: boolean, decision?: RobotsPolicyDecision) =>
  Object.assign(new ProviderAdapterFailure(code, retryable), {
    ...(decision ? { robotsDecision: decision } : {}),
  });

export function publicCollectionPolicyDecision(error: unknown): RobotsPolicyDecision | null {
  const decision = (error as { robotsDecision?: unknown } | null)?.robotsDecision;
  if (
    !decision ||
    typeof decision !== "object" ||
    (decision as RobotsPolicyDecision).decision_version !== ROBOTS_DECISION_VERSION
  )
    return null;
  return decision as RobotsPolicyDecision;
}

const collectionTarget = (providerTargetUrl: string, target?: Record<string, unknown>) => {
  const configured = new URL(providerTargetUrl.replace(/\{[^}]+\}/g, "policy-check")),
    requested = typeof target?.page_url === "string" ? new URL(target.page_url) : configured;
  if (requested.origin !== configured.origin)
    throw new ProviderAdapterFailure("source_configuration_invalid", false);
  return requested;
};

export async function assertPublicCollectionPolicy(input: {
  providerTargetUrl: string;
  target?: Record<string, unknown>;
  fetcher: typeof fetch;
  timeoutMs: number;
  cacheTtlMs?: number;
  cacheMaxEntries?: number;
  now?: () => number;
}) {
  let target: URL;
  try {
    target = collectionTarget(input.providerTargetUrl, input.target);
  } catch (error) {
    if (error instanceof ProviderAdapterFailure) throw error;
    throw new ProviderAdapterFailure("source_configuration_invalid", false);
  }
  const robotsUrl = `${target.origin}/robots.txt`,
    now = input.now?.() ?? Date.now(),
    cached = cache.get(robotsUrl);
  let robotsResponse =
    cached && cached.expiresAt > now ? { body: cached.body, status: cached.status } : null;
  if (robotsResponse !== null) {
    cache.delete(robotsUrl);
    cache.set(robotsUrl, cached!);
  }
  if (robotsResponse === null) {
    let response: Response;
    try {
      response = await input.fetcher(robotsUrl, {
        signal: AbortSignal.timeout(Math.min(10_000, input.timeoutMs)),
        redirect: "error",
        headers: {
          accept: "text/plain",
          "user-agent": `${CRAWLER_AGENT}/1.0`,
        },
      });
    } catch (error) {
      if (error instanceof ProviderAdapterFailure) throw error;
      throw policyFailure(
        error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network_error",
        true,
      );
    }
    if (response.status === 401 || response.status === 403)
      throw policyFailure("robots_disallowed", false, {
        decision_version: ROBOTS_DECISION_VERSION,
        allowed: false,
        decision_basis: "http_status",
        robots_url: robotsUrl,
        robots_http_status: response.status,
        matched_user_agent: null,
        matched_rule: null,
      });
    else if (response.status === 429) throw new ProviderAdapterFailure("rate_limited", true);
    else if (response.status >= 500) throw new ProviderAdapterFailure("network_error", true);
    else if (![404, 410].includes(response.status) && !response.ok)
      throw new ProviderAdapterFailure("permission_denied", false);
    let body = "";
    if (response.status !== 404 && response.status !== 410) {
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > MAX_ROBOTS_BYTES)
        throw new ProviderAdapterFailure("invalid_payload", false);
      body = new TextDecoder().decode(bytes);
    }
    robotsResponse = { body, status: response.status };
    const cacheTtlMs = input.cacheTtlMs ?? 900_000;
    const cacheMaxEntries = Math.min(10_000, Math.max(1, input.cacheMaxEntries ?? 256));
    if (cacheTtlMs > 0) {
      for (const [key, value] of cache) if (value.expiresAt <= now) cache.delete(key);
      while (cache.size >= cacheMaxEntries) {
        const oldest = cache.keys().next().value;
        if (oldest === undefined) break;
        cache.delete(oldest);
      }
      cache.set(robotsUrl, { ...robotsResponse, expiresAt: now + cacheTtlMs });
    }
  }
  const evaluated = evaluateRobotsPolicy(robotsResponse.body, target.toString()),
    decision: RobotsPolicyDecision = {
      decision_version: ROBOTS_DECISION_VERSION,
      allowed: evaluated.allowed,
      decision_basis:
        robotsResponse.status === 404 || robotsResponse.status === 410
          ? "missing_robots"
          : evaluated.matched_rule
            ? "matched_rule"
            : "no_matching_rule",
      robots_url: robotsUrl,
      robots_http_status: robotsResponse.status,
      matched_user_agent: evaluated.matched_user_agent,
      matched_rule: evaluated.matched_rule,
    };
  if (!decision.allowed) throw policyFailure("robots_disallowed", false, decision);
  return decision;
}
