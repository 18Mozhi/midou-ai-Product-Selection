(() => {
  "use strict";
  const help = {
    "filter-action": "填写完整操作代码，例如 organization.member.invited；留空不限。",
    "filter-outcome": "按执行结果筛选；选择“全部结果”不限制结果。",
    "filter-resource_type": "填写完整对象类型，例如 membership；不是对象 ID。",
    "filter-request_id": "填写完整 request_id，精确定位一次请求；留空不限。",
    "filter-trace_id": "填写完整 trace_id，精确筛选同一追踪号；留空不限。",
    "filter-occurred_from": "按本地时间输入；提交时转换为 ISO 时间。可以只填开始时间。",
    "filter-occurred_to": "可以只填结束时间；两项都填写时，结束不能早于开始。",
    "loaded-query": "仅搜索已加载的操作、对象类型、结果及请求/追踪号，不会查询服务器。",
  };
  function update(input) {
    const count = document.getElementById(input.id + "-count");
    const next = input.value.length + " / " + input.maxLength;
    if (count && count.textContent !== next) count.textContent = next;
    const from = document.getElementById("filter-occurred_from");
    const to = document.getElementById("filter-occurred_to");
    if (from && to) {
      from.max = to.value;
      to.min = from.value;
    }
  }
  function enhance() {
    for (const [id, text] of Object.entries(help)) {
      const input = document.getElementById(id);
      if (!input) continue;
      const label = input.closest("label");
      if (!document.getElementById(id + "-help")) {
        const caption = document.createElement("span");
        caption.className = "field-caption";
        const name = document.createElement("span");
        name.id = id + "-name";
        name.textContent = label.firstChild.textContent;
        label.firstChild.replaceWith(caption);
        caption.append(name);
        if (input.maxLength > 0) {
          const count = document.createElement("span");
          count.id = id + "-count";
          count.className = "field-count";
          caption.append(count);
        }
        const hint = document.createElement("span");
        hint.id = id + "-help";
        hint.className = "field-help";
        hint.textContent = text;
        label.append(hint);
        input.setAttribute("aria-labelledby", name.id);
        const ids = [input.getAttribute("aria-describedby"), hint.id];
        if (input.maxLength > 0) ids.push(id + "-count");
        input.setAttribute("aria-describedby", ids.filter(Boolean).join(" "));
      }
      update(input);
    }
    const footer = document.querySelector("#server-form footer");
    if (footer && !document.getElementById("server-actions-help")) {
      const hint = document.createElement("p");
      hint.id = "server-actions-help";
      hint.className = "filter-action-help";
      hint.textContent = "应用筛选会查询服务器。重置会清空这七项条件及页内搜索，并重新查询第一页。";
      footer.append(hint);
      document.getElementById("reset").setAttribute("aria-describedby", hint.id);
    }
  }
  document.getElementById("app").addEventListener("input", (event) => {
    if (Object.hasOwn(help, event.target.id)) update(event.target);
  });
  new MutationObserver(enhance).observe(document.getElementById("app"), {
    subtree: true,
    childList: true,
  });
  enhance();
})();
