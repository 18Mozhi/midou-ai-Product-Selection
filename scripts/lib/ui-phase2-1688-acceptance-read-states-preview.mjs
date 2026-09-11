import assert from "node:assert/strict";
import { previewAlibaba1688AcceptanceCenter } from "./ui-phase2-1688-acceptance-page-preview.mjs";

const once = (source, anchor, replacement, label) => {
  assert.equal(source.split(anchor).length, 2, label);
  return source.replace(anchor, replacement);
};

const oldNotice = `    <p
      v-if="notice"
      class="acceptance-1688__notice"
      :data-tone="noticeTone"
      role="status"
      aria-live="polite"
    >
      {{ notice }}
    </p>`;

const notice = `    <section
      v-if="notice"
      class="acceptance-1688__notice p49-read__notice"
      :data-tone="noticeTone"
      role="status"
      aria-live="polite"
    >
      <div>
        <span>{{ noticeTone === "danger" ? "刷新未完成" : "刷新完成" }}</span>
        <strong>{{ noticeTone === "danger" ? "仍显示上次读取的启用条件" : "已显示最新启用条件" }}</strong>
        <p>{{ notice }}</p>
      </div>
      <button v-if="noticeTone === 'danger'" type="button" :disabled="refreshing" @click="load">
        {{ refreshing ? "重新刷新中…" : "重新刷新" }}
      </button>
    </section>`;

const oldState = `    <section v-if="state !== 'ready'" class="acceptance-1688__state" :data-kind="state">
      <span aria-hidden="true">{{ state === "loading" ? "···" : "!" }}</span>
      <div aria-live="polite">
        <p>启用检查</p>
        <h3>{{ stateTitle }}</h3>
        <p>{{ message || "正在核对登录、验证码和字段解析三项证据。" }}</p>
        <details v-if="requestId">
          <summary>故障详情</summary>
          <code>关联编号：{{ requestId }}</code>
        </details>
      </div>
      <RouterLink v-if="state === 'expired'" to="/login">重新登录</RouterLink>
      <RouterLink v-else-if="state === 'forbidden'" to="/platform-admin">返回平台概览</RouterLink>
      <button v-else-if="state !== 'loading'" type="button" :disabled="refreshing" @click="load">
        重新读取
      </button>
    </section>`;

const state = `    <section
      v-if="state !== 'ready'"
      class="acceptance-1688__state p49-read__state"
      :data-kind="state"
      :aria-labelledby="\`p49-read-\${state}-title\`"
    >
      <span aria-hidden="true">{{ state === "loading" ? "···" : state === "error" ? "!" : "i" }}</span>
      <div aria-live="polite">
        <p>{{ state === "loading" ? "正在读取" : state === "error" ? "本次读取未完成" : "访问说明" }}</p>
        <h3 :id="\`p49-read-\${state}-title\`">
          {{
            state === "loading"
              ? "正在核对启用条件"
              : state === "error"
                ? "这次没有读到启用条件"
                : state === "forbidden"
                  ? "当前无法查看启用条件"
                  : "登录状态已失效"
          }}
        </h3>
        <p>
          {{
            state === "loading"
              ? "正在读取登录态、验证码和字段解析三项真实证据。"
              : state === "error"
                ? "可以重新读取；本次失败不会启用或停用来源。"
                : state === "forbidden"
                  ? "当前账号还没有查看此页面的权限，可以返回平台概览继续处理其他工作。"
                  : "重新登录后可以返回此页继续检查；本次没有更改来源状态。"
          }}
        </p>
        <details v-if="message || requestId">
          <summary>查看服务提示</summary>
          <p v-if="message">{{ message }}</p>
          <code v-if="requestId">关联编号：{{ requestId }}</code>
        </details>
      </div>
      <RouterLink v-if="state === 'expired'" to="/login">重新登录</RouterLink>
      <RouterLink v-else-if="state === 'forbidden'" to="/platform-admin">返回平台概览</RouterLink>
      <button v-else-if="state !== 'loading'" type="button" :disabled="refreshing" @click="load">
        重新读取
      </button>
    </section>`;

export const acceptanceReadStateCopy = {
  loading: "正在核对启用条件",
  error: "这次没有读到启用条件",
  forbidden: "当前无法查看启用条件",
  expired: "登录状态已失效",
  preserved: "仍显示上次读取的启用条件",
};

export function previewAlibaba1688AcceptanceReadStates(source) {
  let review = previewAlibaba1688AcceptanceCenter(source);
  review = once(review, oldNotice, notice, "P49 read notice anchor");
  review = once(review, oldState, state, "P49 read state anchor");
  return review;
}
