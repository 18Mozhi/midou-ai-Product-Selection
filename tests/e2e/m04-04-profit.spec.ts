import { test, expect, type Page } from '@playwright/test';

const opportunityId='00000000-0000-4000-8000-000000000444';
const ruleId='00000000-0000-4000-8000-000000000445';
const envelope=(data:unknown)=>({data,request_id:'m04-04-e2e-request',trace_id:'m04-04-e2e-trace'});

async function navigation(page:Page){
  await page.route('**/api/v1/me/navigation?shell=member',route=>route.fulfill({json:envelope({shell:'member',organization_id:'00000000-0000-4000-8000-000000000441',workspace_id:'00000000-0000-4000-8000-000000000442',roles:['selection_manager','organization_admin'],capabilities:['task:read','opportunity:read','opportunity:approve','cost:confirm','sourcing:read'],platform_roles:[],platform_capabilities:[],guard_reason:'navigation_member_allowed'})}));
}

test('M04-04.A07/A08/A09/A15 cost rule console exposes explicit fees and dual approval',async({page})=>{
  await navigation(page);
  let status='draft',revision=1;
  const rule=()=>({id:ruleId,market:'US',platform:'amazon',version_code:'US-AMZ-2026-01',name:'美国站标准费用',status,fee_lines:[{type:'platform_fee',mode:'percentage_of_sale',value:10,currency:null},{type:'payment_fee',mode:'percentage_of_sale',value:3,currency:null},{type:'tax',mode:'percentage_of_sale',value:5,currency:null},{type:'fulfillment',mode:'fixed_amount',value:2,currency:'USD'}],effective_from:'2026-08-08',revision,approvals:[],published_at:null,updated_at:'2026-08-08T10:00:00.000Z'});
  await page.route('**/api/v1/cost-rules',route=>route.fulfill({json:envelope([rule()])}));
  await page.route(`**/api/v1/cost-rules/${ruleId}/actions`,route=>{status='pending_approval';revision=2;return route.fulfill({json:envelope(rule())});});
  await page.goto('/sourcing/cost-rules');
  await expect(page.getByRole('heading',{name:'费用与利润规则',level:2})).toBeVisible();
  await expect(page.getByRole('heading',{name:'美国站标准费用',level:3})).toBeVisible();
  await expect(page.getByText('platform_fee')).toBeVisible();
  await page.getByRole('button',{name:'提交审批'}).click();
  await expect(page.getByText('规则已执行 submit；历史版本未改写。')).toBeVisible();
  await expect(page).toHaveScreenshot('m04-04-cost-rules.png',{fullPage:true});
});

test('M04-04.A07/A08/A15 profit detail shows formula components provenance and historical quote',async({page})=>{
  await navigation(page);
  const detail={id:opportunityId,name:'户外净水杯利润机会',market:'US',category:'outdoor',source_type:'manual',source_ref_id:null,owner_id:null,lifecycle_status:'ready',recommendation_status:'observe',overall_score:72,trend_score:80,competition_score:65,profit_status:'calculated',risk_level:'unknown',confidence:{status:'measured',score:80},evidence_count:3,source_count:2,coverage_status:'partial',decision_status:'pending',version:8,updated_at:'2026-08-08T12:00:00.000Z',score_rule_version:'v1',scored_at:'2026-08-08T11:00:00.000Z',latest_score_run:null,score_components:[],evidence:[],decisions:[],section_status:{market:'covered',competition:'covered',profit:'calculated',risk:'insufficient_data',execution:'not_available'}};
  const components=[['sale_price',100,'USD',100,null],['purchase_price',40,'CNY',5.6,'00000000-0000-4000-8000-000000000446'],['logistics',5,'USD',5,null],['platform_fee',10,'PCT',10,null],['payment_fee',3,'PCT',3,null],['tax',5,'PCT',5,null],['fulfillment',2,'USD',2,null]].map(([component_type,source_amount,source_currency,converted_amount,exchange_quote_id])=>({component_type,source_amount,source_currency,converted_amount,target_currency:'USD',source_ref_id:String(component_type).includes('fee')||component_type==='tax'||component_type==='fulfillment'?'cost_rule:US-AMZ-2026-01':`verified:${component_type}`,evidence_id:String(component_type).includes('price')||component_type==='logistics'?'00000000-0000-4000-8000-000000000447':null,exchange_quote_id,missing_reason:null}));
  await page.route(`**/api/v1/opportunities/${opportunityId}`,route=>route.fulfill({json:envelope(detail)}));
  await page.route(`**/api/v1/opportunities/${opportunityId}/profit-analysis`,route=>route.fulfill({json:envelope({latest_run:{id:ruleId,status:'calculated',rule_version_code:'US-AMZ-2026-01',platform:'amazon',market:'US',currency:'USD',sale_price:100,total_cost:30.6,net_profit:69.4,net_margin_percent:69.4,missing_fields:[],calculated_at:'2026-08-08T12:00:00.000Z',components},current_inputs:[]})}));
  await page.goto(`/opportunities/${opportunityId}`);
  await page.getByRole('button',{name:'利润与成本'}).click();
  await page.getByLabel('观测时间').fill('2026-08-08T12:00');
  await expect(page.getByText('69.4 USD',{exact:false}).first()).toBeVisible();
  await expect(page.getByText('汇率快照 00000000-0000-4000-8000-000000000446')).toBeVisible();
  await expect(page.getByText('净利润 = 含税售价')).toBeVisible();
  await expect(page).toHaveScreenshot('m04-04-profit-detail.png',{fullPage:true});
});
