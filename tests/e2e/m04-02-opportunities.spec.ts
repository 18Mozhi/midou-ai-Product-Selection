import { test, expect, type Page } from '@playwright/test';

const opportunityId='00000000-0000-4000-8000-000000000424',topicId='00000000-0000-4000-8000-000000000425';
const base={id:opportunityId,name:'AI 驱动的个性化护肤机会',market:'US',category:'beauty',source_type:'trend_topic',source_ref_id:topicId,owner_id:'00000000-0000-4000-8000-000000000423',lifecycle_status:'ready',recommendation_status:'insufficient_data',overall_score:null,trend_score:null,competition_score:null,profit_status:'insufficient_data',risk_level:'unknown',confidence:{status:'insufficient_data',score:null},evidence_count:2,source_count:2,coverage_status:'partial',decision_status:'pending',version:1,updated_at:'2026-08-08T00:00:00.000Z'};
const evidence=[
  {id:'00000000-0000-4000-8000-000000000426',title:'AI Skin Care Demand Rises',publisher:'Example News',canonical_url:'https://example.test/ai-skincare',provider_id:'00000000-0000-4000-8000-000000000427',raw_evidence_id:'00000000-0000-4000-8000-000000000428',observed_at:'2026-08-07T14:05:00.000Z'},
  {id:'00000000-0000-4000-8000-000000000429',title:'Personalized beauty products gain attention',publisher:'Retail Example',canonical_url:'https://example.test/personalized',provider_id:'00000000-0000-4000-8000-000000000430',raw_evidence_id:'00000000-0000-4000-8000-000000000431',observed_at:'2026-08-07T13:05:00.000Z'},
];
const envelope=(data:unknown,meta?:unknown)=>({data,...(meta?{meta}:{}),request_id:'m04-02-e2e-request',trace_id:'m04-02-e2e-trace'});

async function ready(page:Page){
  let decided=false;
  await page.route('**/api/v1/me/navigation?shell=member',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope({shell:'member',organization_id:'00000000-0000-4000-8000-000000000421',workspace_id:'00000000-0000-4000-8000-000000000422',roles:['member'],capabilities:['task:read','trend:read','trend:manage','opportunity:read','opportunity:decide'],platform_roles:[],platform_capabilities:[],guard_reason:'navigation_member_allowed'}))}));
  await page.route(`**/api/v1/opportunities/${opportunityId}/decisions`,route=>{decided=true;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope({opportunity_id:opportunityId,decision_status:'observing',version:2,decision_id:topicId}))});});
  await page.route(`**/api/v1/opportunities/${opportunityId}`,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope({...base,decision_status:decided?'observing':'pending',lifecycle_status:decided?'observing':'ready',version:decided?2:1,score_rule_version:null,scored_at:null,latest_score_run:null,score_components:[],evidence,decisions:decided?[{id:topicId,action:'observe',reason:'补齐成本与竞品后再判断',actor_id:base.owner_id,created_at:'2026-08-08T00:05:00.000Z',opportunity_version:2}]:[],section_status:{market:'covered',competition:'insufficient_data',profit:'insufficient_data',risk:'insufficient_data',execution:'not_available'}}))}));
  await page.route('**/api/v1/opportunities?*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope([base],{page:1,page_size:20,total:1}))}));
  await page.route('**/api/v1/opportunities',route=>route.fulfill({status:201,contentType:'application/json',body:JSON.stringify(envelope(base))}));
}

test('M04-02.A07/A08/A15 opportunity list and creation are responsive and truthful',async({page})=>{
  await ready(page);await page.goto('/opportunities');
  await expect(page.getByRole('heading',{name:'选品机会',level:2})).toBeVisible();
  await expect(page.getByText('数据不足',{exact:true}).first()).toBeVisible();
  await expect(page.getByText('insufficient_data',{exact:true}).first()).toBeVisible();
  await expect(page).toHaveScreenshot('m04-02-opportunity-list.png',{fullPage:true});
  await page.getByRole('button',{name:'＋ 创建机会'}).click();
  const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
  await dialog.getByLabel('机会名称').fill('手工验证机会');
  await dialog.getByRole('button',{name:'创建机会',exact:true}).click();
  await expect(page.getByRole('heading',{name:'机会详情',level:2})).toBeVisible();
});

test('M04-02.A07/A08/A15 opportunity detail tabs and reason-required decision preserve missing states',async({page})=>{
  await ready(page);await page.goto(`/opportunities/${opportunityId}`);
  await expect(page.getByRole('heading',{name:'AI 驱动的个性化护肤机会'})).toBeVisible();
  await expect(page.getByText('尚无评分运行；缺失输入不会用默认值补齐。')).toBeVisible();
  await page.getByRole('button',{name:'利润与成本'}).click();await expect(page.getByText('数据不足，不能生成可靠 ROI')).toBeVisible();
  await page.getByRole('button',{name:'证据管理'}).click();await expect(page.getByText('Example News')).toBeVisible();
  await page.getByRole('button',{name:'◉ 继续观察'}).click();const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
  await dialog.getByLabel('原因（必填）').fill('补齐成本与竞品后再判断');await dialog.getByRole('button',{name:'确认记录'}).click();
  await expect(page.getByText('决策已记录；原始评分与证据未被改写。')).toBeVisible();
  await page.getByRole('button',{name:'决策历史'}).click();await expect(page.getByText('补齐成本与竞品后再判断')).toBeVisible();
  await page.evaluate(()=>window.scrollTo(0,0));
  await expect(page).toHaveScreenshot('m04-02-opportunity-detail.png',{fullPage:true});
});
