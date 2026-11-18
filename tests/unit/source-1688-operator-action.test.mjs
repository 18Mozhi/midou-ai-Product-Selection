import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const url = new URL("../../apps/web/src/source-1688-operator-action.ts", import.meta.url);
const js = ts.transpileModule(readFileSync(url,"utf8"),
  {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {source1688OperatorAction}=await import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
const row={code:"1688_search",health_status:"blocked",last_error_code:"captcha",
  runtime_last_error_code:"network_error",runtime_circuit_state:"open",runtime_recovery_gate_met:false};
test("1688 distinguishes CAPTCHA, expired login and network, and reveals recovery only after passing",()=>{
  const verification=source1688OperatorAction(row);
  assert.match(verification.title,/验证码/);
  assert.equal(verification.link,"https://xingxing.medouai.com/#/adminDashboard");
  assert.equal(verification.external,true);
  assert.match(source1688OperatorAction({...row,last_error_code:"login_required"}).title,/重新登录/);
  const unknown=source1688OperatorAction({...row,last_error_code:"network_error"});
  assert.equal(unknown.link,null);
  assert.doesNotMatch(unknown.title,/需要重新登录|需要人工过验证码/);
  assert.equal(source1688OperatorAction({...row,health_status:"ready",last_error_code:null,
    runtime_recovery_gate_met:true}).link,"/platform-admin/crawler-scheduler");
  assert.equal(source1688OperatorAction({...row,code:"amazon_product"}),null);
});
