import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

// These exact historical sources support the immutable P67 review images only.
// They never attest that the current Vue/data implementation is accepted.
export const redisReviewRevisions = Object.freeze({
  "apps/web/src/components/RedisResilienceCenter.vue": {
    baseline: "66bea9b6dfa514c19df8607daa173efddd26de74",
    captured: "75744285930910ebf412bd8a9587a7889bfa1892439b5be8405891a589bce04d",
    current: "72e0d8cdf041d84d6b83052348dda3c8045b4eb7cc037dfc94865f65d91f40ec",
  },
  "scripts/lib/ui-phase2-redis-design-data.mjs": {
    baseline: "1dd2520607a33c1879cf4b5968f25911e1e26f9d",
    captured: "85b85655f6f21a50e0f008e942b14d94e71fcb38fc9d2d1e8587ce22a9ec6e6c",
    current: "2add4c2b46728bfc5a9293224c26c8c89fcf1929fbe84ad83a318f33cb908a27",
  },
});

const hash = (source) => createHash("sha256").update(source).digest("hex");
const cached = new Map();

export function historicalRedisReviewSource(file, source) {
  file = file.replaceAll("\\", "/");
  source = source.replaceAll("\r\n", "\n");
  const revision = redisReviewRevisions[file];
  if (!revision || hash(source) === revision.captured) return source;
  assert.equal(hash(source), revision.current, "Unreviewed Redis review source: " + file);
  if (!cached.has(file)) {
    const captured = execFileSync("git", ["show", revision.baseline + ":" + file], {
      encoding: "utf8",
    }).replaceAll("\r\n", "\n");
    assert.equal(hash(captured), revision.captured, "Historical Redis source drift: " + file);
    cached.set(file, captured);
  }
  return cached.get(file);
}
