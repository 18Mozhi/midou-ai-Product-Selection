import { randomUUID } from "node:crypto";
import { connect, type TLSSocket } from "node:tls";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { openAuthDelivery, type AuthDeliveryMessage } from "@scoutops/auth";
import { withTransaction } from "@scoutops/database";

export interface AuthMailProvider {
  send(message: AuthDeliveryMessage): Promise<void>;
}
export class PendingMailProvider implements AuthMailProvider {
  async send(): Promise<void> {
    const error = new Error("mail_provider_pending");
    error.name = "mail_provider_pending";
    throw error;
  }
}

export interface QqSmtpOptions {
  username: string;
  authCode: string;
  fromName: string;
  webOrigin: string;
  timeoutMs: number;
}

type QqSmtpTransport = (input: {
  username: string;
  authCode: string;
  recipient: string;
  content: string;
  timeoutMs: number;
}) => Promise<void>;

const SMTP_HOST = "smtp.qq.com";
const SMTP_PORT = 465;

function headerValue(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized || normalized.length > 254 || /[\r\n]/.test(normalized))
    throw new Error(`invalid_${label}`);
  return normalized;
}

function encodedWord(value: string) {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function base64Lines(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .match(/.{1,76}/g)!
    .join("\r\n");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character]!;
  });
}

export function renderAuthMail(
  message: AuthDeliveryMessage,
  options: Pick<QqSmtpOptions, "username" | "fromName" | "webOrigin">,
) {
  const recipient = headerValue(message.email, "recipient");
  const sender = headerValue(options.username, "sender");
  const fromName = headerValue(options.fromName, "from_name");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) throw new Error("invalid_recipient");
  if (!/^[^\s@]+@qq\.com$/i.test(sender)) throw new Error("invalid_qq_smtp_username");
  const path = message.kind === "email_verification" ? "/verify-email" : "/reset-password";
  const url = new URL(path, options.webOrigin);
  url.searchParams.set("token", message.token);
  const purpose = message.kind === "email_verification" ? "验证邮箱" : "重置密码";
  const subject = `ScoutOps ${purpose}`;
  const expiresAt = message.expiresAt.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour12: false,
  });
  const textBody = [
    `请使用以下链接完成${purpose}：`,
    url.toString(),
    `链接有效期至 ${expiresAt}（北京时间），且只能使用一次。`,
    "如果不是你本人发起，请忽略此邮件。",
  ].join("\n\n");
  const htmlBody = [
    '<!doctype html><html lang="zh-CN"><body>',
    `<p>请点击下方链接完成${purpose}：</p>`,
    `<p><a href=\"${escapeHtml(url.toString())}\">${purpose}</a></p>`,
    `<p>链接有效期至 ${escapeHtml(expiresAt)}（北京时间），且只能使用一次。</p>`,
    "<p>如果不是你本人发起，请忽略此邮件。</p>",
    "</body></html>",
  ].join("");
  const boundary = `scoutops-${randomUUID()}`;
  const domain = sender.slice(sender.lastIndexOf("@") + 1);
  const content = [
    `From: ${encodedWord(fromName)} <${sender}>`,
    `To: <${recipient}>`,
    `Subject: ${encodedWord(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${randomUUID()}@${domain}>`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary=\"${boundary}\"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(textBody),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(htmlBody),
    `--${boundary}--`,
    "",
  ].join("\r\n");
  return { recipient, content };
}

function readSmtpResponse(socket: TLSSocket, timeoutMs: number) {
  return new Promise<number>((resolve, reject) => {
    let buffer = "";
    const timer = setTimeout(() => finish(new Error("smtp_response_timeout")), timeoutMs);
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split("\r\n");
      const terminal = lines.find((line) => /^\d{3} /.test(line));
      if (terminal) finish(undefined, Number(terminal.slice(0, 3)));
    };
    const onError = () => finish(new Error("smtp_connection_failed"));
    const onClose = () => finish(new Error("smtp_connection_closed"));
    const finish = (error?: Error, code?: number) => {
      clearTimeout(timer);
      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("close", onClose);
      if (error) reject(error);
      else resolve(code!);
    };
    socket.on("data", onData);
    socket.once("error", onError);
    socket.once("close", onClose);
  });
}

async function expectSmtp(
  socket: TLSSocket,
  timeoutMs: number,
  accepted: readonly number[],
  command?: string,
) {
  const response = readSmtpResponse(socket, timeoutMs);
  if (command !== undefined) socket.write(`${command}\r\n`);
  const code = await response;
  if (!accepted.includes(code)) {
    const error = new Error(`smtp_rejected_${code}`);
    error.name = code === 535 ? "smtp_authentication_failed" : "smtp_delivery_failed";
    throw error;
  }
}

async function sendViaQqSmtp(input: {
  username: string;
  authCode: string;
  recipient: string;
  content: string;
  timeoutMs: number;
}) {
  const socket = connect({
    host: SMTP_HOST,
    port: SMTP_PORT,
    servername: SMTP_HOST,
    rejectUnauthorized: true,
  });
  socket.setTimeout(input.timeoutMs, () => socket.destroy(new Error("smtp_socket_timeout")));
  try {
    await expectSmtp(socket, input.timeoutMs, [220]);
    await expectSmtp(socket, input.timeoutMs, [250], "EHLO scoutops.local");
    await expectSmtp(socket, input.timeoutMs, [334], "AUTH LOGIN");
    await expectSmtp(
      socket,
      input.timeoutMs,
      [334],
      Buffer.from(input.username).toString("base64"),
    );
    await expectSmtp(
      socket,
      input.timeoutMs,
      [235],
      Buffer.from(input.authCode).toString("base64"),
    );
    await expectSmtp(socket, input.timeoutMs, [250], `MAIL FROM:<${input.username}>`);
    await expectSmtp(socket, input.timeoutMs, [250, 251], `RCPT TO:<${input.recipient}>`);
    await expectSmtp(socket, input.timeoutMs, [354], "DATA");
    const dotStuffed = input.content.replace(/(^|\r\n)\./g, "$1..");
    socket.write(`${dotStuffed}\r\n.\r\n`);
    await expectSmtp(socket, input.timeoutMs, [250]);
    await expectSmtp(socket, input.timeoutMs, [221], "QUIT");
  } finally {
    socket.destroy();
  }
}

export class QqSmtpMailProvider implements AuthMailProvider {
  constructor(
    private readonly options: QqSmtpOptions,
    private readonly transport: QqSmtpTransport = sendViaQqSmtp,
  ) {}
  async send(message: AuthDeliveryMessage): Promise<void> {
    const { recipient, content } = renderAuthMail(message, this.options);
    await this.transport({
      username: this.options.username,
      authCode: this.options.authCode,
      recipient,
      content,
      timeoutMs: this.options.timeoutMs,
    });
  }
}

interface ClaimedRow extends RowDataPacket {
  id: string;
  user_id: string;
  kind: "email_verification" | "password_reset";
  ciphertext: Buffer;
  nonce: Buffer;
  authTag: Buffer;
  attempt_count: number;
  request_id: string;
  trace_id: string;
}

export async function processAuthDeliveryOnce(input: {
  pool: Pool;
  workerId: string;
  masterKey: string;
  provider: AuthMailProvider;
  now?: () => Date;
}) {
  const now = (input.now ?? (() => new Date()))();
  const leaseUntil = new Date(now.getTime() + 30_000);
  const claimed = await withTransaction(input.pool, async (connection) => {
    const [rows] = await connection.query<ClaimedRow[]>(
      "SELECT id,user_id,kind,payload_ciphertext AS ciphertext,payload_nonce AS nonce,payload_auth_tag AS authTag,attempt_count,request_id,trace_id FROM auth_delivery_outbox WHERE ((status IN ('queued','retry_scheduled') AND available_at<=?) OR (status='leased' AND lease_expires_at<=?)) ORDER BY available_at,id LIMIT 1 FOR UPDATE",
      [now, now],
    );
    const row = rows[0];
    if (!row) return null;
    await connection.query(
      "UPDATE auth_delivery_outbox SET status='leased',attempt_count=attempt_count+1,lease_owner=?,lease_expires_at=?,updated_at=? WHERE id=?",
      [input.workerId, leaseUntil, now, row.id],
    );
    row.attempt_count += 1;
    return row;
  });
  if (!claimed) return { status: "idle" } as const;
  try {
    const message = openAuthDelivery(claimed, input.masterKey);
    await input.provider.send(message);
    await input.pool.query(
      "UPDATE auth_delivery_outbox SET status='succeeded',lease_owner=NULL,lease_expires_at=NULL,last_error_code=NULL,updated_at=? WHERE id=?",
      [now, claimed.id],
    );
    return { status: "succeeded", trace_id: claimed.trace_id } as const;
  } catch (error) {
    const code =
      error instanceof Error
        ? error.name === "mail_provider_pending"
          ? "mail_provider_pending"
          : "delivery_failed"
        : "delivery_failed";
    const terminal =
      code === "mail_provider_pending"
        ? "blocked_provider"
        : claimed.attempt_count >= 3
          ? "dead_letter"
          : "retry_scheduled";
    const availableAt = new Date(now.getTime() + Math.min(300, 2 ** claimed.attempt_count) * 1000);
    await input.pool.query(
      "UPDATE auth_delivery_outbox SET status=?,available_at=?,lease_owner=NULL,lease_expires_at=NULL,last_error_code=?,updated_at=? WHERE id=?",
      [terminal, availableAt, code, now, claimed.id],
    );
    await input.pool.query(
      "INSERT INTO auth_security_events (id,user_id,event_type,outcome,request_id,trace_id,ip_hash,user_agent_hash,occurred_at,schema_version) VALUES (?,?,?,'blocked',?,?,NULL,NULL,?,1)",
      [
        randomUUID(),
        claimed.user_id,
        `auth_delivery.${terminal}`,
        claimed.request_id,
        claimed.trace_id,
        now,
      ],
    );
    return { status: terminal, error_code: code, trace_id: claimed.trace_id } as const;
  }
}
