"use strict";
const evidence = window.SCOUTOPS_REPRESENTATIVES;
const pageChoice = document.getElementById("page-choice");
const widthChoice = document.getElementById("width-choice");
const stateChoice = document.getElementById("state-choice");
const shotImage = document.getElementById("shot-image");
const status = document.getElementById("shot-status");

function option(value, text) {
  const node = document.createElement("option");
  node.value = value;
  node.textContent = text;
  return node;
}

function render() {
  const shot = evidence.shots.find(
    (item) =>
      item.pageId === pageChoice.value &&
      item.viewport.width === Number(widthChoice.value) &&
      item.state === stateChoice.value,
  );
  if (!shot) throw new Error("Missing explicit evidence state");
  const label = `${shot.pageId} ${shot.title} · ${shot.label} · ${shot.viewport.width}px`;
  status.textContent = `${label} · 正在加载截图`;
  shotImage.alt = `${label}；当前 Vue 隔离夹具基线，待审核`;
  shotImage.onload = () => {
    status.textContent = `${label} · 截图已加载 · 功能用例通过，视觉未验收${shot.pageOverflow ? ` · 已发现横向溢出：页面 ${shot.layout.documentWidth}px` : " · 当前采样未见页面横向溢出"}`;
  };
  shotImage.onerror = () => {
    status.textContent = `${label} · 截图加载失败，请重新生成并校验`;
  };
  shotImage.src = shot.file;
  document.getElementById("shot-frame").dataset.width = String(shot.viewport.width);
  document.getElementById("image-link").href = shot.file;
  document.getElementById("spec-link").href = `page-specs/${shot.pageId}.md`;
  document.getElementById("test-source").textContent =
    `${shot.testFile} · ${shot.testTitle} · ${shot.capturedAt}`;
  document.getElementById("assertions").replaceChildren(
    ...shot.assertions.map((text) => {
      const item = document.createElement("li");
      item.textContent = text;
      return item;
    }),
  );
  document.getElementById("hashes").textContent =
    `源码提交 ${shot.sourceRevision}；清单 ${shot.sourceFingerprint}；图片 SHA256 ${shot.sha256}`;
}

function changePage() {
  const definition = evidence.definitions.find((item) => item.id === pageChoice.value);
  stateChoice.replaceChildren(
    ...Object.entries(definition.states).map(([state, label]) => option(state, label)),
  );
  render();
}

pageChoice.replaceChildren(
  ...evidence.definitions.map((item) => option(item.id, `${item.id} ${item.title}`)),
);
pageChoice.addEventListener("change", changePage);
widthChoice.addEventListener("change", render);
stateChoice.addEventListener("change", render);
changePage();
