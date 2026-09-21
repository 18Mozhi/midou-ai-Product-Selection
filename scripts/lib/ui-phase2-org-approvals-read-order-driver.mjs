import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { loadingVueDriver } from "./ui-phase2-org-approvals-loading-driver.mjs";

export const readOrderOutput = "output/playwright/p34-read-order-vue-c-r1";
export function readOrderVueDriver(input) {
  assert.equal(
    createHash("sha256")
      .update(
        readFileSync("scripts/lib/ui-phase2-org-approvals-loading-driver.mjs", "utf8").replaceAll(
          "\r\n",
          "\n",
        ),
      )
      .digest("hex"),
    "d15b007b3fa62a62508d5a1313d3d7894f0c52ff0c9fea9bf28618cc4c2bf7da",
  );
  let source = loadingVueDriver(input);
  const replace = (before, after) => {
    assert.equal(source.split(before).length, 2, `One read-order anchor: ${before}`);
    source = source.replace(before, after);
  };
  replace(
    'const output = "output/playwright/p34-loading-vue-c-r2";',
    `const output = "${readOrderOutput}";`,
  );
  replace(
    "const currentSources = new Set([...sources,",
    `const currentSources = new Set([...sources,
  "scripts/lib/ui-phase2-org-approvals-read-order-driver.mjs",
  "scripts/verify-ui-phase2-org-approvals-read-order-vue.mjs",`,
  );
  replace(
    'kind: "P34-LOADING-VUE-C-r2",',
    'kind: "P34-READ-ORDER-VUE-C-r1",\n        orderedReads,',
  );
  replace(
    "const requestCounts = [], focusStates = [];",
    "const requestCounts = [], focusStates = [], orderedReads = [];",
  );
  replace(
    "        if (active.gate) await active.gate;",
    "        if (active.gate) await active.gate;\n        if (active.endpointGates?.[endpoint]) await active.endpointGates[endpoint];",
  );
  replace(
    '      await shot("refresh-success");',
    `      await shot("refresh-success");
      for (const phase of ["initial", "background"]) for (const firstEndpoint of ["summary", "approvals"]) for (const secondFailure of [null,{id:"server-error",status:500,state:"error"},{id:"permission-forbidden",status:403,state:"forbidden"}]) {
        const name = "order-" + phase + "-" + firstEndpoint + (secondFailure ? "-then-"+secondFailure.id : "");
        const secondEndpoint = firstEndpoint === "summary" ? "approvals" : "summary";
        const snapshot = () => center.evaluate(n => {
          const state = n.__vueParentComponent.setupState;
          return {observedAt:state.summary?.observed_at??null,templateName:state.data?.templates?.[1]?.name??null};
        });
        plan = {mode:"normal",marker:"original"};
        let before={observedAt:null,templateName:null};
        if (phase === "background") {await visit();await ready();before=await snapshot();}
        const gates={summary:hold(),approvals:hold()}, responseOrder=[];
        const onResponse=response=>{
          const url=new URL(response.url());
          if (url.origin===base && ["/api/v1/org/admin/summary","/api/v1/org/admin/approvals"].includes(url.pathname)) responseOrder.push(url.pathname.split("/").at(-1));
        };
        page.on("response",onResponse);
        try {
          const start=reads.length;
          const requestsStarted=Promise.all(["summary","approvals"].map(endpoint=>page.waitForRequest(base+"/api/v1/org/admin/"+endpoint)));
          plan={mode:"ordered",marker:"updated",failure:secondFailure,target:secondEndpoint,endpointGates:{summary:gates.summary.gate,approvals:gates.approvals.gate}};
          if (phase === "initial") {await visit();await center.waitFor();}
          else await center.getByRole("button",{name:"刷新数据",exact:true}).click();
          await requestsStarted;
          const pendingState=phase==="initial"?"loading":"ready";
          check(name+": both requests started once",reads.slice(start).map(r=>r.endpoint).sort(),["approvals","summary"]);
          check(name+": no response before release",responseOrder,[]);
          check(name+": original pending state",await center.getAttribute("data-state"),pendingState);
          check(name+": pending parent busy",await center.getAttribute("aria-busy"),"true");
          check(name+": pending snapshot unchanged",await snapshot(),before);
          check(name+": loading panel only on first read",await center.locator(".org-approval-loading-c").count(),phase==="initial"?1:0);
          const filter=child.getByRole("searchbox",{name:"搜索模板",exact:true});
          if(phase==="background") {await filter.fill("审批");check(name+": pending filter editable",await filter.inputValue(),"审批");}
          await shot(name+"-waiting");
          const firstResponsePromise=page.waitForResponse(base+"/api/v1/org/admin/"+firstEndpoint);
          gates[firstEndpoint].release();
          const firstResponse=await firstResponsePromise;
          await firstResponse.finished();
          const firstPayload=(await firstResponse.json()).data;
          check(name+": first response contains new fixture",firstEndpoint==="summary"?firstPayload.observed_at:firstPayload.templates[1].name,firstEndpoint==="summary"?"2026-08-27T10:00:00.000Z":"采购更新后审批模板");
          await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
          check(name+": only chosen response completed",responseOrder,[firstEndpoint]);
          check(name+": partial state remains pending",await center.getAttribute("data-state"),pendingState);
          check(name+": partial parent stays busy",await center.getAttribute("aria-busy"),"true");
          const partial=await snapshot();
          check(name+": no partial data commit",partial,before);
          check(name+": partial child visibility unchanged",await child.count(),phase==="initial"?0:1);
          const refresh=center.getByRole("button",{name:phase==="initial"?"刷新数据":"正在刷新…",exact:true});
          check(name+": partial refresh stays disabled",await refresh.isDisabled());
          await refresh.evaluate(n=>n.click());
          check(name+": disabled partial refresh starts no request",reads.length-start,2);
          if(phase==="background") {
            check(name+": old template remains during partial read",await child.getByRole("button",{name:/采购首次审批模板/}).count(),1);
            check(name+": partial filter preserves user change",await filter.inputValue(),"审批");
            check(name+": partial read preserves input focus",await filter.evaluate(n=>n===document.activeElement));
          }
          await shot(name+"-partial");
          const secondResponsePromise=page.waitForResponse(base+"/api/v1/org/admin/"+secondEndpoint);
          gates[secondEndpoint].release();
          await (await secondResponsePromise).finished();
          let failedSnapshot=null;
          if(secondFailure) {
            await waitState(phase==="initial" || secondFailure.status===403 ? secondFailure.state : "ready");
            await center.locator(".org-admin-notice").waitFor();
            failedSnapshot=await snapshot();
            check(name+": failed pair commits neither data set",failedSnapshot,before);
            check(name+": second failure respects original visibility",await child.count(),phase==="background"&&secondFailure.status===500?1:0);
            check(name+": second failure retains response trace",await center.locator(".org-admin-notice code").first().textContent(),"p34-"+secondFailure.id+"-"+secondEndpoint);
            await shot(name+"-failed");
          } else await ready();
          check(name+": response order observed",responseOrder,[firstEndpoint,secondEndpoint]);
          page.off("response",onResponse);
          if(secondFailure) {
            plan={mode:"normal",marker:"updated"};
            await center.getByRole("button",{name:phase==="initial"||secondFailure.status===403?"重新加载":"刷新数据",exact:true}).click();
            await ready();
            check(name+": recovery removes failure feedback",await center.locator(".org-admin-notice").count(),0);
          }
          const after=await snapshot();
          check(name+": both data sets commit together",after,{observedAt:"2026-08-27T10:00:00.000Z",templateName:"采购更新后审批模板"});
          check(name+": completion preserves current query",await filter.inputValue(),phase==="initial"?"采购":"审批");
          check(name+": completion removes loading panel",await center.locator(".org-approval-loading-c").count(),0);
          check(name+": completion enables refresh",await center.getByRole("button",{name:"刷新数据",exact:true}).isEnabled());
          check(name+": exact successful pair or recovery request count",reads.length-start,secondFailure?4:2);
          if(phase==="background"&&!secondFailure)check(name+": completion preserves input focus",await filter.evaluate(n=>n===document.activeElement));
          await shot(name+"-complete");
          orderedReads.push({width,phase,firstEndpoint,outcome:secondFailure?.id??"success",responseOrder:[...responseOrder],before,partial,failedSnapshot,after,requestCount:reads.length-start});
        } finally {gates.summary.release();gates.approvals.release();page.off("response",onResponse);}
      }`,
  );
  replace(
    "    requestCounts,\n  }),",
    "    requestCounts,\n    orderedReadScenarios: orderedReads.length,\n  }),",
  );
  return source;
}
