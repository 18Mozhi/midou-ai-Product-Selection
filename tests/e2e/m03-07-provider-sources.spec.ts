import { test, expect } from '@playwright/test';

const org='00000000-0000-4000-8000-000000000b72',ws='00000000-0000-4000-8000-000000000b73';
const navigation=(shell:'platform_admin'|'member')=>({shell,organization_id:shell==='member'?org:null,workspace_id:shell==='member'?ws:null,roles:shell==='member'?['member']:[],capabilities:shell==='member'?['trend:read']:[],platform_roles:shell==='platform_admin'?['platform_super_admin']:[],platform_capabilities:shell==='platform_admin'?['platform:operate','platform:superadmin','provider:configure']:[],guard_reason:`navigation_${shell}_allowed`});
const automatic=Array.from({length:96},(_,index)=>({code:`gnews_${String(index+1).padStart(3,'0')}`,name:`全球热点频道 ${index+1}`,access_mode:'public_rss',category:['news','ecommerce','data','community'][index%4],availability:'automatic',policy_note:'公开 RSS 热点频道，系统会自动采集并保留原文证据。',markets:['GLOBAL'],schedule_minutes:15,provisioned:{id:`00000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`,status:'enabled',version:1}}));
const setup=['Amazon 商品数据','Keepa 价格历史','1688 搜索','TikTok Shop','Reddit Search API','Similarweb'].map((name,index)=>({code:`setup_${index}`,name,access_mode:'official_api',category:index<4?'ecommerce':index===4?'community':'data',availability:'setup_required',policy_note:'来源已登记；配置官方凭证或完成合规接入后才会运行，不会伪造实时数据。',markets:['GLOBAL'],schedule_minutes:30,provisioned:{id:`10000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`,status:'disabled',version:1}}));
const manual=[{code:'google_news_search',name:'Google News 手动关键词',access_mode:'public_rss',category:'news',availability:'manual',policy_note:'由用户输入关键词后立即采集。',markets:['GLOBAL'],schedule_minutes:15,provisioned:{id:'20000000-0000-4000-8000-000000000001',status:'enabled',version:1}},{code:'manual_product_supply_csv',name:'商品与供应链 CSV 导入',access_mode:'import',category:'product_supply',availability:'manual',policy_note:'只处理用户明确上传的文件。',markets:['GLOBAL'],schedule_minutes:10080,provisioned:{id:'20000000-0000-4000-8000-000000000002',status:'disabled',version:1}}];
const sources=[...automatic,...setup,...manual];
const envelope=(data:unknown)=>({data,request_id:'m03-07-e2e',trace_id:'m03-07-e2e'});
async function nav(page:any,shell:'platform_admin'|'member'){await page.route('**/api/v1/me/navigation?**',route=>route.fulfill({json:envelope(navigation(shell))}));}
async function catalog(page:any){await page.route('**/api/v1/platform/provider-sources',route=>route.fulfill({json:envelope(sources)}));}

test('M03-07.A07/A08/A15 novice catalog shows 100+ automatic setup and manual channels',async({page})=>{
  await nav(page,'platform_admin');await catalog(page);await page.goto('/platform-admin/providers/sources');
  await expect(page.getByRole('heading',{name:'104 个来源频道已经自动登记'})).toBeVisible();
  await expect(page.getByText('96',{exact:true}).first()).toBeVisible();
  await expect(page.getByText('小白怎么用？')).toBeVisible();
  await page.getByPlaceholder('搜索来源，例如 Amazon、Reddit').fill('Amazon');
  await expect(page.getByRole('heading',{name:'Amazon 商品数据'})).toBeVisible();
  await expect(page.getByText('等待配置',{exact:true}).last()).toBeVisible();
  await expect(page).toHaveScreenshot('m03-07-provider-sources.png',{fullPage:true});
});

test('M03-07.A08/A09 member can manually schedule immediate hotspot refresh',async({page})=>{
  await nav(page,'member');
  await page.route('**/api/v1/trends?**',route=>route.fulfill({json:{...envelope([]),meta:{page:1,page_size:20,total:0}}}));
  await page.route('**/api/v1/trends/monitoring-rules',route=>route.fulfill({json:envelope([])}));
  let body:any=null;
  await page.route('**/api/v1/provider-sources/refresh',async route=>{body=route.request().postDataJSON();expect(route.request().headers()['idempotency-key']).toBeTruthy();await route.fulfill({status:202,json:envelope({task_id:'00000000-0000-4000-8000-000000000b75',source_count:96,status:'scheduled'})});});
  await page.goto('/trends');await page.getByRole('button',{name:/立即获取热点/}).click();
  await expect.poll(()=>body).toEqual({organization_id:org,workspace_id:ws});
  await expect(page.getByText(/已开始从 96 个实时频道获取热点/)).toBeVisible();
});

test('M03-07.A08/A16 forbidden and dependency states are truthful',async({page})=>{
  await nav(page,'platform_admin');let status=403;await page.route('**/api/v1/platform/provider-sources',route=>route.fulfill({status,contentType:'application/json',body:JSON.stringify({error:{code:status===403?'authorization_denied':'dependency_unavailable',message:'请求失败',action_hint:'按状态恢复'},request_id:`m03-07-${status}`,trace_id:`m03-07-${status}`})}));
  await page.goto('/platform-admin/providers/sources');await expect(page.locator('[data-kind="forbidden"]')).toBeVisible();status=503;await page.reload();await expect(page.locator('[data-kind="blocked"]')).toBeVisible();
});
