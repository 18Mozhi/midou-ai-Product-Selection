<script setup lang="ts">
import type { FileResilienceDto } from "@scoutops/contracts";
import { formatFileBytes, formatFilePercent, rootLabel, rootPurpose } from "./formatters";

defineProps<{
  directories: FileResilienceDto["directories"];
}>();

const hasMeasuredUsage = (root: FileResilienceDto["directories"][number]) =>
  root.available &&
  root.total_bytes > 0 &&
  root.usage_basis_points >= 0 &&
  root.usage_basis_points <= 10000;
</script>

<template>
  <section class="p69-directories">
    <header>
      <div>
        <h2>目录水位与活动索引</h2>
        <p>文件系统水位与活动资产索引分开；同盘读数不能相加。</p>
      </div>
    </header>
    <article
      v-for="root in directories"
      :key="root.kind"
      class="p69-directory"
      :data-root="root.kind"
    >
      <header>
        <div>
          <h3>{{ rootLabel(root.kind) }}</h3>
          <p>{{ rootPurpose(root.kind) }} · {{ root.available && root.writable ? "可读写" : "不可用或不可写" }}</p>
        </div>
        <b>{{ root.kind === "temp" ? "不建立持久索引" : `${root.active_files} 个活动文件` }}</b>
      </header>
      <div class="p69-root-evidence">
        <section>
          <small>目录所在文件系统水位</small>
          <strong>
            {{ !root.available ? "未取得观测" : hasMeasuredUsage(root) ? formatFilePercent(root.usage_basis_points) : "上限 / 容量未知" }}
          </strong>
          <p>{{ formatFileBytes(root.used_bytes) }} / {{ formatFileBytes(root.total_bytes) }}</p>
          <progress
            v-if="hasMeasuredUsage(root)"
            :aria-label="`${rootLabel(root.kind)}所在文件系统已用比例`"
            :aria-valuetext="formatFilePercent(root.usage_basis_points)"
            :value="root.usage_basis_points"
            max="10000"
          ></progress>
          <small v-else>接口比例为失败或未知约定，不是实测满额；不会绘制有效水位条。</small>
        </section>
        <section class="p69-index">
          <small>活动索引证据</small>
          <b>{{ root.kind === "temp" ? "不适用" : formatFileBytes(root.indexed_bytes) }}</b>
          <p>
            {{
              root.kind === "temp"
                ? "临时目录不建立持久索引；0不表示目录为空。"
                : "索引体积来自活动证据与未过期导出，不是目录递归体积。"
            }}
          </p>
        </section>
      </div>
    </article>
    <p class="p69-note">同一文件系统的三个读数可能相同；不能相加当成总磁盘用量。</p>
  </section>
</template>
