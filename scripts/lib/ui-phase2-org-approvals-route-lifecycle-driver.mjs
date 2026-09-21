import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { readOrderVueDriver } from "./ui-phase2-org-approvals-read-order-driver.mjs";

export const routeLifecycleOutput = "output/playwright/p34-route-lifecycle-vue-c-r1";
export function routeLifecycleVueDriver(input) {
  assert.equal(
    createHash("sha256")
      .update(
        readFileSync(
          "scripts/lib/ui-phase2-org-approvals-read-order-driver.mjs",
          "utf8",
        ).replaceAll("\r\n", "\n"),
      )
      .digest("hex"),
    "2c8129c6045db6b5ee2e8d5cfc70c7b3d18d7e638e4fe0bb047e9092d58c4231",
  );
  let source = readOrderVueDriver(input);
  const replace = (before, after) => {
    assert.equal(source.split(before).length, 2, `One route-lifecycle anchor: ${before}`);
    source = source.replace(before, after);
  };
  replace(
    'const output = "output/playwright/p34-read-order-vue-c-r1";',
    `const output = "${routeLifecycleOutput}";`,
  );
  replace(
    "const currentSources = new Set([...sources,",
    `const currentSources = new Set([...sources,
  "scripts/lib/ui-phase2-org-approvals-route-lifecycle-driver.mjs",
  "scripts/verify-ui-phase2-org-approvals-route-lifecycle-vue.mjs",`,
  );
  replace(
    "const requestCounts = [], focusStates = [], orderedReads = [];",
    "const requestCounts = [], focusStates = [], orderedReads = [], routeRuns = [];",
  );
  replace(
    'kind: "P34-READ-ORDER-VUE-C-r1",',
    'kind: "P34-ROUTE-LIFECYCLE-VUE-C-r1",\n        routeRuns,',
  );
  replace(
    "      requestCounts.push({ width, parentReads: reads.length, writes: writes.length });",
    `      for(const phase of ["initial","background"]) for(const releaseTiming of ["away","returned"]) for(const failure of [null,{id:"server-error",status:500,state:"error"},{id:"permission-forbidden",status:403,state:"forbidden"}]) {
        const outcome=failure?.id??"success",name="route-"+phase+"-"+releaseTiming+"-"+outcome;
        const snapshot=n=>{const vm=n.__vueParentComponent,owner=vm.parent,s=vm.setupState;return {uid:vm.uid,cacheUid:owner.uid,ownerType:owner.type.name,cacheType:owner.parent.type.name,deactivated:owner.isDeactivated,unmounted:vm.isUnmounted||owner.isUnmounted,connected:n.isConnected,state:n.getAttribute("data-state"),busy:n.getAttribute("aria-busy"),observedAt:s.summary?.observed_at??null,templateName:s.data?.templates?.[1]?.name??null};};
        plan={mode:"normal",marker:"original"};
        if(phase==="background"){await visit();await ready();}
        const pending=hold(),start=reads.length;
        const requestsStarted=Promise.all(["summary","approvals"].map(endpoint=>page.waitForRequest(base+"/api/v1/org/admin/"+endpoint)));
        plan={mode:"route-hold",marker:"updated",failure,target:"approvals",gate:pending.gate};
        if(phase==="initial"){await visit();await center.waitFor();}else await center.getByRole("button",{name:"刷新数据",exact:true}).click();
        await requestsStarted;
        const cached=await center.elementHandle(),before=await cached.evaluate(snapshot);
        check(name+": exact asynchronous cache ownership",[before.ownerType,before.cacheType],["AsyncComponentWrapper","KeepAlive"]);
        check(name+": pending pair started",reads.length-start,2);
        check(name+": pending component active",[before.connected,before.deactivated,before.unmounted],[true,false,false]);
        check(name+": original component busy",before.busy,"true");
        await shot(name+"-pending");
        plan={mode:"normal",marker:"original"};
        await page.getByRole("navigation",{name:"面包屑",exact:true}).locator('a[href="/org-admin"]').click();
        await page.waitForURL(url=>url.pathname==="/org-admin");
        await ready();
        check(name+": destination is not approvals",await center.getAttribute("data-approval-c-view"),"false");
        const away=await cached.evaluate(snapshot),destination=await center.elementHandle();
        check(name+": old component cached and detached",[away.connected,away.deactivated,away.unmounted],[false,true,false]);
        const destinationBefore=await destination.evaluate(n=>{const vm=n.__vueParentComponent,s=vm.setupState;return {uid:vm.uid,name:s.data?.name,state:n.getAttribute("data-state"),notice:s.notice,observedAt:s.summary?.observed_at};});
        check(name+": destination has distinct instance",destinationBefore.uid!==before.uid);
        const destinationUrl=page.url();
        const destinationRefresh=center.getByRole("button",{name:"刷新数据",exact:true});
        await destinationRefresh.focus();
        const goBack=async()=>{
          await page.goBack();await page.waitForURL(url=>url.pathname==="/org-admin/approvals");
          await page.waitForFunction(n=>n.isConnected,cached);
          check(name+": history reuses original component",await cached.evaluate(n=>n===document.querySelector(".org-admin-center")));
          check(name+": returning keeps original query",new URL(page.url()).searchParams.get("approval_template_query"),"采购");
          check(name+": returning preserves unrelated query",new URL(page.url()).searchParams.get("keep"),"external");
        };
        if(releaseTiming==="returned"){
          await goBack();
          check(name+": return before response keeps busy",await center.getAttribute("aria-busy"),"true");
        }
        const responses=Promise.all(["summary","approvals"].map(endpoint=>page.waitForResponse(base+"/api/v1/org/admin/"+endpoint)));
        pending.release();
        for(const response of await responses)await response.finished();
        await page.waitForFunction(n=>n.getAttribute("aria-busy")==="false",cached);
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        const settled=await cached.evaluate(snapshot);
        const expectedState=failure&&(phase==="initial"||failure.status===403)?failure.state:"ready";
        check(name+": cached completion follows original failure rule",settled.state,expectedState);
        check(name+": cached completion keeps same identity",[settled.uid,settled.cacheUid],[before.uid,before.cacheUid]);
        check(name+": completion updates only original data",[settled.observedAt,settled.templateName],failure?[before.observedAt,before.templateName]:["2026-08-27T10:00:00.000Z","采购更新后审批模板"]);
        let destinationAfter=null;
        if(releaseTiming==="away"){
          destinationAfter=await destination.evaluate(n=>{const vm=n.__vueParentComponent,s=vm.setupState;return {uid:vm.uid,name:s.data?.name,state:n.getAttribute("data-state"),notice:s.notice,observedAt:s.summary?.observed_at};});
          check(name+": late response cannot alter destination",destinationAfter,destinationBefore);
          check(name+": late response cannot rewrite destination URL",page.url(),destinationUrl);
          check(name+": late response cannot steal destination focus",await destinationRefresh.evaluate(n=>n===document.activeElement));
          check(name+": settled old component remains cached",[settled.connected,settled.deactivated,settled.unmounted],[false,true,false]);
          await goBack();
        }
        check(name+": returned state belongs to original request",await center.getAttribute("data-state"),expectedState);
        check(name+": returned content follows original rule",await child.count(),failure&&(phase==="initial"||failure.status===403)?0:1);
        await shot(name+"-returned");
        if(failure){
          check(name+": returned failure keeps original trace",await center.locator(".org-admin-notice code").first().textContent(),"p34-"+failure.id+"-approvals");
          plan={mode:"normal",marker:"updated"};
          await center.getByRole("button",{name:phase==="initial"||failure.status===403?"重新加载":"刷新数据",exact:true}).click();
          await ready();
        }
        check(name+": final filter remains usable",await child.getByRole("searchbox",{name:"搜索模板",exact:true}).inputValue(),"采购");
        check(name+": no new parent read just for history",reads.length-start,failure?5:3);
        routeRuns.push({width,phase,releaseTiming,outcome,before,away,settled,destinationBefore,destinationAfter,requestCount:reads.length-start});
        await cached.dispose();await destination.dispose();
      }
      requestCounts.push({ width, parentReads: reads.length, writes: writes.length });`,
  );
  replace(
    "    orderedReadScenarios: orderedReads.length,",
    "    orderedReadScenarios: orderedReads.length,\n    routeScenarios: routeRuns.length,",
  );
  replace("      const first = hold();", "      if (!smoke) {\n      const first = hold();");
  replace(
    '      for(const phase of ["initial","background"]) for(const releaseTiming',
    '      }\n      for(const phase of ["initial","background"]) for(const releaseTiming',
  );
  return source;
}
