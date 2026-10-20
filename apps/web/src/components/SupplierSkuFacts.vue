<script setup lang="ts">
import type { SourcingCandidate } from "./sourcing-workspace-types";
defineProps<{ sku: NonNullable<SourcingCandidate["source_sku"]> }>();
const labels: Record<string, string> = {
  length: "长",
  width: "宽",
  height: "高",
  volume: "体积",
  weight: "重量",
};
</script>

<template>
  <div class="supplier-sku-facts">
    <small>SKU {{ sku.sku_id }}</small>
    <small>{{
      sku.price_source === "discountPrice"
        ? "SKU 当前折扣报价"
        : sku.price_source === "original.price"
          ? "SKU 原报价"
          : "报价来源未提供"
    }}</small>
    <small v-if="sku.price_amount != null"
      >原报价数量 {{ sku.price_amount }} {{ sku.price_unit || "（单位未提供）" }}</small
    >
    <details>
      <summary>查看 SKU 属性与包装</summary>
      <dl>
        <template v-for="(item, index) in sku.properties" :key="`sku-${index}`">
          <dt>{{ item.name }}</dt>
          <dd>{{ item.value }}</dd>
        </template>
        <template v-for="(item, index) in sku.attributes" :key="`attribute-${index}`">
          <dt>{{ item.name }}</dt>
          <dd>{{ item.value }}</dd>
        </template>
      </dl>
      <p v-if="!sku.packages.length">包装尺寸、重量未提供</p>
      <section v-for="(pack, index) in sku.packages" :key="index" aria-label="包装数据">
        <strong>包装 {{ index + 1 }}</strong>
        <dl>
          <template v-for="(value, key) in pack" :key="key">
            <dt>{{ labels[key] || key }}</dt>
            <dd>{{ value }} {{ sku.package_units[key] || "（单位未提供）" }}</dd>
          </template>
        </dl>
      </section>
      <small>包装数据不等同于商品本体尺寸。</small>
    </details>
  </div>
</template>

<style scoped>
.supplier-sku-facts {
  display: grid;
  gap: 4px;
  overflow-wrap: anywhere;
}
.supplier-sku-facts summary {
  min-height: 44px;
  cursor: pointer;
  padding: 10px 0;
}
.supplier-sku-facts dl {
  display: grid;
  grid-template-columns: minmax(65px, auto) minmax(0, 1fr);
  gap: 6px 12px;
  margin: 8px 0;
}
.supplier-sku-facts dt {
  color: var(--so-text-muted);
}
.supplier-sku-facts dd {
  margin: 0;
}
.supplier-sku-facts section {
  padding-top: 8px;
  border-top: 1px solid var(--so-border);
}
</style>
