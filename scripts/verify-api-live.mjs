import { randomUUID } from 'node:crypto';
import { loadRuntimeConfig } from '../packages/config/dist/index.js';
import { createDatabasePool } from '../packages/database/dist/index.js';
import { createRedisConnection, ScopedRedisStore } from '../packages/redis/dist/index.js';
import { buildApp } from '../apps/api/dist/app.js';
const id=randomUUID();const config=loadRuntimeConfig(process.env,'api');const pool=createDatabasePool(config);const client=createRedisConnection(config);client.on('error',()=>{});const store=new ScopedRedisStore(client);
const app=buildApp({readinessChecks:[{name:'mysql',check:async()=>{try{await pool.query('SELECT 1');return'available';}catch{return'unavailable';}}},{name:'redis',check:async(requestId,traceId)=>{try{await store.connect();return(await store.health(requestId,traceId)).status;}catch{return'unavailable';}}}]});
try{const response=await app.inject({method:'GET',url:'/api/v1/health/ready',headers:{'x-request-id':id,'x-trace-id':id}});const body=response.json();if(response.statusCode!==200||body.data?.status!=='ready'||body.request_id!==id)throw new Error('readiness contract failed');console.log(JSON.stringify({status:'passed',dependencies:body.data.dependencies,request_id:id,trace_id:id}));}
catch(error){console.error(JSON.stringify({status:'blocked',code:'api_readiness_unavailable',message:error instanceof Error?error.message:'unknown',request_id:id,trace_id:id}));process.exitCode=2;}
finally{await app.close();await store.close();await pool.end();}
