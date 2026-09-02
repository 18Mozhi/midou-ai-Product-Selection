import { resolve } from "node:path";
import { loadRuntimeConfig } from "../packages/config/dist/index.js";
import {
  PlaywrightCrawlerEngine,
  runWithEncryptedProfile,
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
    typeof input.temp_root !== "string" ||
    typeof input.master_key !== "string" ||
    !input.credential ||
    typeof input.credential !== "object"
  )
    throw new Error("crawler_runner_input_invalid");
  const tempRoot = resolve(config.storage.credentialTempRoot),
    requestedRoot = resolve(input.temp_root);
  if (requestedRoot !== tempRoot) throw new Error("crawler_runner_temp_scope_invalid");
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
    ...(config.playwright.executablePath
      ? { executablePath: config.playwright.executablePath }
      : {}),
  };
  const engine = new PlaywrightCrawlerEngine(limits);
  const credential = input.credential;
  if (!["browser_profile", "cookie_bundle"].includes(credential.kind))
    throw new Error("crawler_runner_credential_invalid");
  const record = {
    assetId: String(credential.asset_id ?? ""),
    assetVersion: Number(credential.asset_version ?? 0),
    kind: String(credential.kind),
    keyVersion: String(credential.key_version ?? ""),
    ciphertext: Buffer.from(String(credential.ciphertext_base64 ?? ""), "base64"),
    nonce: Buffer.from(String(credential.nonce_base64 ?? ""), "base64"),
    authTag: Buffer.from(String(credential.auth_tag_base64 ?? ""), "base64"),
    fingerprint: "",
  };
  const result = await runWithEncryptedProfile(
    engine,
    record,
    input.master_key,
    tempRoot,
    {
      maxArchiveBytes: limits.maxArchiveBytes,
      maxExtractedBytes: limits.maxExtractedBytes,
      maxFiles: limits.maxArchiveFiles,
    },
    input.plan,
    ids,
    { locale: input.locale, timezoneId: input.timezone },
  );
  console.log(JSON.stringify(result));
} catch (error) {
  const candidate =
    typeof error?.code === "string"
      ? error.code
      : typeof error?.message === "string" && /^crawler_[a-z0-9_]+$/.test(error.message)
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
