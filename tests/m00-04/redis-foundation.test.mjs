import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildScopedRedisKey, REDIS_TTL_POLICY, resolveRedisTtl, ScopedRedisStore } from '../../packages/redis/dist/index.js';
import { loadRuntimeConfig } from '../../packages/config/dist/index.js';

test('M00-04 key always scopes organization and optional workspace', () => {
  const org = buildScopedRedisKey({ purpose: 'cache', organization_id: 'org-a', resource: 'trend', identifiers: ['same'] });
  const workspace = buildScopedRedisKey({ purpose: 'cache', organization_id: 'org-a', workspace_id: 'ws-a', resource: 'trend', identifiers: ['same'] });
  const otherOrg = buildScopedRedisKey({ purpose: 'cache', organization_id: 'org-b', resource: 'trend', identifiers: ['same'] });
  assert.match(org, /^scoutops:v1:cache:org:org-a:ws:_organization:/);
  assert.notEqual(org, workspace);
  assert.notEqual(org, otherOrg);
});

test('M00-04 rejects missing scope and unsafe or empty segments', () => {
  assert.throws(() => buildScopedRedisKey({ purpose: 'queue', organization_id: '', resource: 'job' }), /organization_id/);
  assert.throws(() => buildScopedRedisKey({ purpose: 'queue', organization_id: 'org-a', resource: '' }), /resource/);
});

test('M00-04 TTL policy has bounded expiring values', () => {
  for (const [purpose, policy] of Object.entries(REDIS_TTL_POLICY)) {
    assert.ok(policy.defaultSeconds > 0);
    assert.ok(policy.defaultSeconds <= policy.maximumSeconds);
    assert.equal(resolveRedisTtl(purpose), policy.defaultSeconds);
    assert.throws(() => resolveRedisTtl(purpose, policy.maximumSeconds + 1), /TTL/);
  }
});

test('M00-04 JSON store applies expiry and preserves scope', async () => {
  const calls = [];
  const client = { isOpen: true, connect: async()=>{}, quit:async()=>{}, destroy:()=>{}, ping:async()=> 'PONG', get:async()=>'{"ok":true}', set:async(...args)=>{calls.push(args);return 'OK';}, del:async()=>1, ttl:async()=>59, incr:async()=>1, expire:async()=>true, eval:async()=>[1,60] };
  const store = new ScopedRedisStore(client);
  const input = { purpose:'cache', organization_id:'org-a', workspace_id:'ws-a', resource:'card' };
  await store.writeJson(input, { ok:true }, 120);
  assert.equal(calls[0][2].EX, 120);
  assert.match(calls[0][0], /org:org-a:ws:ws-a/);
  assert.deepEqual(await store.readJson(input), { ok:true });
});

test('M00-04 rate counter atomically assigns TTL on first increment', async () => {
  let value=0; const scripts=[];
  const client={isOpen:true,connect:async()=>{},quit:async()=>{},destroy:()=>{},ping:async()=> 'PONG',get:async()=>null,set:async()=> 'OK',del:async()=>1,ttl:async()=>60,incr:async()=>++value,expire:async()=>true,eval:async(script)=>{scripts.push(script);value+=1;return [value,60];}};
  const store=new ScopedRedisStore(client);const input={organization_id:'org-a',resource:'login',identifiers:['actor-a']};
  assert.equal((await store.incrementRate(input)).count,1);
  assert.equal((await store.incrementRate(input)).count,2);
  assert.equal(scripts.length,2);assert.match(scripts[0],/INCR.*EXPIRE/);
});

test('M00-04 queue lease only releases the matching token', async () => {
  const calls=[];
  const client={isOpen:true,connect:async()=>{},quit:async()=>{},destroy:()=>{},ping:async()=> 'PONG',get:async()=>null,set:async(...args)=>{calls.push(args);return 'OK';},del:async()=>1,ttl:async()=>60,incr:async()=>1,expire:async()=>true,eval:async(_script,options)=>options.arguments[0]==='owner-a'?1:0};
  const store=new ScopedRedisStore(client);const input={organization_id:'org-a',workspace_id:'ws-a',resource:'lease',identifiers:['job-a']};
  assert.equal(await store.acquireLease(input,'owner-a',30),true);assert.deepEqual(calls[0][2],{EX:30,NX:true});
  assert.equal(await store.releaseLease(input,'owner-b'),false);assert.equal(await store.releaseLease(input,'owner-a'),true);
});

test('M00-04 health maps dependency failure without leaking connection details', async () => {
  const client={isOpen:true,connect:async()=>{},quit:async()=>{},destroy:()=>{},ping:async()=>{throw new Error('redis://secret@host')},get:async()=>null,set:async()=> 'OK',del:async()=>0,ttl:async()=>-2,incr:async()=>1,expire:async()=>true,eval:async()=>0};
  const status=await new ScopedRedisStore(client).health('request-1','trace-1');
  assert.deepEqual({status:status.status,request_id:status.request_id,trace_id:status.trace_id},{status:'unavailable',request_id:'request-1',trace_id:'trace-1'});
  assert.doesNotMatch(JSON.stringify(status),/secret|host/);
});

test('M00-04 migration is MySQL 5.7 compatible and reversible', async () => {
  const up=await readFile('database/migrations/0004_m00_04_redis_namespace_catalog.up.sql','utf8');
  const down=await readFile('database/migrations/0004_m00_04_redis_namespace_catalog.down.sql','utf8');
  assert.match(up,/utf8mb4/);assert.match(up,/cache.*queue.*rate.*sse/s);assert.doesNotMatch(up,/CHECK\s*\(|utf8mb4_0900/i);assert.match(down,/DROP TABLE/);
});

test('M00-04 config timeout validates range and remains backend-only', async () => {
  assert.equal(loadRuntimeConfig({ NODE_ENV:'test', REDIS_CONNECT_TIMEOUT_MS:'4500' }).redis.connectTimeoutMs, 4500);
  assert.throws(() => loadRuntimeConfig({ NODE_ENV:'test', REDIS_CONNECT_TIMEOUT_MS:'99' }), /REDIS_CONNECT_TIMEOUT_MS/);
  const env=await readFile('config/env.example','utf8');const schema=await readFile('config/schema.json','utf8');
  assert.match(env,/REDIS_CONNECT_TIMEOUT_MS=3000/);assert.match(schema,/REDIS_CONNECT_TIMEOUT_MS/);
});

test('M00-04 OpenAPI, Feature Map, UI, docs and atomic evidence are synchronized', async () => {
  const [api,map,ui,architecture,runbook,registry]=await Promise.all([
    'docs/openapi.yaml','docs/feature-map.json','apps/web/src/components/RedisFoundation.vue',
    'docs/architecture/m00-04-redis-foundation.md','docs/runbooks/m00-04-redis-foundation.md','verification/modules/M00-04.json',
  ].map(path=>readFile(path,'utf8')));
  assert.match(api,/x-scoutops-redis:[\s\S]*RedisDependencyStatus/);assert.match(map,/scoutops:v1:<purpose>:org:<organization_id>/);
  for(const state of ['AVAILABLE','UNAVAILABLE','RECOVERING']) assert.match(ui,new RegExp(state));
  assert.match(architecture,/64_系统监控\.jpg/);assert.match(runbook,/## 回滚/);
  const parsed=JSON.parse(registry);assert.equal(parsed.atomicTasks.length,17);assert.deepEqual(parsed.atomicTasks.map(item=>item.id),Array.from({length:17},(_,i)=>`M00-04.A${String(i+1).padStart(2,'0')}`));
});
