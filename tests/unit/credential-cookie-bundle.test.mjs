import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCookieBundle } from "../../apps/api/dist/credential-asset-service.js";

test("Cookie bundle accepts browser JSON and canonicalizes Chrome sameSite", () => {
  const secret = normalizeCookieBundle(
    JSON.stringify({
      cookies: [
        {
          name: "session",
          value: "secret-value",
          domain: ".example.com",
          path: "/",
          secure: true,
          httpOnly: true,
          sameSite: "no_restriction",
          expirationDate: 2000000000,
        },
      ],
    }),
  );
  const result = JSON.parse(secret.value);
  assert.equal(secret.encoding, "utf8");
  assert.equal(result.format, "scoutops-cookie-bundle-v1");
  assert.deepEqual(result.cookies[0], {
    name: "session",
    value: "secret-value",
    domain: ".example.com",
    path: "/",
    expires: 2000000000,
    httpOnly: true,
    secure: true,
    sameSite: "None",
  });
});

test("Cookie bundle accepts Netscape cookies.txt and deduplicates identities", () => {
  const secret = normalizeCookieBundle(
    [
      "# Netscape HTTP Cookie File",
      ".example.com\tTRUE\t/\tTRUE\t2000000000\tsession\told",
      "#HttpOnly_.example.com\tTRUE\t/\tTRUE\t2000000000\tsession\tnew",
    ].join("\n"),
  );
  const result = JSON.parse(secret.value);
  assert.equal(result.cookies.length, 1);
  assert.equal(result.cookies[0].value, "old");
  assert.equal(result.cookies[0].httpOnly, false);
});

test("Cookie bundle treats Chrome expirationDate -1 as a session cookie", () => {
  const secret = normalizeCookieBundle(
    JSON.stringify([
      {
        name: "session",
        value: "session-only",
        domain: "example.com",
        expirationDate: -1,
      },
    ]),
  );
  const result = JSON.parse(secret.value);
  assert.equal(result.cookies.length, 1);
  assert.equal(result.cookies[0].name, "session");
  assert.equal("expires" in result.cookies[0], false);
});

test("Cookie bundle rejects malformed domains", () => {
  assert.throws(
    () => normalizeCookieBundle(JSON.stringify([{ name: "x", value: "y", domain: "bad..host" }])),
    (error) => error?.code === "credential_cookie_invalid",
  );
});
