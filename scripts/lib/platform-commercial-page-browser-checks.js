// Playwright CLI run-code --filename; start from the observed P58 organization fixture page.
// prettier-ignore
async (page) => {
  const countReads = () =>
    page.evaluate(
      () =>
        performance
          .getEntriesByType("resource")
          .filter((x) => x.name.includes("/platform/commercial?")).length,
    )
  const before = await countReads()
  const plans = page.getByRole("button", { name: "方案目录 全局配置与额度" })
  const org = page.getByRole("button", { name: "组织配额 读取组织、分配与用量" })
  await org.click()
  const start = page.getByRole("textbox", { name: "开始", exact: true })
  await start.fill("2026-08-02T08:00")
  await plans.click()
  await org.click()
  if ((await start.inputValue()) !== "2026-08-02T08:00") throw Error("draft lost on switch")
  const after = await countReads()
  if (before !== after) throw Error("switch refetched")
  await start.fill("2026-08-01T08:00")
  await page.getByRole("button", { name: "新建配额方案", exact: true }).click()
  if (!(await page.getByRole("dialog", { name: "新建配额方案", exact: true }).isVisible()))
    throw Error("dialog hidden")
  await page.getByRole("button", { name: "关闭新建配额方案", exact: true }).click()
  const results = []
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 })
    for (const task of ["organization", "plans"]) {
      await (task === "organization" ? org : plans).click()
      await page.mouse.move(0, 0)
      await page.evaluate(async () => {
        scrollTo(0, 0)
        await document.fonts.ready
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      })
      const state = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        headingCount: document.querySelectorAll("h1").length,
        small: [
          ...document.querySelectorAll(
            ".commercial--review button,.commercial--review input,.commercial--review select",
          ),
        ]
          .filter((x) => x.checkVisibility())
          .filter((x) => x.getBoundingClientRect().height < 43)
          .map((x) => x.textContent.trim()),
        visibleSummary: document.querySelector(".commercial-summary").checkVisibility(),
        visibleUsage: document.querySelector(".membership").checkVisibility(),
      }))
      if (state.overflow || state.headingCount !== 1 || state.small.length)
        throw Error(JSON.stringify({ width, task, state }))
      if (
        state.visibleSummary !== (task === "plans") ||
        state.visibleUsage !== (task === "organization")
      )
        throw Error("scope visibility")
      // Regression runs are read-only; capture reviewed images with explicit CLI screenshot commands.
      results.push({ width, task, ...state })
    }
  }
  await org.focus()
  await page.keyboard.press("Tab")
  await page.keyboard.press("Shift+Tab")
  const focus = await org.evaluate((x) => ({
    visible: x.matches(":focus-visible"),
    outline: getComputedStyle(x).outlineColor,
    width: getComputedStyle(x).outlineWidth,
  }))
  if (!focus.visible || focus.outline !== "rgb(47, 110, 229)" || focus.width !== "3px")
    throw Error(JSON.stringify(focus))
  await page.getByRole("textbox", { name: "搜索", exact: true }).fill("no-match-review")
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("query=no-match-review")),
    page.getByRole("button", { name: "查询", exact: true }).click(),
  ])
  await page
    .getByText("当前筛选条件没有匹配的配额方案，请调整搜索或状态。", { exact: true })
    .waitFor()
  if (
    (await page
      .locator(".commercial-summary article strong")
      .allTextContents()
      .then((x) => x.join(","))) !== "1,1,0,0"
  )
    throw Error("global summary changed with filter")
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes("/platform/commercial?") && !r.url().includes("no-match-review"),
    ),
    page.getByRole("button", { name: "重置", exact: true }).click(),
  ])
  await page.locator(".commercial-plan-table").waitFor()
  await org.click()
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes("/platform/commercial?") && !r.url().includes("organization_id"),
    ),
    page.getByRole("button", { name: "清除组织", exact: true }).click(),
  ])
  await page
    .getByText("尚未读取组织。填写组织内部编号后，点击“读取组织”。", { exact: true })
    .waitFor()
  const input = page.getByRole("textbox", { name: "组织内部编号", exact: true })
  await input.fill("o1")
  const invalidBefore = await countReads()
  await page.getByRole("button", { name: "读取组织", exact: true }).click()
  if ((await input.evaluate((x) => x.validity.valid)) || (await countReads()) !== invalidBefore)
    throw Error("invalid UUID submission")
  await input.fill("")
  await input.blur()
  await page.mouse.move(0, 0)
  await page.evaluate(() => scrollTo(0, 0))
  return {
    switchRequests: after - before,
    draftRetained: true,
    originalDialogOpens: true,
    filterSummaryUnchanged: true,
    resetRestored: true,
    clearOrganization: true,
    invalidUuidBlocked: true,
    focus,
    results,
  }
}
