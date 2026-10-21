import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  lstat,
  writeFile,
  open,
} from "node:fs/promises";
import { join } from "node:path";
import type { Page } from "playwright";

export const HANDOFF_TTL_MS = 300_000;
export const handoffIdValid = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
export interface HandoffInfo {
  id: string;
  run_id: string;
  request_id: string;
  hostname: string;
  expires_at: string;
  updated_at: string;
  width: number;
  height: number;
}
export type HandoffCommand =
  | { kind: "click"; x: number; y: number }
  | { kind: "text"; text: string }
  | { kind: "key"; key: string }
  | { kind: "scroll"; delta: number }
  | { kind: "cancel" };
export function validHandoffCommand(value: unknown): value is HandoffCommand {
  if (!value || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  const keys =
    c.kind === "click"
      ? ["kind", "x", "y"]
      : c.kind === "text"
        ? ["kind", "text"]
        : c.kind === "key"
          ? ["kind", "key"]
          : c.kind === "scroll"
            ? ["kind", "delta"]
            : ["kind"];
  if (Object.keys(c).some((key) => !keys.includes(key))) return false;
  if (c.kind === "click")
    return (
      Number.isInteger(c.x) &&
      Number.isInteger(c.y) &&
      Number(c.x) >= 0 &&
      Number(c.x) < 1280 &&
      Number(c.y) >= 0 &&
      Number(c.y) < 720
    );
  if (c.kind === "text") return typeof c.text === "string" && /^[\x20-\x7e]{1,100}$/.test(c.text);
  if (c.kind === "key")
    return [
      "Tab",
      "Enter",
      "Backspace",
      "Delete",
      "Space",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
    ].includes(String(c.key));
  if (c.kind === "scroll") return Number.isInteger(c.delta) && Math.abs(Number(c.delta)) <= 600;
  return c.kind === "cancel";
}
// Private, short-lived IPC shared by the existing BaoTa API and crawler. No browser
// websocket, URL navigation, JavaScript, cookies or profile bytes cross this boundary.
export class BrowserHandoffStore {
  constructor(readonly root: string) {}
  path(id: string, file: string) {
    if (
      !handoffIdValid(id) ||
      !["info.json", "frame.jpg", "command.json", "claim.json"].includes(file)
    )
      throw new Error("handoff_invalid");
    return join(this.root, id, file);
  }
  async info(id: string): Promise<HandoffInfo> {
    const info = JSON.parse(await readFile(this.path(id, "info.json"), "utf8")) as HandoffInfo;
    if (
      info.id !== id ||
      !handoffIdValid(info.run_id) ||
      !Number.isFinite(Date.parse(info.expires_at)) ||
      !Number.isFinite(Date.parse(info.updated_at)) ||
      Date.parse(info.expires_at) <= Date.now() ||
      Date.parse(info.updated_at) < Date.now() - 10_000
    )
      throw new Error("handoff_expired");
    return info;
  }
  async list() {
    const names = await readdir(this.root).catch(() => [] as string[]);
    const items = await Promise.all(
      names
        .filter(handoffIdValid)
        .slice(0, 100)
        .map((id) => this.info(id).catch(() => null)),
    );
    return items.filter((x): x is HandoffInfo => x !== null);
  }
  async cleanup() {
    const names = await readdir(this.root).catch(() => [] as string[]);
    for (const id of names.filter(handoffIdValid).slice(0, 100)) {
      const dir = join(this.root, id),
        entry = await lstat(dir).catch(() => null);
      if (!entry?.isDirectory() || entry.isSymbolicLink()) continue;
      const info = await readFile(this.path(id, "info.json"), "utf8")
        .then((text) => JSON.parse(text) as HandoffInfo)
        .catch(() => null);
      if (
        (info?.id === id &&
          Number.isFinite(Date.parse(info.expires_at)) &&
          Date.parse(info.expires_at) < Date.now()) ||
        entry.mtimeMs < Date.now() - 600_000
      )
        await rm(dir, { recursive: true, force: true });
    }
  }
  async frame(id: string) {
    await this.info(id);
    return readFile(this.path(id, "frame.jpg"));
  }
  async command(id: string, command: HandoffCommand, commandId: string) {
    await this.info(id);
    if (!validHandoffCommand(command) || !handoffIdValid(commandId))
      throw new Error("handoff_command_invalid");
    const pending = this.path(id, "command.json"),
      lock = pending + ".lock",
      temporary = pending + ".tmp";
    const handle = await open(lock, "wx", 0o600);
    await handle.close();
    try {
      await writeFile(temporary, JSON.stringify({ id: commandId, command }), { mode: 0o600 });
      await rename(temporary, pending);
    } catch (error) {
      await rm(temporary, { force: true });
      await rm(lock, { force: true });
      throw error;
    }
  }
}

export async function waitForManualCaptcha(input: {
  root: string;
  runId: string;
  requestId: string;
  page: Page;
  captchaSelector: string;
  allowedOrigins: string[];
  isReady?: () => Promise<boolean>;
  report?: (observation: {
    event: "opened" | "command_applied" | "ready" | "expired";
    command_kind?: HandoffCommand["kind"];
  }) => void;
  signal?: AbortSignal;
}) {
  const { page } = input,
    id = randomUUID(),
    directory = join(input.root, id),
    store = new BrowserHandoffStore(input.root),
    expires = Date.now() + HANDOFF_TTL_MS,
    processed = new Set<string>();
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const safe = async () => {
    input.signal?.throwIfAborted();
    if (
      !input.allowedOrigins.includes(new URL(page.url()).origin) ||
      (await page.locator('input[type="password"]').count())
    )
      throw new Error("handoff_origin_or_login_forbidden");
  };
  try {
    await safe();
    const report = (observation: Parameters<NonNullable<typeof input.report>>[0]) => {
      try {
        input.report?.(observation);
      } catch {
        // Observability cannot alter a live human session or its result.
      }
    };
    report({ event: "opened" });
    // Fixed viewport keeps operator coordinates independent of their screen size.
    await page.setViewportSize({ width: 1280, height: 720 });
    while (Date.now() < expires) {
      await safe();
      if (!(await page.locator(input.captchaSelector).count())) {
        await page.waitForLoadState("domcontentloaded");
        await safe();
        if (
          !(await page.locator(input.captchaSelector).count()) &&
          (!input.isReady || (await input.isReady()))
        ) {
          report({ event: "ready" });
          return;
        }
      }
      const frame = await page.screenshot({ type: "jpeg", quality: 75, timeout: 5000 });
      const info: HandoffInfo = {
        id,
        run_id: input.runId,
        request_id: input.requestId,
        hostname: new URL(page.url()).hostname,
        expires_at: new Date(expires).toISOString(),
        updated_at: new Date().toISOString(),
        width: 1280,
        height: 720,
      };
      await writeFile(join(directory, "frame.tmp"), frame, { mode: 0o600 });
      await rename(join(directory, "frame.tmp"), store.path(id, "frame.jpg"));
      await writeFile(join(directory, "info.tmp"), JSON.stringify(info), { mode: 0o600 });
      await rename(join(directory, "info.tmp"), store.path(id, "info.json"));
      const commandPath = store.path(id, "command.json");
      if (
        await stat(commandPath).then(
          () => true,
          () => false,
        )
      ) {
        let packet: { id?: string; command?: unknown };
        try {
          packet = JSON.parse(await readFile(commandPath, "utf8"));
        } finally {
          await rm(commandPath, { force: true });
          await rm(commandPath + ".lock", { force: true });
        }
        const command = packet.command;
        if (
          !(await page.locator(input.captchaSelector).count()) &&
          (!input.isReady || (await input.isReady()))
        )
          continue;
        if (
          packet.id &&
          handoffIdValid(packet.id) &&
          !processed.has(packet.id) &&
          processed.size < 1000 &&
          validHandoffCommand(command)
        ) {
          processed.add(packet.id);
          await safe();
          if (command.kind === "cancel") throw new Error("handoff_cancelled");
          if (command.kind === "click") await page.mouse.click(command.x, command.y);
          if (command.kind === "text") {
            const eligible = await page.evaluate(() => {
              const e = document.activeElement;
              return (
                e instanceof HTMLInputElement &&
                ["text", "search", "tel", "number"].includes(e.type)
              );
            });
            if (eligible) await page.keyboard.insertText(command.text);
          }
          if (command.kind === "key") await page.keyboard.press(command.key);
          if (command.kind === "scroll") await page.mouse.wheel(0, command.delta);
          report({ event: "command_applied", command_kind: command.kind });
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    report({ event: "expired" });
    throw new Error("handoff_expired");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
