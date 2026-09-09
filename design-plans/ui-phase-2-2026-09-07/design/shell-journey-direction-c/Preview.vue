<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import SelectionJourney from "../../../../apps/web/src/components/SelectionJourney.vue";
import "./composition.css";

// Review-only shell. The child is the unchanged production SelectionJourney component.
const props = defineProps({ profile: { type: Object, required: true } });
const route = useRoute();
const query = ref("");
const drawer = ref(null);
const menuOpen = ref(false);
const notice = ref("");
let trigger;
const groups = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase();
  const grouped = new Map();
  for (const item of props.profile.items) {
    if (!`${item.label} ${item.group}`.toLocaleLowerCase().includes(needle)) continue;
    grouped.set(item.group, [...(grouped.get(item.group) ?? []), item]);
  }
  return [...grouped].map(([label, items]) => ({ label, items }));
});
const inJourney = computed(() => route.path === "/opportunities/start");
function closeMenu() {
  if (drawer.value?.open) drawer.value.close();
}
async function openMenu(event) {
  trigger = event.currentTarget;
  drawer.value.showModal();
  menuOpen.value = true;
  await nextTick();
  drawer.value.querySelector("button").focus();
}
function closed() {
  menuOpen.value = false;
  if (trigger?.isConnected && trigger.getClientRects().length) trigger.focus();
  else document.querySelector(".composition-brand")?.focus();
}
function resize() {
  if (innerWidth > 840) closeMenu();
}
onMounted(() => window.addEventListener("resize", resize));
function trap(event) {
  if (event.key !== "Tab") return;
  const nodes = [...drawer.value.querySelectorAll("button,a,input,summary")].filter(
    (node) => !node.disabled && node.getClientRects().length,
  );
  if (event.shiftKey && document.activeElement === nodes[0]) {
    event.preventDefault();
    nodes.at(-1).focus();
  } else if (!event.shiftKey && document.activeElement === nodes.at(-1)) {
    event.preventDefault();
    nodes[0].focus();
  }
}
watch(
  () => route.path,
  () => {
    query.value = "";
    closeMenu();
  },
);
onBeforeUnmount(() => {
  closeMenu();
  window.removeEventListener("resize", resize);
});
</script>

<template>
  <div class="composition-preview">
    <aside class="composition-boundary">
      SHELL-JOURNEY-C-r1 · 成员壳层组合待审 / 右侧为真实 Vue，数据为隔离样本，非生产
    </aside>
    <header class="composition-topbar">
      <RouterLink class="composition-brand" to="/home">m. 米豆智选</RouterLink>
      <button
        class="composition-menu-trigger"
        aria-controls="composition-menu"
        :aria-expanded="menuOpen"
        @click="openMenu"
      >
        导航
      </button>
      <nav aria-label="成员全局操作">
        <button @click="notice = '主题浮层已有独立稿，本组合未装配，不代表完成。'">主题</button>
        <button @click="notice = '搜索已有独立稿，本组合未装配，不发起搜索。'">搜索</button>
        <button @click="notice = '快捷创建已有独立稿，本组合未装配，不创建业务对象。'">
          创建选品
        </button>
        <RouterLink to="/notifications">通知</RouterLink>
        <RouterLink to="/me">个人中心</RouterLink>
      </nav>
    </header>
    <div class="composition-layout">
      <aside class="composition-directory" aria-label="成员目录">
        <p>MEMBER WORKSPACE</p>
        <h2>成员工作台</h2>
        <p>{{ profile.roleLabel }}</p>
        <label v-if="profile.items.length >= 8"
          >搜索导航菜单<input v-model="query" type="search"
        /></label>
        <nav aria-label="桌面授权菜单">
          <details v-for="group in groups" :key="group.label" open>
            <summary>{{ group.label }}</summary>
            <RouterLink
              v-for="item in group.items"
              :key="item.path"
              :to="item.path"
              :aria-current="route.path === item.path ? 'page' : undefined"
              >{{ item.label }}</RouterLink
            >
          </details>
          <p v-if="!groups.length" role="status">没有匹配的菜单或分组。</p>
        </nav>
      </aside>
      <main class="composition-workspace">
        <section class="composition-context" aria-label="当前范围">
          <details>
            <summary><strong>未命名组织 · 默认工作区</strong><span>范围说明</span></summary>
            <p>仅当前组织与工作区；样本未提供名称，不拼接编号。此处不代表服务健康。</p>
          </details>
        </section>
        <KeepAlive><SelectionJourney v-if="inJourney" api-base-url="/api/v1" /></KeepAlive>
        <section v-if="!inJourney" class="composition-destination">
          <h1>目标页面未装配</h1>
          <p>{{ route.fullPath }}</p>
          <p>这里只核对成员导航与 P16 组合；不以占位内容冒充其他页面。</p>
          <RouterLink to="/opportunities/start">返回创建选品</RouterLink>
        </section>
      </main>
    </div>
    <nav
      class="composition-mobile"
      aria-label="移动快捷导航"
      :style="{
        gridTemplateColumns: `repeat(${Math.min(profile.items.length, 4) + 1}, minmax(0, 1fr))`,
      }"
    >
      <RouterLink
        v-for="item in profile.items.slice(0, 4)"
        :key="item.path"
        :to="item.path"
        :aria-current="route.path === item.path ? 'page' : undefined"
        >{{ item.label }}</RouterLink
      >
      <button
        aria-controls="composition-menu"
        :aria-expanded="menuOpen"
        :aria-current="
          !profile.items.slice(0, 4).some((item) => item.path === route.path) ? 'page' : undefined
        "
        @click="openMenu"
      >
        更多
      </button>
    </nav>
    <dialog
      ref="drawer"
      id="composition-menu"
      aria-labelledby="composition-menu-title"
      @keydown="trap"
      @close="closed"
    >
      <header>
        <h2 id="composition-menu-title">全部导航</h2>
        <button @click="closeMenu">关闭导航</button>
      </header>
      <label v-if="profile.items.length >= 8"
        >搜索导航菜单<input v-model="query" type="search"
      /></label>
      <nav aria-label="手机授权菜单">
        <details v-for="group in groups" :key="group.label" open>
          <summary>{{ group.label }}</summary>
          <RouterLink
            v-for="item in group.items"
            :key="item.path"
            :to="item.path"
            :aria-current="route.path === item.path ? 'page' : undefined"
            >{{ item.label }}</RouterLink
          >
        </details>
        <p v-if="!groups.length" role="status">没有匹配的菜单或分组。</p>
      </nav>
    </dialog>
    <p v-if="notice" class="composition-notice" role="status">{{ notice }}</p>
  </div>
</template>
