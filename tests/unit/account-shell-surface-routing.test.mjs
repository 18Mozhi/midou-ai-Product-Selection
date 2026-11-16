import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import ts from "typescript";

const read=(file)=>readFileSync(new URL(`../../apps/web/src/${file}`,import.meta.url),"utf8");
const {outputText}=ts.transpileModule(read("navigation-shell-route-state.ts"), {
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},
});
const {surfaceProps,breadcrumbTrail}=await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

test("account workspace passes mode to the retained selection, approval and notice surfaces",()=>{
  const base={path:"/opportunities",apiBaseUrl:"/api/v1",params:{},capabilities:[],roles:[],accountRehearsal:true};
  for(const surface of ["opportunity-workspace","approval-workspace","notification-center",
    "score-rule-console","sourcing-workspace","cost-rule-console"]) {
    assert.equal(surfaceProps({...base,surface}).accountRehearsal,true,surface);
  }
  const accounts=surfaceProps({...base,surface:"platform-account-center",path:"/platform-admin/accounts"});
  assert.equal(accounts.initialTab,"users");
  assert.equal(accounts.accountRehearsal,true);
  const labels=["工作台","选品工作区","选品库","选品详情"];
  const trail=breadcrumbTrail(labels,"/opportunities/record",true);
  assert.ok(trail.every((crumb)=>crumb.path!=="/home"&&crumb.label!=="选品工作区"));
  const shell=read("components/NavigationShell.vue");
  assert.match(shell,/path: "\/tasks\/approvals"/);
  assert.match(shell,/v-if="guard && !retiredScope" class="role-workspace-identity"/);
});
