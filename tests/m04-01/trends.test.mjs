import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeTrendTitle, TrendService, TrendServiceError, validateMonitoringRuleInput } from '../../apps/api/dist/trend-service.js';
import { isAutomaticProductDiscoveryProvider, normalizeProjectedTrendTitle, projectedTrendProviderContext, TrendProjectionError } from '../../apps/worker/dist/trend-projection-worker.js';
import { buildApp } from '../../apps/api/dist/app.js';

const ids={org:'00000000-0000-4000-8000-000000000401',ws:'00000000-0000-4000-8000-000000000402',actor:'00000000-0000-4000-8000-000000000403',topic:'00000000-0000-4000-8000-000000000404',rule:'00000000-0000-4000-8000-000000000405'};
const ruleInput={name:'AI 护肤观察',include_keywords:['AI skincare'],negative_keywords:[],market:'US',language:'en-US',category:'beauty',notification_channel:'in_app'};

test('M04-01.A02/A12 title and monitoring contracts normalize without inventing metrics',()=>{
  assert.equal(normalizeTrendTitle('  AI  Skin Care  '),'ai skin care');
  assert.equal(normalizeProjectedTrendTitle('  AI  Skin Care  '),'ai skin care');
  assert.deepEqual(validateMonitoringRuleInput(ruleInput).include_keywords,['ai skincare']);
  assert.throws(()=>validateMonitoringRuleInput({...ruleInput,include_keywords:[]}),error=>error instanceof TrendServiceError&&error.code==='trend_rule_keywords_invalid');
  assert.throws(()=>validateMonitoringRuleInput({...ruleInput,notification_channel:'email'}),error=>error instanceof TrendServiceError&&error.code==='trend_rule_channel_unavailable');
  assert.throws(()=>normalizeProjectedTrendTitle(''),error=>error instanceof TrendProjectionError&&error.code==='trend_title_invalid'&&!error.retryable);
});

test('M04-01 automatic hotspot channels project real markets and only product channels discover candidates',()=>{
  assert.deepEqual(projectedTrendProviderContext('gnews_jp_amazon'),{accepted:true,automatic:true,market:'JP',language:'ja-JP'});
  assert.deepEqual(projectedTrendProviderContext('gnews_gb_consumer_trends'),{accepted:true,automatic:true,market:'GB',language:'en-GB'});
  assert.deepEqual(projectedTrendProviderContext('google_news_search'),{accepted:true,automatic:false,market:'US',language:'en-US'});
  assert.equal(projectedTrendProviderContext('amazon_product').accepted,false);
  assert.equal(isAutomaticProductDiscoveryProvider('gnews_us_viral_products'),true);
  assert.equal(isAutomaticProductDiscoveryProvider('gnews_jp_amazon'),true);
  assert.equal(isAutomaticProductDiscoveryProvider('gnews_gb_new_products'),true);
  assert.equal(isAutomaticProductDiscoveryProvider('gnews_us_consumer_trends'),false);
  assert.equal(isAutomaticProductDiscoveryProvider('gnews_us_retail_data'),false);
  assert.equal(isAutomaticProductDiscoveryProvider('google_news_search'),false);
});

test('M04-01.A04/A06/A09 service validates pagination versions and scoped writes',async()=>{
  const calls=[];const repository={
    async list(input){calls.push(['list',input]);return{items:[],total:0};},async get(){return null;},async listRules(){return[];},
    async setFollow(input){calls.push(['follow',input]);return{topic_id:input.topicId,followed:input.followed};},
    async setRelevance(input){calls.push(['relevance',input]);return{topic_id:input.topicId,status:input.status,version:input.expectedVersion+1};},
    async createRule(input){calls.push(['createRule',input]);return{id:input.ruleId,...input.rule,status:'enabled',last_evaluated_at:null,version:1,created_at:new Date(0).toISOString(),updated_at:new Date(0).toISOString()};},
    async updateRule(input){calls.push(['updateRule',input]);return{id:input.ruleId,...ruleInput,include_keywords:['ai skincare'],status:input.status,last_evaluated_at:null,version:input.expectedVersion+1,created_at:new Date(0).toISOString(),updated_at:new Date(0).toISOString()};}
  };
  const service=new TrendService(repository),scope={organizationId:ids.org,workspaceId:ids.ws,actorId:ids.actor},write={...scope,requestId:'request-m04',traceId:'trace-m04',idempotencyKey:'idem-m04'};
  await service.list({...scope,page:1,pageSize:20,query:' AI '});
  assert.equal(calls[0][1].query,'AI');
  await service.follow({...write,topicId:ids.topic,followed:true});
  assert.match(calls[1][1].route,/PUT:.*follow/);
  await service.relevance({...write,topicId:ids.topic,status:'irrelevant',reason:'not relevant',expectedVersion:2});
  assert.equal(calls[2][1].expectedVersion,2);
  const created=await service.createRule({...write,rule:ruleInput});assert.equal(created.status,'enabled');
  await service.updateRule({...write,ruleId:ids.rule,status:'paused',expectedVersion:1});
  assert.throws(()=>service.list({...scope,page:0,pageSize:20}),/trend_pagination_invalid/);
  await assert.rejects(()=>service.get({...scope,topicId:ids.topic}),error=>error instanceof TrendServiceError&&error.code==='trend_topic_not_found');
});

test('M04-01.A06/A09/A13 API derives tenant scope and enforces origin plus idempotency',async()=>{
  const calls=[],service={list:async input=>(calls.push(['list',input]),{items:[],total:0}),listRules:async input=>(calls.push(['rules',input]),[]),get:async()=>({}),follow:async input=>(calls.push(['follow',input]),{topic_id:input.topicId,followed:true}),relevance:async()=>({}),createRule:async()=>({}),updateRule:async()=>({})},authorization={resolveSession:async()=>({context:{organization_id:ids.org,workspace_id:ids.ws}}),authorize:async input=>calls.push(['authorize',input])},auth={authenticate:async()=>({user:{id:ids.actor},session:{id:'session'}})},app=buildApp({trends:{service,authorization,auth,secureCookie:false,webOrigin:'http://127.0.0.1:5173'}});
  let response=await app.inject({method:'GET',url:'/api/v1/trends?page=1&page_size=20',headers:{cookie:'scoutops_session=test','x-request-id':'trend-read','x-trace-id':'trend-trace'}});assert.equal(response.statusCode,200);assert.equal(response.json().request_id,'trend-read');assert.equal(calls[0][1].capability,'trend:read');assert.equal(calls[1][1].organizationId,ids.org);assert.equal(calls[1][1].workspaceId,ids.ws);
  response=await app.inject({method:'PUT',url:`/api/v1/trends/${ids.topic}/follow`,headers:{cookie:'scoutops_session=test',origin:'http://127.0.0.1:5173','idempotency-key':'follow-api'}});assert.equal(response.statusCode,200);assert.equal(calls.at(-1)[1].idempotencyKey,'follow-api');
  const forbidden=await app.inject({method:'PUT',url:`/api/v1/trends/${ids.topic}/follow`,headers:{cookie:'scoutops_session=test',origin:'https://evil.test','idempotency-key':'blocked'}});assert.equal(forbidden.statusCode,403);assert.equal(forbidden.json().error.code,'origin_forbidden');
  const missing=await app.inject({method:'PUT',url:`/api/v1/trends/${ids.topic}/follow`,headers:{cookie:'scoutops_session=test',origin:'http://127.0.0.1:5173'}});assert.equal(missing.statusCode,400);await app.close();
});

test('M04-01.A03/A05-A11/A13-A17 delivery evidence covers the complete module',async()=>{
  const paths=['database/migrations/0017a_trends_m04_01.up.sql','database/migrations/0017a_trends_m04_01.down.sql','apps/worker/src/trend-projection-worker.ts','apps/api/src/trend-service.ts','apps/api/src/mysql-trend-repository.ts','apps/api/src/trend-routes.ts','apps/web/src/components/TrendDashboard.vue','config/schema.json','config/env.example','docs/openapi.yaml','docs/feature-map.json','docs/architecture/m04-01-trends-monitoring.md','docs/runbooks/m04-01-trends-monitoring.md','tests/e2e/m04-01-trends.spec.ts','scripts/verify-trends-live.mjs','new-product-enterprise-blueprint.md'];
  const values=await Promise.all(paths.map(path=>readFile(path,'utf8'))),[up,down,worker,service,repository,routes,web,schema,env,openapi,feature,architecture,runbook,e2e,live,blueprint]=values;
  assert.match(up,/trend_topics[\s\S]*trend_projection_jobs[\s\S]*trend_events[\s\S]*trend_outbox[\s\S]*trend:manage/);
  assert.match(down,/DROP TABLE IF EXISTS `trend_topics`/);assert.match(worker,/succeeded_empty[\s\S]*failed_terminal[\s\S]*dead_letter/);assert.match(service,/insufficient_data/);assert.match(repository,/organization_id=\?[\s\S]*workspace_id=\?/);assert.match(routes,/trend:read[\s\S]*trend:manage/);assert.match(web,/loading[\s\S]*ready[\s\S]*empty[\s\S]*error[\s\S]*expired[\s\S]*forbidden[\s\S]*blocked/);assert.match(schema,/TREND_PROJECTION_POLL_MS/);assert.match(env,/TREND_PROJECTION_LEASE_SECONDS/);assert.match(openapi,/\/trends\/\{topicId\}\/follow:/);assert.match(feature,/trendDomain/);assert.match(architecture,/heat[\s\S]*signals/);assert.match(runbook,/宝塔[\s\S]*回滚/);assert.match(e2e,/toHaveScreenshot/);assert.match(live,/MySqlTrendProjectionWorker/);assert.match(blueprint,/M04-01 实现合同/);
  assert.match(worker,/isAutomaticProductDiscoveryProvider[\s\S]*opportunity\.candidate\.discovered/);
  assert.match(worker,/evaluateMonitoringRules[\s\S]*trend\.monitoring_rule\.matched[\s\S]*last_evaluated_at/);
  assert.match(openapi,/商品型自动热点频道[\s\S]*待评估选品/);
  assert.match(feature,/automaticProductDiscovery/);
  assert.match(architecture,/商品型热点频道[\s\S]*待评估选品/);
  assert.match(runbook,/自动发现选品[\s\S]*回滚/);
});
