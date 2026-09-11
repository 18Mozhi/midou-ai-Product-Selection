import assert from "node:assert/strict";

const once = (source, anchor, replacement, label) => {
  assert.equal(source.split(anchor).length, 2, label);
  return source.replace(anchor, replacement);
};

export const sourceStateCopy = {
  loading: {
    eyebrow: "来源目录",
    title: "正在读取来源目录",
    description: "正在获取可用来源、准备状态和最近采集信息。",
  },
  empty: {
    eyebrow: "来源目录",
    title: "还没有可显示的来源",
    description: "目录已成功读取，但当前没有来源频道。可以重新加载，确认登记结果。",
  },
  expired: {
    eyebrow: "会话状态",
    title: "登录状态已失效",
    description: "为保护账号，当前未展示来源信息。重新登录后，可以继续查看来源目录。",
  },
  forbidden: {
    eyebrow: "访问范围",
    title: "当前无法查看来源目录",
    description: "当前权限还不能读取这些内容。权限调整后，可以重新加载。",
  },
  blocked: {
    eyebrow: "服务状态",
    title: "来源目录暂时不可用",
  },
  error: {
    eyebrow: "读取结果",
    title: "来源目录未能读取",
  },
};

export const sourceStateHandler = `async function handleSourceStatePrimary() {
  if (state.value === "expired") {
    void router.push("/login");
    return;
  }
  const pageHeading = document.querySelector<HTMLElement>(".source-center .source-guide h2");
  pageHeading?.focus({ preventScroll: true });
  await load();
  await nextTick();
  if (state.value === "ready") pageHeading?.focus({ preventScroll: true });
  else
    document
      .querySelector<HTMLElement>(".source-center .p48-source-state-primary")
      ?.focus({ preventScroll: true });
}
`;

export function previewProviderSourcesStates(source) {
  let review = once(
    source,
    'import { computed, onMounted, reactive, ref, watch } from "vue";',
    'import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";',
    "Vue import must be unique",
  );
  review = once(
    review,
    "onMounted(load);",
    `${sourceStateHandler}\nonMounted(load);`,
    "mount anchor must be unique",
  );
  review = once(
    review,
    "        <h2>多平台、多国家来源已自动登记</h2>",
    '        <h2 tabindex="-1">多平台、多国家来源已自动登记</h2>',
    "page heading anchor must be unique",
  );
  review = once(
    review,
    `    <p v-if="message" class="source-message" role="status">
      {{ message }} <code v-if="requestId">{{ requestId }}</code>
    </p>
    <div v-if="state === 'loading'" class="source-state">正在读取来源目录…</div>
    <div v-else-if="state !== 'ready'" class="source-state" :data-kind="state">
      <strong>{{
        state === "empty"
          ? "还没有来源目录"
          : state === "expired"
            ? "登录已过期"
            : state === "forbidden"
              ? "当前账号不能管理平台来源"
              : "来源服务暂不可用"
      }}</strong>
      <p>{{ message }}</p>
      <button v-if="!['expired', 'forbidden'].includes(state)" @click="load">重新加载</button>
    </div>`,
    `    <p v-if="message && state === 'ready'" class="source-message" role="status">
      {{ message }} <code v-if="requestId">{{ requestId }}</code>
    </p>
    <div class="p48-source-state-host" aria-live="polite" aria-atomic="true">
      <section
        v-if="state !== 'ready'"
        class="p48-source-state-panel"
        :data-kind="state"
        :aria-busy="state === 'loading'"
        :aria-labelledby="\`p48-source-state-\${state}\`"
      >
        <p class="p48-source-state-eyebrow">{{
          state === "loading"
            ? "来源目录"
            : state === "empty"
              ? "来源目录"
              : state === "expired"
                ? "会话状态"
                : state === "forbidden"
                  ? "访问范围"
                  : state === "blocked"
                    ? "服务状态"
                    : "读取结果"
        }}</p>
        <h2 :id="\`p48-source-state-\${state}\`">{{
          state === "loading"
            ? "正在读取来源目录"
            : state === "empty"
              ? "还没有可显示的来源"
              : state === "expired"
                ? "登录状态已失效"
                : state === "forbidden"
                  ? "当前无法查看来源目录"
                  : state === "blocked"
                    ? "来源目录暂时不可用"
                    : "来源目录未能读取"
        }}</h2>
        <p class="p48-source-state-description">{{
          state === "loading"
            ? "正在获取可用来源、准备状态和最近采集信息。"
            : state === "empty"
              ? "目录已成功读取，但当前没有来源频道。可以重新加载，确认登记结果。"
              : state === "expired"
                ? "为保护账号，当前未展示来源信息。重新登录后，可以继续查看来源目录。"
                : state === "forbidden"
                  ? "当前权限还不能读取这些内容。权限调整后，可以重新加载。"
                  : message || "来源服务暂时不可用，请稍后重新加载。"
        }}</p>
        <details v-if="requestId" class="p48-source-state-technical">
          <summary>技术详情</summary>
          <code>{{ requestId }}</code>
        </details>
        <button
          v-if="state !== 'loading'"
          type="button"
          class="p48-source-state-primary"
          @click="handleSourceStatePrimary"
        >
          {{ state === "expired" ? "重新登录" : "重新加载目录" }}
        </button>
      </section>
    </div>`,
    "source state block must be unique",
  );
  review = once(
    review,
    `    <section
      v-else
      id="source-results"`,
    `    <section
      v-if="state === 'ready'"
      id="source-results"`,
    "ready directory anchor must be unique",
  );
  return review;
}
