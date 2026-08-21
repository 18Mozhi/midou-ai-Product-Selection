import { ProviderAdapterFailure } from "@scoutops/provider-adapters";

const CRAWLER_AGENT = "ScoutOpsPublicCrawler",
  MAX_ROBOTS_BYTES = 512_000,
  cache = new Map<string, { body: string; expiresAt: number }>();

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

export function robotsAllows(body: string, targetUrl: string, crawlerAgent = CRAWLER_AGENT) {
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
  return matched[0]?.allow ?? true;
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
  let body = cached && cached.expiresAt > now ? cached.body : null;
  if (body !== null) {
    cache.delete(robotsUrl);
    cache.set(robotsUrl, cached!);
  }
  if (body === null) {
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
      throw new ProviderAdapterFailure(
        error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network_error",
        true,
      );
    }
    if (response.status === 404 || response.status === 410) body = "";
    else if (response.status === 401 || response.status === 403)
      throw new ProviderAdapterFailure("robots_disallowed", false);
    else if (response.status === 429) throw new ProviderAdapterFailure("rate_limited", true);
    else if (response.status >= 500) throw new ProviderAdapterFailure("network_error", true);
    else if (!response.ok) throw new ProviderAdapterFailure("permission_denied", false);
    else {
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > MAX_ROBOTS_BYTES)
        throw new ProviderAdapterFailure("invalid_payload", false);
      body = new TextDecoder().decode(bytes);
    }
    const cacheTtlMs = input.cacheTtlMs ?? 900_000;
    const cacheMaxEntries = Math.min(10_000, Math.max(1, input.cacheMaxEntries ?? 256));
    if (cacheTtlMs > 0) {
      for (const [key, value] of cache) if (value.expiresAt <= now) cache.delete(key);
      while (cache.size >= cacheMaxEntries) {
        const oldest = cache.keys().next().value;
        if (oldest === undefined) break;
        cache.delete(oldest);
      }
      cache.set(robotsUrl, { body, expiresAt: now + cacheTtlMs });
    }
  }
  if (!robotsAllows(body, target.toString()))
    throw new ProviderAdapterFailure("robots_disallowed", false);
}
