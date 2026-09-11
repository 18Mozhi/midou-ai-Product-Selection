import assert from "node:assert/strict";

export const accessCopy = {
  expired: {
    title: "请重新登录后继续",
    description: "为保护账号，当前页面未展示采集状态。重新登录后可以继续。",
    action: "重新登录",
  },
  forbidden: {
    title: "当前无法查看采集状态",
    description: "当前权限还不能读取这些内容。权限调整后，可以重新读取。",
    action: "重新读取状态",
  },
  blocked: {
    title: "暂时无法读取最新状态",
    description: "读取已安全停止，没有显示推测数据。服务恢复后可以重新读取。",
    action: "重新读取状态",
  },
};

export const accessHandler = `function handleAccessPrimary() {
  if (state.value === "expired") {
    void router.push("/login");
    return;
  }
  const heading = document.activeElement
    ?.closest(".adapter-center")?.querySelector<HTMLElement>(".adapter-heading");
  if (heading?.isConnected) heading.focus({ preventScroll: true });
  void load();
}
`;

export function previewAdapterAccess(source) {
  const title = `      :title="
        state === 'expired'
          ? '${accessCopy.expired.title}'
          : state === 'forbidden'
            ? '${accessCopy.forbidden.title}'
            : state === 'blocked'
              ? '${accessCopy.blocked.title}'
              : ''
      "
`;
  const description = `      :description="
        state === 'expired'
          ? '${accessCopy.expired.description}'
          : state === 'forbidden'
            ? '${accessCopy.forbidden.description}'
            : state === 'blocked'
              ? '${accessCopy.blocked.description}'
              : ''
      "
`;
  const changes = [
    [
      'import { computed, onMounted, ref, watch } from "vue";',
      'import { computed, onMounted, ref, watch } from "vue";\nimport { useRouter } from "vue-router";',
    ],
    [
      "const props = defineProps<{ apiBaseUrl: string }>(),",
      "const router = useRouter();\nconst props = defineProps<{ apiBaseUrl: string }>(),",
    ],
    ["onMounted(load);", accessHandler + "onMounted(load);"],
    ['<header class="adapter-heading">', '<header class="adapter-heading" tabindex="-1">'],
    ['      :kind="state"\n', '      :kind="state"\n' + title + description],
    [
      `      :primary-label="state === 'loading' ? '' : '重新读取状态'"`,
      `      :primary-label="state === 'loading' ? '' : state === 'expired' ? '${accessCopy.expired.action}' : '重新读取状态'"`,
    ],
    [
      '      @primary="load"',
      `      @primary="['expired', 'forbidden', 'blocked'].includes(state) ? handleAccessPrimary() : load()"`,
    ],
  ];
  for (const [before, after] of changes) {
    assert.equal(source.split(before).length, 2, `Unique access preview anchor: ${before}`);
    source = source.replace(before, after);
  }
  return source;
}
