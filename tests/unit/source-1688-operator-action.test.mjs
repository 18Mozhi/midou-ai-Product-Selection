import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const url = new URL("../../apps/web/src/source-1688-operator-action.ts", import.meta.url);
const js = ts.transpileModule(readFileSync(url,"utf8"),
  {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {source1688OperatorAction}=await import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
const row={code:"1688_search",health_status:"blocked",last_error_code:"captcha",
  last_checked_at:"2026-11-18T10:28:00Z",runtime_circuit_opened_at:"2026-11-18T10:25:00Z",
  runtime_last_error_code:"network_error",runtime_circuit_state:"open",runtime_recovery_gate_met:false};
test("1688 distinguishes CAPTCHA, expired login and network, and reveals recovery only after passing",()=>{
  const verification=source1688OperatorAction(row);
  assert.match(verification.title,/验证码/);
  assert.equal(verification.link,"https://xingxing.medouai.com/#/adminDashboard");
  assert.equal(verification.external,true);
  assert.match(source1688OperatorAction({...row,last_error_code:"login_required"}).title,/重新登录/);
  const unknown=source1688OperatorAction({...row,last_error_code:"network_error"});
  assert.equal(unknown.link,null);
  assert.match(unknown.title,/未能连接/);
  assert.doesNotMatch(unknown.title,/需要重新登录|需要人工过验证码/);
  const limited=source1688OperatorAction({...row,last_error_code:"rate_limited",runtime_last_error_code:"captcha"});
  assert.match(limited.title,/限流/);
  assert.match(limited.instruction,/先不要继续点检查或重登/);
  assert.equal(limited.link,null);
  assert.equal(source1688OperatorAction({...row,health_status:"ready",last_error_code:null,
    runtime_recovery_gate_met:true}).link,"/platform-admin/crawler-scheduler");
  assert.equal(source1688OperatorAction({...row,code:"amazon_product"}),null);
});
test("a new 1688 circuit event supersedes the pre-circuit probe, including a ready probe",()=>{
  const earlier={...row,last_checked_at:"2026-11-18T10:17:41Z", runtime_last_error_code:"rate_limited"};
  for(const source of [earlier,{...earlier,health_status:"ready",last_error_code:null}]){
    const action=source1688OperatorAction(source);
    assert.equal(action.title,"采集因限流暂停");
    assert.equal(action.link,null);
  }
  const current=source1688OperatorAction({...earlier,runtime_last_error_code:"login_required"});
  assert.match(current.title,/重新登录/);
  assert.match(current.instruction,/本次熔断的采集任务/);
});
