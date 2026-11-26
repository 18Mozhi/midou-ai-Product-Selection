import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withDailyAmazonDelivery } from "../../packages/playwright-crawler/dist/amazon-delivery-context.js";

const cookie = {
  name: "session-id",
  value: "seed",
  domain: ".amazon.com",
  path: "/",
  expires: -1,
  httpOnly: true,
  secure: true,
  sameSite: "Lax",
};
const context = (value) => ({ cookies: async () => [{ ...cookie, value }] });
const day = () => new Date("2026-11-26T08:00:00Z");
const fixture = async (work) => {
  const root = await mkdtemp(join(tmpdir(), "scoutops-session-refresh-unit-"));
  const run = (work, clock = day, identity = "owned") =>
    withDailyAmazonDelivery(root, identity, "94404", work, undefined, clock);
  try {
    await run((s) => s.save(context("seed")));
    await work(run, root);
  } finally {
    await rm(root, { recursive: true, force: true, maxRetries: 6, retryDelay: 100 });
  }
};

test("refresh retains the existing day/schema/identity without another daily preparation", () =>
  fixture(async (run, root) => {
    await run(async (s) => {
      assert.equal(s.cached, true);
      assert.equal(await s.refresh(context("rotated")), true);
    });
    const data = await run(async (s) => s.cookies);
    assert.equal(data[0].value, "rotated");
    const [name] = await readdir(root);
    const state = JSON.parse(await readFile(join(root, name), "utf8"));
    assert.equal(state.version, 1);
    assert.equal(state.day, "2026-11-26");
    assert.equal((await readdir(root)).length, 1);
  }));

test("a stale task cannot overwrite a newer verified response jar", () =>
  fixture(async (run) => {
    await run(async (stale) => {
      await run(async (current) => assert.equal(await current.refresh(context("newer")), true));
      assert.equal(await stale.refresh(context("older")), false);
    });
    assert.equal((await run(async (s) => s.cookies))[0].value, "newer");
  }));

test("busy refresh lock is neither waited on nor stolen", () =>
  fixture(async (run, root) => {
    await run(async (s) => {
      const [file] = await readdir(root);
      const lock = join(root, file.replace(/\.json$/, ".lock"));
      const owner = JSON.stringify({ id: "another-owner", pid: process.pid });
      await writeFile(lock, owner, { flag: "wx" });
      try {
        assert.equal(await s.refresh(context("newer")), false);
        assert.equal(await readFile(lock, "utf8"), owner);
      } finally {
        await rm(lock);
      }
    });
    assert.equal((await run(async (s) => s.cookies))[0].value, "seed");
  }));

test("a task spanning Beijing midnight cannot refresh yesterday's proof", () =>
  fixture(async (run) => {
    let now = day();
    await run(
      async (s) => {
        now = new Date("2026-11-26T16:00:00Z");
        assert.equal(await s.refresh(context("new-day")), false);
      },
      () => now,
    );
    assert.equal((await run(async (s) => s.cookies))[0].value, "seed");
  }));

test("authenticated, empty and foreign jars never replace the anonymous cache", () =>
  fixture(async (run) => {
    for (const bad of [
      [],
      [{ ...cookie, name: "at-main" }],
      [{ ...cookie, name: "sess-at-main" }],
      [{ ...cookie, domain: ".amazon.com.evil.test" }],
      [{ ...cookie, value: "bad\r\n" }],
    ]) {
      await run(async (s) => assert.equal(await s.refresh({ cookies: async () => bad }), false));
      assert.equal((await run(async (s) => s.cookies))[0].value, "seed");
    }
  }));

test("refresh narrows only the already accepted live dotted-www scope", () =>
  fixture(async (run) => {
    const live = { ...cookie, domain: ".www.amazon.com", value: "new" };
    await run(async (s) => assert.equal(await s.refresh({ cookies: async () => [live] }), true));
    assert.equal(live.domain, ".www.amazon.com");
    assert.equal((await run(async (s) => s.cookies))[0].domain, "www.amazon.com");
  }));

test("different project identities keep independent anonymous session jars", () =>
  fixture(async (run) => {
    await run((s) => s.save(context("other")), day, "other-profile");
    await run((s) => s.refresh(context("newer")));
    assert.equal((await run(async (s) => s.cookies, day, "other-profile"))[0].value, "other");
  }));
