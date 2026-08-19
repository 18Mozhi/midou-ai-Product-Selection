import { createHash, randomUUID } from "node:crypto";
import { gunzipSync } from "node:zlib";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, join, posix, resolve, sep } from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";
import {
  withMaterializedCredential,
  type CredentialCipherRecord,
} from "@scoutops/credentials";

export type BrowserRunStatus =
  | "succeeded"
  | "succeeded_empty"
  | "blocked_login"
  | "blocked_captcha"
  | "blocked_robots"
  | "rate_limited"
  | "timeout"
  | "parser_changed"
  | "dependency_failed";
export interface BrowserBlockSignals {
  login?: string;
  captcha?: string;
  robots?: string;
}
export interface BrowserCollectionPlan {
  start_url: string;
  allowed_origins: string[];
  search?: { input_selector: string; query: string; submit_selector?: string };
  item_selector: string;
  next_page_selector?: string;
  detail_link_selector?: string;
  max_pages: number;
  max_scrolls: number;
  max_details: number;
  block_signals?: BrowserBlockSignals;
}
export interface BrowserRuntimeLimits {
  navigationTimeoutMs: number;
  actionTimeoutMs: number;
  maxPages: number;
  maxScrolls: number;
  maxDetails: number;
  maxArchiveBytes: number;
  maxExtractedBytes: number;
  maxArchiveFiles: number;
  headless: boolean;
}
export interface BrowserRunResult {
  status: BrowserRunStatus;
  page_count: number;
  item_count: number;
  detail_count: number;
  duration_ms: number;
  error_code: string | null;
  request_id: string;
  trace_id: string;
}
export type BrowserCookie = Parameters<BrowserContext["addCookies"]>[0][number];

export class PlaywrightCrawlerError extends Error {
  constructor(
    readonly code: string,
    readonly status: BrowserRunStatus,
    readonly retryable: boolean,
  ) {
    super(code);
    this.name = "PlaywrightCrawlerError";
  }
}
const selector = (value: unknown) =>
    typeof value === "string" && value.trim().length > 0 && value.length <= 500,
  value = (input: unknown, max: number) =>
    typeof input === "string" && input.length > 0 && input.length <= max;
function httpUrl(input: string) {
  try {
    const url = new URL(input);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw new Error();
    return url;
  } catch {
    throw new PlaywrightCrawlerError(
      "crawler_url_invalid",
      "parser_changed",
      false,
    );
  }
}
export function validateBrowserPlan(
  input: BrowserCollectionPlan,
  limits: BrowserRuntimeLimits,
): BrowserCollectionPlan {
  if (!input || typeof input !== "object")
    throw new PlaywrightCrawlerError(
      "crawler_plan_invalid",
      "parser_changed",
      false,
    );
  const start = httpUrl(input.start_url),
    origins = [...new Set(input.allowed_origins ?? [])];
  if (
    !origins.length ||
    origins.length > 20 ||
    origins.some((origin) => httpUrl(origin).origin !== origin) ||
    !origins.includes(start.origin)
  )
    throw new PlaywrightCrawlerError(
      "crawler_origin_invalid",
      "parser_changed",
      false,
    );
  for (const [key, current, max] of [
    ["max_pages", input.max_pages, limits.maxPages],
    ["max_scrolls", input.max_scrolls, limits.maxScrolls],
    ["max_details", input.max_details, limits.maxDetails],
  ] as const)
    if (
      !Number.isSafeInteger(current) ||
      current < 0 ||
      current > max ||
      (key === "max_pages" && current < 1)
    )
      throw new PlaywrightCrawlerError(
        `crawler_${key}_invalid`,
        "parser_changed",
        false,
      );
  if (
    !selector(input.item_selector) ||
    (input.next_page_selector && !selector(input.next_page_selector)) ||
    (input.detail_link_selector && !selector(input.detail_link_selector))
  )
    throw new PlaywrightCrawlerError(
      "crawler_selector_invalid",
      "parser_changed",
      false,
    );
  if (
    input.search &&
    (!selector(input.search.input_selector) ||
      !value(input.search.query, 500) ||
      (input.search.submit_selector && !selector(input.search.submit_selector)))
  )
    throw new PlaywrightCrawlerError(
      "crawler_search_invalid",
      "parser_changed",
      false,
    );
  for (const signal of Object.values(input.block_signals ?? {}))
    if (signal && !selector(signal))
      throw new PlaywrightCrawlerError(
        "crawler_block_signal_invalid",
        "parser_changed",
        false,
      );
  return { ...input, allowed_origins: origins };
}
export function classifyBrowserFailure(error: unknown): {
  status: BrowserRunStatus;
  code: string;
  retryable: boolean;
} {
  if (error instanceof PlaywrightCrawlerError)
    return {
      status: error.status,
      code: error.code,
      retryable: error.retryable,
    };
  if (error instanceof Error && /Timeout/i.test(error.name + error.message))
    return { status: "timeout", code: "timeout", retryable: true };
  return {
    status: "dependency_failed",
    code: "dependency_unavailable",
    retryable: true,
  };
}

async function blocked(page: Page, signals: BrowserBlockSignals | undefined) {
  for (const [key, status] of [
    ["login", "blocked_login"],
    ["captcha", "blocked_captcha"],
    ["robots", "blocked_robots"],
  ] as const) {
    const css = signals?.[key];
    if (css && (await page.locator(css).count()))
      throw new PlaywrightCrawlerError(status, status, false);
  }
}
export class PlaywrightCrawlerEngine {
  constructor(private readonly limits: BrowserRuntimeLimits) {}
  async run(
    planInput: BrowserCollectionPlan,
    userDataDir: string,
    ids: { requestId: string; traceId: string },
    options: {
      locale?: string;
      timezoneId?: string;
      cookies?: BrowserCookie[];
    } = {},
  ): Promise<BrowserRunResult> {
    const plan = validateBrowserPlan(planInput, this.limits),
      started = Date.now();
    let context: BrowserContext | undefined,
      rateLimited = false,
      pageCount = 0,
      itemCount = 0,
      detailCount = 0;
    try {
      context = await chromium.launchPersistentContext(userDataDir, {
        headless: this.limits.headless,
        ...(options.locale ? { locale: options.locale } : {}),
        ...(options.timezoneId ? { timezoneId: options.timezoneId } : {}),
      });
      if (options.cookies?.length) await context.addCookies(options.cookies);
      context.setDefaultTimeout(this.limits.actionTimeoutMs);
      context.setDefaultNavigationTimeout(this.limits.navigationTimeoutMs);
      context.on("response", (response) => {
        if (response.status() === 429) rateLimited = true;
      });
      const page = context.pages()[0] ?? (await context.newPage());
      await this.goto(page, plan.start_url, plan.allowed_origins);
      await blocked(page, plan.block_signals);
      if (plan.search) {
        await page.locator(plan.search.input_selector).fill(plan.search.query);
        if (plan.search.submit_selector)
          await page.locator(plan.search.submit_selector).click();
        else await page.locator(plan.search.input_selector).press("Enter");
        await page.waitForLoadState("domcontentloaded").catch(() => {});
        if (!plan.allowed_origins.includes(httpUrl(page.url()).origin))
          throw new PlaywrightCrawlerError(
            "crawler_origin_forbidden",
            "parser_changed",
            false,
          );
        await blocked(page, plan.block_signals);
      }
      for (let index = 0; index < plan.max_pages; index += 1) {
        if (rateLimited)
          throw new PlaywrightCrawlerError(
            "rate_limited",
            "rate_limited",
            true,
          );
        await blocked(page, plan.block_signals);
        pageCount += 1;
        itemCount += await page.locator(plan.item_selector).count();
        for (let scroll = 0; scroll < plan.max_scrolls; scroll += 1) {
          await page.evaluate(() =>
            window.scrollBy(0, Math.max(window.innerHeight, 600)),
          );
          await page.waitForTimeout(25);
        }
        if (plan.detail_link_selector && detailCount < plan.max_details) {
          const hrefs = await page
            .locator(plan.detail_link_selector)
            .evaluateAll(
              (nodes, cap) =>
                nodes
                  .slice(0, Number(cap))
                  .map((node) => (node as HTMLAnchorElement).href),
              plan.max_details - detailCount,
            );
          for (const href of hrefs) {
            if (detailCount >= plan.max_details) break;
            const detail = httpUrl(href);
            if (!plan.allowed_origins.includes(detail.origin)) continue;
            const detailPage = await context.newPage();
            try {
              await this.goto(
                detailPage,
                detail.toString(),
                plan.allowed_origins,
              );
              await blocked(detailPage, plan.block_signals);
              detailCount += 1;
            } finally {
              await detailPage.close();
            }
          }
        }
        if (!plan.next_page_selector || index + 1 >= plan.max_pages) break;
        const next = page.locator(plan.next_page_selector);
        if (
          !(await next.count()) ||
          (await next.isDisabled().catch(() => false))
        )
          break;
        await next.click();
        await page.waitForLoadState("domcontentloaded").catch(() => {});
        if (!plan.allowed_origins.includes(httpUrl(page.url()).origin))
          throw new PlaywrightCrawlerError(
            "crawler_origin_forbidden",
            "parser_changed",
            false,
          );
      }
      return {
        status: itemCount ? "succeeded" : "succeeded_empty",
        page_count: pageCount,
        item_count: itemCount,
        detail_count: detailCount,
        duration_ms: Date.now() - started,
        error_code: null,
        request_id: ids.requestId,
        trace_id: ids.traceId,
      };
    } catch (error) {
      const failure = classifyBrowserFailure(error);
      return {
        status: failure.status,
        page_count: pageCount,
        item_count: itemCount,
        detail_count: detailCount,
        duration_ms: Date.now() - started,
        error_code: failure.code,
        request_id: ids.requestId,
        trace_id: ids.traceId,
      };
    } finally {
      await context?.close().catch(() => {});
    }
  }
  private async goto(page: Page, target: string, origins: string[]) {
    const url = httpUrl(target);
    if (!origins.includes(url.origin))
      throw new PlaywrightCrawlerError(
        "crawler_origin_forbidden",
        "parser_changed",
        false,
      );
    const response = await page.goto(url.toString(), {
      waitUntil: "domcontentloaded",
    });
    if (!origins.includes(httpUrl(page.url()).origin))
      throw new PlaywrightCrawlerError(
        "crawler_origin_forbidden",
        "parser_changed",
        false,
      );
    if (response?.status() === 429)
      throw new PlaywrightCrawlerError("rate_limited", "rate_limited", true);
  }
}

export interface ProfileArchiveLimits {
  maxArchiveBytes: number;
  maxExtractedBytes: number;
  maxFiles: number;
}
export async function withExtractedProfileArchive<T>(
  archivePath: string,
  tempRoot: string,
  limits: ProfileArchiveLimits,
  use: (userDataDir: string) => Promise<T>,
): Promise<T> {
  const root = resolve(tempRoot);
  if (root === resolve(sep))
    throw new PlaywrightCrawlerError(
      "profile_temp_scope_invalid",
      "dependency_failed",
      false,
    );
  await mkdir(root, { recursive: true, mode: 0o700 });
  const directory = await mkdtemp(join(root, "playwright-profile-"));
  if (!resolve(directory).startsWith(`${root}${sep}`))
    throw new PlaywrightCrawlerError(
      "profile_temp_scope_invalid",
      "dependency_failed",
      false,
    );
  let compressed: Buffer | undefined, tar: Buffer | undefined;
  try {
    const stat = await import("node:fs/promises").then((module) =>
      module.stat(archivePath),
    );
    if (stat.size > limits.maxArchiveBytes)
      throw new PlaywrightCrawlerError(
        "profile_archive_too_large",
        "dependency_failed",
        false,
      );
    compressed = await readFile(archivePath);
    try {
      tar = gunzipSync(compressed, {
        maxOutputLength: limits.maxExtractedBytes,
      });
    } catch {
      throw new PlaywrightCrawlerError(
        "profile_archive_invalid",
        "dependency_failed",
        false,
      );
    }
    let offset = 0,
      total = 0,
      files = 0;
    while (offset + 512 <= tar.length) {
      const header = tar.subarray(offset, offset + 512);
      if (header.every((byte) => byte === 0)) break;
      const name = header
          .subarray(0, 100)
          .toString("utf8")
          .replace(/\0.*$/, ""),
        prefix = header
          .subarray(345, 500)
          .toString("utf8")
          .replace(/\0.*$/, ""),
        relative = prefix ? `${prefix}/${name}` : name,
        type = String.fromCharCode(header[156] || 48),
        sizeText = header
          .subarray(124, 136)
          .toString("ascii")
          .replace(/\0.*$/, "")
          .trim(),
        size = parseInt(sizeText || "0", 8);
      if (
        !relative ||
        isAbsolute(relative) ||
        relative.includes("\\") ||
        posix.normalize(relative).startsWith("../") ||
        posix.normalize(relative) === ".." ||
        !Number.isSafeInteger(size) ||
        size < 0 ||
        !["0", "5"].includes(type)
      )
        throw new PlaywrightCrawlerError(
          "profile_archive_traversal_or_type",
          "dependency_failed",
          false,
        );
      files += 1;
      total += size;
      if (files > limits.maxFiles || total > limits.maxExtractedBytes)
        throw new PlaywrightCrawlerError(
          "profile_archive_limit_exceeded",
          "dependency_failed",
          false,
        );
      const target = resolve(
        directory,
        ...posix.normalize(relative).split("/"),
      );
      if (!target.startsWith(`${resolve(directory)}${sep}`))
        throw new PlaywrightCrawlerError(
          "profile_archive_traversal_or_type",
          "dependency_failed",
          false,
        );
      if (type === "5") await mkdir(target, { recursive: true, mode: 0o700 });
      else {
        await mkdir(dirname(target), { recursive: true, mode: 0o700 });
        await writeFile(
          target,
          tar.subarray(offset + 512, offset + 512 + size),
          { mode: 0o600, flag: "wx" },
        );
      }
      offset += 512 + Math.ceil(size / 512) * 512;
    }
    await chmod(directory, 0o700);
    return await use(directory);
  } finally {
    compressed?.fill(0);
    tar?.fill(0);
    await rm(directory, { recursive: true, force: true });
  }
}
export function hashLeaseToken(token: string) {
  return createHash("sha256")
    .update("scoutops:crawler-lease:v1\0")
    .update(token)
    .digest("hex");
}
export function createLeaseToken() {
  return { id: randomUUID(), token: randomUUID() + randomUUID() };
}
export function parseCookieBundle(value: string): BrowserCookie[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new PlaywrightCrawlerError(
      "cookie_bundle_invalid",
      "dependency_failed",
      false,
    );
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    (parsed as { format?: unknown }).format !== "scoutops-cookie-bundle-v1" ||
    !Array.isArray((parsed as { cookies?: unknown }).cookies)
  )
    throw new PlaywrightCrawlerError(
      "cookie_bundle_invalid",
      "dependency_failed",
      false,
    );
  const cookies = (parsed as { cookies: BrowserCookie[] }).cookies;
  if (!cookies.length || cookies.length > 500)
    throw new PlaywrightCrawlerError(
      "cookie_bundle_invalid",
      "dependency_failed",
      false,
    );
  return cookies;
}
export async function withCookieProfileFile<T>(
  cookiePath: string,
  tempRoot: string,
  use: (userDataDir: string, cookies: BrowserCookie[]) => Promise<T>,
) {
  const root = resolve(tempRoot);
  await mkdir(root, { recursive: true, mode: 0o700 });
  const directory = await mkdtemp(join(root, "playwright-cookie-profile-"));
  try {
    const content = await readFile(cookiePath, "utf8");
    return await use(directory, parseCookieBundle(content));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
export async function runWithEncryptedProfile(
  engine: PlaywrightCrawlerEngine,
  record: CredentialCipherRecord,
  masterKey: string,
  tempRoot: string,
  archiveLimits: ProfileArchiveLimits,
  plan: BrowserCollectionPlan,
  ids: { requestId: string; traceId: string },
  options: { locale?: string; timezoneId?: string } = {},
) {
  return withMaterializedCredential(
    record,
    masterKey,
    tempRoot,
    (archivePath) =>
      record.kind === "cookie_bundle"
        ? withCookieProfileFile(archivePath, tempRoot, (userDataDir, cookies) =>
            engine.run(plan, userDataDir, ids, { ...options, cookies }),
          )
        : withExtractedProfileArchive(
            archivePath,
            tempRoot,
            archiveLimits,
            (userDataDir) => engine.run(plan, userDataDir, ids, options),
          ),
  );
}
