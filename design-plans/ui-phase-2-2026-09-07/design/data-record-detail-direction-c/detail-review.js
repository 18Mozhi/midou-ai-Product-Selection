(() => {
  const composed = window.DATA_COMPOSED_C;
  const style = document.createElement("link");
  style.rel = "stylesheet";
  style.href = "../data-record-detail-direction-c/detail.css";
  composed.roots.records.append(style);
  const data = window.DATA_RECORDS_DATA;
  const original = structuredClone(data.synthetic);
  const samples = {};
  for (const entity of ["opportunities", "competitors", "suppliers"]) {
    const label = data.entities.find((v) => v.value === entity).label;
    samples[entity] = { entity, scene: entity, label: `${label} · 合成投影样例`, long: false };
    samples[`${entity}-long`] = {
      entity,
      scene: entity,
      label: `${label} · 长内容排版样例`,
      long: true,
    };
  }
  samples["suppliers-original"] = {
    entity: "suppliers",
    scene: "original-supplier",
    label: "供应商 · 原始隔离夹具",
    long: false,
  };
  const select = document.getElementById("detail-sample");
  for (const [value, sample] of Object.entries(samples))
    select.add(new Option(sample.label, value));
  function prepare(key) {
    const sample = samples[key];
    if (!sample) throw Error("Unknown detail sample " + key);
    if (Object.values(composed.roots).some((r) => r.querySelector("dialog[open]"))) return false;
    data.synthetic = structuredClone(original);
    if (sample.long) {
      const row = data.synthetic[sample.entity].items[0];
      // Presentation-only expansion of explicit fixture strings; metrics/status/time stay unchanged.
      row.title = `${row.title}（合成长文）`.repeat(8);
      row.organization_name = "合成长组织名称".repeat(12);
      row.workspace_name = "合成长工作区".repeat(10);
      row.category = `${row.category}（合成长文）`.repeat(8);
      row.market = `${row.market}（合成长文）`.repeat(8);
      row.id = `synthetic-${sample.entity}-`.repeat(20);
    }
    try {
      composed.scene(`records:${sample.scene}`);
    } finally {
      // Controllers clone at scene preparation. Do not contaminate later composed scenarios.
      data.synthetic = structuredClone(original);
    }
    select.value = key;
    document.getElementById("sample-note").textContent = sample.label + "；不是实时平台数据。";
    return true;
  }
  select.onchange = () => prepare(select.value);
  // Keep the data-origin caveat inside the opened modal, even when the background is occluded.
  composed.roots.records.addEventListener("click", (event) => {
    if (!event.target.closest?.("[data-record]")) return;
    const state = composed.controls.records.state();
    const description = composed.roots.records.getElementById("detail-description");
    if (description)
      description.textContent += state.synthetic
        ? " 合成样例，非实时记录；0可能来自原始空值的现有转换，不是新增测量。"
        : " 原始 UI2-DG54 隔离夹具，非实时记录。";
  });
  window.DATA_RECORD_DETAIL_C = { samples, prepare };
  prepare("opportunities");
})();
