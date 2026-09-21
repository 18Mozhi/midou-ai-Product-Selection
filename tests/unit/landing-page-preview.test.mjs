import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { previewLandingPage } from "../../scripts/lib/landing-page-preview.mjs";
const file="apps/web/src/components/LandingRedirect.vue";
test("P01 C review preserves landing resolution script",async()=>{const source=await readFile(file,"utf8"),reviewed=previewLandingPage(source);assert.equal(reviewed.slice(0,reviewed.indexOf("<template>")),source.slice(0,source.indexOf("<template>")));assert.match(reviewed,/@primary="resolveLanding"/);assert.match(reviewed,/request-id="requestId"/);});
test("P01 C review separates loading and retry boundaries",async()=>{const reviewed=previewLandingPage(await readFile(file,"utf8"));assert.match(reviewed,/state === 'loading' \? 'loading' : 'blocked'/);assert.match(reviewed,/加载时不展示可重复动作/);});
