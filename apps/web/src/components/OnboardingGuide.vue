<script setup lang="ts">
import{computed,ref}from'vue';
const params=new URLSearchParams(window.location.search),initial=Math.min(3,Math.max(1,Number(params.get('step'))||1)),step=ref(initial);
const pages=[
 {eyebrow:'FROM SIGNAL TO ACTION',title:'把市场变化，变成今天的行动',copy:'ScoutOps 将来源证据、机会判断与团队任务串在同一个工作范围里。',mark:'↗',points:['变化附带来源与新鲜度','机会保留评分依据','行动进入可追踪任务']},
 {eyebrow:'ONE SHARED CONTEXT',title:'让协作围绕同一份证据展开',copy:'组织、工作区与角色决定可见范围。评论、审批和结论不会脱离原始上下文。',mark:'◎',points:['组织与工作区隔离','角色决定最小权限','审批保留版本与审计']},
 {eyebrow:'EVIDENCE BEFORE ANSWER',title:'先看事实，再做可解释的决定',copy:'AI 只负责摘要、解释和缺失提示；价格、利润、资质与最终决策始终由事实和人员负责。',mark:'◇',points:['缺失证据明确受阻','风险不用颜色代替文字','所有结论可以回到来源']}
];
const page=computed(()=>pages[step.value-1]!);function next(){if(step.value<3)step.value+=1;}function previous(){if(step.value>1)step.value-=1;}
</script>
<template><main class="onboarding-page" data-testid="onboarding"><header><a href="/" class="identity-brand"><span>S</span>ScoutOps</a><a href="/">跳过引导</a></header><section class="onboarding-shell"><div class="onboarding-copy"><p>{{page.eyebrow}}</p><h1>{{page.title}}</h1><span>{{page.copy}}</span><ul><li v-for="point in page.points" :key="point"><b>✓</b>{{point}}</li></ul></div><div class="onboarding-visual" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><strong>{{page.mark}}</strong><i></i><i></i><i></i></div></section><footer><div class="onboarding-progress"><button v-for="index in 3" :key="index" :aria-label="`前往第 ${index} 步`" :aria-current="step===index?'step':undefined" @click="step=index"><span>{{index}}</span></button></div><div><button v-if="step>1" class="onboarding-back" @click="previous">上一步</button><button v-if="step<3" class="onboarding-next" @click="next">下一步</button><a v-else class="onboarding-next" href="/">进入 ScoutOps</a></div></footer><small>第 {{step}} / 3 步 · 可使用键盘完成</small></main></template>
