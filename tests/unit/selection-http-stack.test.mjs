import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { buildApp } from "../../apps/api/dist/app.js";
import {
  createSelectionHttpStack,
  selectionHttpAccounts as accounts,
  selectionHttpIds as ids,
} from "../fixtures/selection-http-stack.mjs";

const origin = "http://127.0.0.1:5173";
async function fixture(t) {
  const app = buildApp(await createSelectionHttpStack(origin));
  t.after(() => app.close());
  const login = async (role) => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: { origin, "idempotency-key": randomUUID() },
      payload: { identifier: accounts[role], password: accounts.password },
    });
    assert.equal(response.statusCode, 200);
    assert.match(response.headers["set-cookie"], /HttpOnly/i);
    return response.headers["set-cookie"].split(";")[0];
  };
  return { app, login };
}

test("HTTP fixture refuses non-loopback origins", async () => {
  await assert.rejects(createSelectionHttpStack("https://midouai.medouai.com"), /loopback_only/);
});

test("actual auth and authorization reject anonymous and missing-capability reads", async (t) => {
  const { app, login } = await fixture(t);
  assert.equal((await app.inject("/api/v1/opportunities")).statusCode, 401);
  const cookie = await login("viewer");
  assert.equal(
    (await app.inject({ url: "/api/v1/opportunities", headers: { cookie } })).statusCode,
    403,
  );
});

test("actual service routes preserve session tenant scope and detailed product facts", async (t) => {
  const { app, login } = await fixture(t);
  const cookie = await login("member");
  const list = await app.inject({
    url: "/api/v1/opportunities?selection_view=all",
    headers: { cookie },
  });
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().data.length, 2);
  assert.equal(list.json().data[0].primary_product.price, 19.95);
  assert.match(list.json().data[0].main_asin, /^[A-Z0-9]{10}$/);
  const otherCookie = await login("foreign");
  const other = await app.inject({
    url: `/api/v1/opportunities?organization_id=${ids.organization}&selection_view=all`,
    headers: { cookie: otherCookie },
  });
  assert.deepEqual(other.json().data, []);
  assert.equal(
    (
      await app.inject({
        url: `/api/v1/opportunities/${ids.product}`,
        headers: { cookie: otherCookie },
      })
    ).statusCode,
    404,
  );
  const competitors = await app.inject({
    url: `/api/v1/competitors?opportunity_id=${ids.product}`,
    headers: { cookie },
  });
  assert.equal(competitors.statusCode, 200);
  assert.equal(new Set(competitors.json().data.map((item) => item.external_id)).size, 5);
  assert.ok(
    competitors
      .json()
      .data.every(
        (item) =>
          /^[A-Z0-9]{10}$/.test(item.external_id) &&
          item.external_id !== list.json().data[0].main_asin,
      ),
  );
});

test("observing decision crosses actual HTTP validation and reads back once with request provenance", async (t) => {
  const { app, login } = await fixture(t);
  const cookie = await login("member"),
    key = randomUUID();
  const input = {
    method: "POST",
    url: `/api/v1/opportunities/${ids.product}/decisions`,
    headers: { cookie, origin, "idempotency-key": key },
    payload: { action: "observe", reason: "隔离 HTTP 验证，补齐货源再判断", expected_version: 1 },
  };
  const write = await app.inject(input);
  assert.equal(write.statusCode, 200);
  assert.deepEqual((await app.inject(input)).json().data, write.json().data);
  const detail = (
    await app.inject({ url: `/api/v1/opportunities/${ids.product}`, headers: { cookie } })
  ).json().data;
  assert.equal(detail.decision_status, "observing");
  assert.equal(detail.version, 2);
  assert.equal(detail.decisions.length, 1);
  assert.equal(detail.decisions[0].request_id, write.headers["x-request-id"]);
  assert.equal(
    (await app.inject({ ...input, payload: { ...input.payload, reason: "更改同一幂等请求" } }))
      .statusCode,
    409,
  );
  assert.equal(
    (
      await app.inject({
        ...input,
        headers: { ...input.headers, origin: "https://outside.example" },
      })
    ).statusCode,
    403,
  );
});
