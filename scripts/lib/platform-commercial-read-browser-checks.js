// Local P58 fixture host only. Playwright CLI invokes with capture=false by default.
// prettier-ignore
async (page, capture = page.url().endsWith("#review-capture")) => {
  if (!page.url().startsWith("http://127.0.0.1:5174/")) throw Error("Local review host required");
  const pattern = "**/api/v1/platform/commercial?**", held = [], results = [], requests = [], errors = [];
  const onError = error => errors.push(error.message);
  page.on("pageerror", onError);
  let mode = "ok";
  const handler = async route => {
    requests.push(route.request().method());
    if (route.request().method() !== "GET") throw Error("Unexpected write");
    if (mode === "hold") { held.push(route); return; }
    if (mode === "ok") return route.continue();
    // Exact existing m06-06-commercial.spec.ts read-failure envelope.
    return route.fulfill({status:Number(mode),json:{error:{message:"blocked"},request_id:"m06-06-state",trace_id:"m06-06-state"}});
  };
  await page.route(pattern,handler);
  await page.clock.install();
  const release = async () => { for (const route of held.splice(0)) await route.abort().catch(()=>{}); };
  const shot = async (width,name,locator) => {
    if (!capture) return;
    await locator.scrollIntoViewIfNeeded();
    await page.mouse.move(0,0);
    await locator.screenshot({path:`../p58-read-feedback-r1/P58-${width}-${name}.png`,animations:"disabled"});
  };
  try {
    for (const width of [390,1440]) {
      await page.setViewportSize({width,height:width===390?844:1000});
      for (const status of [429,503]) {
        mode=String(status);
        await page.goto("http://127.0.0.1:5174/platform-admin/commercial?organization_id=o1");
        const panel=page.locator(".commercial--review > .state");
        await panel.getByText(status===429?"请求过于频繁":"配额管理依赖受阻",{exact:true}).waitFor();
        if(await page.locator(".commercial--review > .notice").count())throw Error("Duplicate initial failure notice");
        if(!await page.getByRole("textbox",{name:"组织内部编号",exact:true}).isEditable())throw Error("Cannot correct failed scope");
        await panel.locator("summary").click();
        if(!(await panel.textContent()).includes("m06-06-state"))throw Error("Missing failure trace");
        await shot(width,String(status),panel);
        results.push({width,state:status,oneFeedback:true,trace:true,scopeEditable:true});
      }
      mode="hold";
      await page.goto("http://127.0.0.1:5174/platform-admin/commercial?organization_id=o1");
      await page.locator(".commercial-loading").waitFor();
      await shot(width,"loading",page.locator(".commercial-loading"));
      await page.clock.fastForward(15001);
      const panel=page.locator(".commercial--review > .state");
      await panel.getByText("读取超时，尚未取得数据，请稍后重试。",{exact:true}).waitFor();
      if((await panel.textContent()).includes("已保留"))throw Error("False snapshot claim");
      await release();
      const retry=panel.getByRole("button",{name:"重新读取",exact:true});
      await retry.focus();await page.keyboard.press("Tab");await page.keyboard.press("Shift+Tab");
      const focused=await retry.evaluate(x=>x.matches(":focus-visible")&&getComputedStyle(x).outlineColor==="rgb(47, 110, 229)");
      if(!focused)throw Error("Missing blue retry focus");
      await shot(width,"initial-timeout",panel);
      mode="ok";
      await retry.click();
      await page.getByText("380 / 1050",{exact:true}).waitFor();
      mode="hold";
      await Promise.all([page.waitForRequest(r=>r.url().includes("/platform/commercial?")),page.getByRole("button",{name:"刷新数据",exact:true}).click()]);
      await page.clock.fastForward(15001);
      const notice=page.locator(".commercial--review > .notice");
      await notice.waitFor();
      if(!(await notice.textContent()).includes("读取超时，已保留上次成功数据，请稍后重试。"))throw Error("Retained hint changed");
      if(!await page.getByText("380 / 1050",{exact:true}).isVisible())throw Error("Lost retained usage");
      await shot(width,"retained-timeout",notice);
      await release();
      if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error("Page overflow");
      results.push({width,state:"timeout-and-recovery",initialAccurate:true,retrySuccess:true,retainedUsage:true,blueFocus:true,noOverflow:true});
    }
    if (errors.length) throw Error(JSON.stringify(errors));
    return {results,requests,errors,clock:"Browser timers advanced 15001ms; no production timeout changes",capture};
  } finally {
    await release();
    await page.unroute(pattern,handler);
    await page.clock.resume();
    page.off("pageerror", onError);
  }
}
