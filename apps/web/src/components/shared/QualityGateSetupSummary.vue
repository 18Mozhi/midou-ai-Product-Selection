<script setup lang="ts">
defineProps<{
  title: string;
  description: string;
  status: string;
  ready: boolean;
  items: Array<{ label: string; detail: string; ready: boolean }>;
}>();
</script>

<template>
  <section class="quality-gate-setup" :data-ready="ready" :aria-label="title">
    <header>
      <div>
        <p>自动推荐配置</p>
        <h3>{{ title }}</h3>
        <span>{{ description }}</span>
      </div>
      <strong :data-ready="ready">{{ status }}</strong>
    </header>
    <ul>
      <li v-for="item in items" :key="item.label" :data-ready="item.ready">
        <i aria-hidden="true">{{ item.ready ? "✓" : "·" }}</i>
        <span
          ><b>{{ item.label }}</b
          ><small>{{ item.detail }}</small></span
        >
        <em>{{ item.ready ? "已满足" : "待完成" }}</em>
      </li>
    </ul>
    <footer v-if="$slots.default"><slot /></footer>
  </section>
</template>

<style scoped>
.quality-gate-setup {
  display: grid;
  gap: 14px;
  padding: 18px;
  border: 1px solid var(--so-border);
  border-radius: 14px;
  background: var(--so-panel);
}
.quality-gate-setup > header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}
.quality-gate-setup p,
.quality-gate-setup h3,
.quality-gate-setup span,
.quality-gate-setup ul {
  margin: 0;
}
.quality-gate-setup p {
  color: var(--so-primary);
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.08em;
}
.quality-gate-setup h3 {
  margin-top: 4px;
  font-size: 20px;
}
.quality-gate-setup header span,
.quality-gate-setup small {
  color: var(--so-text-muted);
}
.quality-gate-setup header span {
  display: block;
  margin-top: 5px;
}
.quality-gate-setup header > strong {
  flex: 0 0 auto;
  padding: 6px 9px;
  border-radius: 999px;
  color: var(--so-warning);
  background: color-mix(in srgb, var(--so-warning) 12%, var(--so-panel-soft));
}
.quality-gate-setup header > strong[data-ready="true"] {
  color: var(--so-success);
  background: color-mix(in srgb, var(--so-success) 12%, var(--so-panel-soft));
}
.quality-gate-setup ul {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 8px;
  padding: 0;
  list-style: none;
}
.quality-gate-setup li {
  min-width: 0;
  padding: 10px;
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  gap: 8px;
  border: 1px solid var(--so-border);
  border-radius: 10px;
  background: var(--so-panel-soft);
}
.quality-gate-setup li i {
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: var(--so-warning);
  background: color-mix(in srgb, var(--so-warning) 12%, transparent);
  font-style: normal;
}
.quality-gate-setup li[data-ready="true"] i {
  color: var(--so-success);
  background: color-mix(in srgb, var(--so-success) 12%, transparent);
}
.quality-gate-setup li span,
.quality-gate-setup li b,
.quality-gate-setup li small {
  display: block;
  min-width: 0;
}
.quality-gate-setup li small {
  margin-top: 3px;
  overflow-wrap: anywhere;
  font-size: 13px;
}
.quality-gate-setup li em {
  grid-column: 2;
  color: var(--so-warning);
  font-size: 13px;
  font-style: normal;
}
.quality-gate-setup li[data-ready="true"] em {
  color: var(--so-success);
}
.quality-gate-setup footer {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.quality-gate-setup footer :deep(a),
.quality-gate-setup footer :deep(button) {
  min-height: 44px;
  padding: 9px 13px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--so-border);
  border-radius: var(--so-control-radius);
  color: var(--so-text);
  background: var(--so-panel-soft);
  font: inherit;
  text-decoration: none;
}
.quality-gate-setup footer :deep(.quality-gate-next) {
  border-color: var(--so-primary);
  color: var(--so-on-primary);
  background: var(--so-primary);
}
@media (max-width: 640px) {
  .quality-gate-setup > header {
    display: grid;
  }
  .quality-gate-setup header > strong {
    justify-self: start;
  }
  .quality-gate-setup ul {
    grid-template-columns: 1fr;
  }
  .quality-gate-setup footer :deep(a),
  .quality-gate-setup footer :deep(button) {
    flex: 1 1 100%;
  }
}
</style>
