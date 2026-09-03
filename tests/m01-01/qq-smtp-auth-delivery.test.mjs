import test from "node:test";
import assert from "node:assert/strict";
import { loadRuntimeConfig, ConfigError } from "../../packages/config/dist/index.js";
import { QqSmtpMailProvider, renderAuthMail } from "../../apps/worker/dist/auth-delivery-worker.js";

const message = {
  userId: "user-a",
  kind: "email_verification",
  email: "recipient@example.com",
  token: "single-use token/+",
  expiresAt: new Date("2026-09-03T12:00:00.000Z"),
  requestId: "request-a",
  traceId: "trace-a",
};

function decodeMimeBodies(content) {
  return [
    ...content.matchAll(/Content-Transfer-Encoding: base64\r\n\r\n([A-Za-z0-9+/=\r\n]+?)\r\n--/g),
  ].map((match) => Buffer.from(match[1].replace(/\r\n/g, ""), "base64").toString("utf8"));
}

test("QQ SMTP config fails closed and masks its authorization code from the fingerprint", () => {
  assert.throws(
    () => loadRuntimeConfig({ AUTH_EMAIL_DELIVERY_MODE: "qq_smtp" }, "worker"),
    (error) => error instanceof ConfigError && error.key === "QQ_SMTP_USERNAME",
  );
  assert.throws(
    () =>
      loadRuntimeConfig(
        {
          AUTH_EMAIL_DELIVERY_MODE: "qq_smtp",
          QQ_SMTP_USERNAME: "sender@qq.com",
          QQ_SMTP_AUTH_CODE: "not-an-auth-code",
        },
        "worker",
      ),
    (error) => error instanceof ConfigError && error.key === "QQ_SMTP_AUTH_CODE",
  );
  const first = loadRuntimeConfig(
    {
      AUTH_EMAIL_DELIVERY_MODE: "qq_smtp",
      QQ_SMTP_USERNAME: "sender@qq.com",
      QQ_SMTP_AUTH_CODE: "abcdefghijklmnop",
    },
    "worker",
  );
  const second = loadRuntimeConfig(
    {
      AUTH_EMAIL_DELIVERY_MODE: "qq_smtp",
      QQ_SMTP_USERNAME: "sender@qq.com",
      QQ_SMTP_AUTH_CODE: "ponmlkjihgfedcba",
    },
    "worker",
  );
  assert.equal(first.authEmail.deliveryMode, "qq_smtp");
  assert.equal(first.configFingerprint, second.configFingerprint);
});

test("QQ SMTP auth messages contain only the intended single-use public action link", () => {
  const rendered = renderAuthMail(message, {
    username: "sender@qq.com",
    fromName: "ScoutOps",
    webOrigin: "https://midouai.medouai.com",
  });
  assert.equal(rendered.recipient, message.email);
  assert.doesNotMatch(rendered.content, /single-use token/);
  const bodies = decodeMimeBodies(rendered.content);
  assert.equal(bodies.length, 2);
  for (const body of bodies) {
    assert.match(
      body,
      /https:\/\/midouai\.medouai\.com\/verify-email\?token=single-use\+token%2F%2B/,
    );
    assert.match(body, /只能使用一次/);
  }
  assert.throws(
    () =>
      renderAuthMail(
        { ...message, email: "victim@example.com\r\nBcc: other@example.com" },
        {
          username: "sender@qq.com",
          fromName: "ScoutOps",
          webOrigin: "https://midouai.medouai.com",
        },
      ),
    /invalid_recipient/,
  );
});

test("QQ SMTP provider passes the authorization code only to the transport boundary", async () => {
  const calls = [];
  const provider = new QqSmtpMailProvider(
    {
      username: "sender@qq.com",
      authCode: "abcdefghijklmnop",
      fromName: "ScoutOps",
      webOrigin: "https://midouai.medouai.com",
      timeoutMs: 15000,
    },
    async (input) => calls.push(input),
  );
  await provider.send(message);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].authCode, "abcdefghijklmnop");
  assert.equal(calls[0].recipient, message.email);
  assert.doesNotMatch(calls[0].content, /abcdefghijklmnop/);
});
