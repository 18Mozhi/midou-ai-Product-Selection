import { access } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { loadRuntimeConfig } from "../packages/config/dist/index.js";
import {
  PlaywrightCrawlerEngine,
  withCookieProfileFile,
  withExtractedProfileArchive,
} from "../packages/playwright-crawler/dist/index.js";

const chunks = [];
let size = 0;
for await (const chunk of process.stdin) {
  size += chunk.length;
  if (size > 1048576) {
    console.log(JSON.stringify({ code: "crawler_runner_input_too_large" }));
    process.exit(2);
  }
  chunks.push(chunk);
}
let input;
try {
  input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
} catch {
  console.log(JSON.stringify({ code: "crawler_runner_input_invalid" }));
  process.exit(2);
}
const config = loadRuntimeConfig(process.env, "worker");
const ids = {
  requestId: String(input.request_id ?? ""),
  traceId: String(input.trace_id ?? ""),
};
try {
  if (
    !ids.requestId ||
    !ids.traceId ||
    typeof input.archive_path !== "string" ||
    typeof input.temp_root !== "string"
  )
    throw new Error("crawler_runner_input_invalid");
  const tempRoot = resolve(config.storage.credentialTempRoot),
    requestedRoot = resolve(input.temp_root),
    archivePath = resolve(input.archive_path);
  if (
    requestedRoot !== tempRoot ||
    !archivePath.startsWith(`${tempRoot}${sep}`)
  )
    throw new Error("crawler_runner_temp_scope_invalid");
  await access(archivePath);
  const limits = {
    navigationTimeoutMs: config.playwright.navigationTimeoutMs,
    actionTimeoutMs: config.playwright.actionTimeoutMs,
    maxPages: config.playwright.maxPages,
    maxScrolls: config.playwright.maxScrolls,
    maxDetails: config.playwright.maxDetails,
    maxArchiveBytes: config.playwright.maxArchiveBytes,
    maxExtractedBytes: config.playwright.maxExtractedBytes,
    maxArchiveFiles: config.playwright.maxArchiveFiles,
    headless: config.playwright.headless,
  };
  const engine = new PlaywrightCrawlerEngine(limits);
  const run = (directory, cookies) =>
    engine.run(input.plan, directory, ids, {
      locale: input.locale,
      timezoneId: input.timezone,
      ...(cookies ? { cookies } : {}),
    });
  const result =
    input.credential_kind === "cookie_bundle"
      ? await withCookieProfileFile(archivePath, tempRoot, run)
      : await withExtractedProfileArchive(
          archivePath,
          tempRoot,
          {
            maxArchiveBytes: limits.maxArchiveBytes,
            maxExtractedBytes: limits.maxExtractedBytes,
            maxFiles: limits.maxArchiveFiles,
          },
          (directory) => run(directory),
        );
  console.log(JSON.stringify(result));
} catch (error) {
  const candidate =
    typeof error?.code === "string"
      ? error.code
      : typeof error?.message === "string" &&
          /^crawler_[a-z0-9_]+$/.test(error.message)
        ? error.message
        : "crawler_runner_failed";
  console.log(
    JSON.stringify({
      code: candidate,
      request_id: ids.requestId,
      trace_id: ids.traceId,
    }),
  );
  process.exitCode = 2;
}
