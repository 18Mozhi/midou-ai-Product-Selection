import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const failure = (code, message) => Object.assign(new Error(message), { code });

const execute = (command, args) => {
  const result = spawnSync(command, args, { encoding: "utf8", shell: false });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error,
  };
};

export const verifyPlaywrightHost = async ({
  platform = process.platform,
  env = process.env,
  assertExecutable = (path) => access(path, constants.X_OK),
  run = execute,
} = {}) => {
  const executablePath = env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim() ?? "";
  if (executablePath) {
    if (!isAbsolute(executablePath)) {
      throw failure("playwright_chromium_path_invalid", "PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH must be an absolute path");
    }
    try {
      await assertExecutable(executablePath);
    } catch {
      throw failure("playwright_chromium_unavailable", "Configured Playwright Chromium executable is not accessible");
    }
  }

  if (platform !== "linux") {
    return { status: "passed", platform, executable: executablePath ? "configured" : "playwright-managed", chineseFont: "platform-managed" };
  }

  const fonts = run("fc-list", [":lang=zh", "family", "file"]);
  if (fonts.error || fonts.status !== 0) {
    throw failure("playwright_fontconfig_unavailable", "fontconfig fc-list is required for Linux Playwright visual verification");
  }
  if (!fonts.stdout.trim()) {
    throw failure("playwright_chinese_font_missing", "A Chinese font is required for Linux Playwright visual verification");
  }
  return { status: "passed", platform, executable: executablePath ? "configured" : "playwright-managed", chineseFont: "available" };
};

const main = async () => {
  try {
    console.log(JSON.stringify(await verifyPlaywrightHost()));
  } catch (error) {
    console.error(JSON.stringify({ status: "failed", code: error.code ?? "playwright_host_preflight_failed", message: error.message }));
    process.exitCode = 1;
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
