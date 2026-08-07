import { test, expect } from '@playwright/test';

const provider='00000000-0000-4000-8000-000000000b71';
const navigation={shell:'platform_admin',organization_id:null,workspace_id:null,roles:[],capabilities:[],platform_roles:['platform_operations_admin'],platform_capabilities:['platform:operate'],guard_reason:'navigation_platform_admin_allowed'};
const sources=[
  {code:'google_news_search',name:'Google News 关键词 RSS',access_mode:'public_rss',category:'trend',fields:['title','summary','published_at','source_url','publisher'],markets:['US'],languages:['en-US'],production_policy:'owner_review_required',policy_note:'端点可用不等于生产授权；所有者须复核 Google 当前条款、频率和保存字段后显式启用。',target_url:'https://news.google.com/rss/search?q={urlEncodedQuery}&hl=en-US&gl=US&ceid=US:en',provisioned:{id:provider,status:'enabled',version:2}},
  {code:'manual_product_supply_csv',name:'商品与供应链 CSV 导入',access_mode:'import',category:'product_supply',fields:['external_id','title','price','currency','supplier_name','moq','canonical_url','observed_at'],markets:['GLOBAL'],languages:['und'],production_policy:'ready_for_owner_enablement',policy_note:'仅处理显式上传的 CSV 内容；不连接外部商品平台，不包含客户凭证。',target_url:'inline://product-supply-csv-v1',provisioned:null},
];
async function nav(page:any){await page.route('**/api/v1/me/navigation?**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:navigation,request_id:'m03-07-nav',trace_id:'m03-07-nav'})}));}
async function catalog(page:any){await page.route('**/api/v1/platform/provider-sources',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:sources,request_id:'m03-07-list',trace_id:'m03-07-list'})}));}

test('M03-07.A07/A08/A15 source catalog and replay form are responsive and visual',async({page})=>{
  await nav(page);await catalog(page);await page.goto('/platform-admin/providers/sources');
  await expect(page.getByRole('heading',{name:'首批来源实现',level:2})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Google News 关键词 RSS'})).toBeVisible();
  await expect(page.getByText('端点可用不等于生产授权').first()).toBeVisible();
  await page.getByLabel('组织 ID').fill('00000000-0000-4000-8000-000000000b72');
  await page.getByLabel('工作区 ID').fill('00000000-0000-4000-8000-000000000b73');
  await page.getByRole('textbox',{name:'关键词',exact:true}).fill('foldable desk lamp');
  await expect(page).toHaveScreenshot('m03-07-provider-sources.png',{fullPage:true});
});

test('M03-07.A08/A09 provisioning is confirmed and never auto-enables',async({page})=>{
  await nav(page);await catalog(page);let provisioned=false;
  await page.route('**/api/v1/platform/provider-sources/manual_product_supply_csv/provision',async route=>{expect(route.request().headers()['idempotency-key']).toBeTruthy();provisioned=true;await route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({data:{id:'00000000-0000-4000-8000-000000000b74',code:'manual_product_supply_csv',status:'disabled',version:1,updated_at:'2026-08-07T12:00:00Z'},request_id:'m03-07-provision',trace_id:'m03-07-provision'})});});
  await page.goto('/platform-admin/providers/sources');await page.getByRole('button',{name:'登记为 disabled'}).click();
  await expect(page.getByText('登记不会启动采集')).toBeVisible();await page.getByPlaceholder('确认登记').fill('确认登记');await page.getByRole('button',{name:'登记来源'}).click();await expect.poll(()=>provisioned).toBe(true);
});

test('M03-07.A08/A16 forbidden and dependency states are truthful',async({page})=>{
  await nav(page);let status=403;await page.route('**/api/v1/platform/provider-sources',route=>route.fulfill({status,contentType:'application/json',body:JSON.stringify({error:{code:status===403?'authorization_denied':'dependency_unavailable',message:'请求失败',action_hint:'按状态恢复'},request_id:`m03-07-${status}`,trace_id:`m03-07-${status}`})}));
  await page.goto('/platform-admin/providers/sources');await expect(page.locator('[data-kind="forbidden"]')).toBeVisible();status=503;await page.reload();await expect(page.locator('[data-kind="blocked"]')).toBeVisible();
});
