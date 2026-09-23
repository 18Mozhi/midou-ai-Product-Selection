<script setup lang="ts">
import type { FileResilienceDto } from "@scoutops/contracts";

defineProps<{
  integrity: FileResilienceDto["integrity"];
  recovery: FileResilienceDto["recovery"];
}>();
</script>

<template>
  <div class="p69-evidence">
    <section class="p69-integrity">
      <header>
        <div>
          <h2>抽样完整性</h2>
          <p>证据优先、剩余名额再取有效导出；不是随机全覆盖。</p>
        </div>
      </header>
      <div class="p69-sample-total">
        <b>{{ integrity.verified_files }} / {{ integrity.sampled_files }}</b>
        <span>{{ integrity.sampled_files ? "已核验样本" : "尚无样本" }}</span>
      </div>
      <dl>
        <div>
          <dt>不一致</dt>
          <dd>{{ integrity.mismatch_files }}</dd>
        </div>
        <div>
          <dt>缺失</dt>
          <dd>{{ integrity.missing_files }}</dd>
        </div>
      </dl>
      <p class="p69-note">
        {{
          integrity.sampled_files
            ? "已核验样本不能外推为全部活动文件。"
            : "零样本可以是 ready；不能显示100%通过。"
        }}
      </p>
    </section>
    <aside class="p69-recovery">
      <header>
        <div>
          <h2>同机恢复证据</h2>
          <p>与目录读数独立核对，不是高可用或异地容灾。</p>
        </div>
      </header>
      <b class="p69-recovery-state">{{ recovery.status }}</b>
      <dl>
        <div>
          <dt>加密恢复副本</dt>
          <dd>{{ recovery.encrypted_same_host_copy ? "已核验" : "未核验" }}</dd>
        </div>
        <div>
          <dt>隔离恢复</dt>
          <dd>{{ recovery.isolated_restore_verified ? "已核验" : "未核验" }}</dd>
        </div>
        <div>
          <dt>演练距今</dt>
          <dd>
            {{ recovery.drill_age_days ?? "未记录" }}
            <small>{{ recovery.drill_age_days == null ? "未知不填0" : "天" }}</small>
          </dd>
        </div>
      </dl>
      <p class="p69-note">恢复证据不足可阻断，过期演练在文件模块为预警；页面不发起恢复。</p>
    </aside>
  </div>
</template>
