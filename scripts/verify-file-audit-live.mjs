import {createHash,randomUUID} from 'node:crypto';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,relative} from 'node:path';
import {loadRuntimeConfig} from '../packages/config/dist/index.js';
import {createDatabasePool} from '../packages/database/dist/index.js';
import {createAuditEvent,issueDownloadGrant,verifyDownloadGrant,writeScopedFile} from '../packages/storage/dist/index.js';

const id=randomUUID();const config=loadRuntimeConfig(process.env,'api');const pool=createDatabasePool(config);const root=await mkdtemp(join(tmpdir(),'scoutops-m00-06-live-'));const fileId=randomUUID();const auditId=randomUUID();let cleaned=false;
async function cleanup(){try{await pool.query('DELETE FROM audit_logs WHERE id=?',[auditId]);await pool.query('DELETE FROM file_assets WHERE id=?',[fileId]);}catch{}await rm(root,{recursive:true,force:true});cleaned=true;}
try{
  for(const [table,file] of [['file_assets','database/migrations/0006a_m00_06_file_assets.up.sql'],['audit_logs','database/migrations/0006b_m00_06_audit_logs.up.sql']]){const [existing]=await pool.query('SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?',[table]);if(Number(existing[0].count)===0)await pool.query(await readFile(file,'utf8'));}
  const input={organization_id:'verify-org',workspace_id:'verify-workspace',category:'evidence',resource_id:fileId,filename:'probe.json'};const content=Buffer.from(JSON.stringify({request_id:id}));const path=await writeScopedFile(root,input,content);const key=Buffer.alloc(32,9);const token=issueDownloadGrant(root,input,key,30,1000);verifyDownloadGrant(token,key,{organization_id:'verify-org',workspace_id:'verify-workspace'},1001);
  const audit=createAuditEvent({organization_id:'verify-org',workspace_id:'verify-workspace',actor_id:'verify-actor',action:'file.write',resource_type:'file',resource_id:fileId,request_id:id,trace_id:id,metadata:{token:'must-redact',relative_path:relative(root,path)}});if(audit.metadata.token!=='[REDACTED]')throw new Error('audit redaction failed');
  await pool.query('INSERT INTO file_assets (id,organization_id,workspace_id,category,relative_path,content_sha256,size_bytes,status,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))',[fileId,'verify-org','verify-workspace','evidence',relative(root,path).replaceAll('\\','/'),createHash('sha256').update(content).digest('hex'),content.length,'active','verify-actor']);
  await pool.query('INSERT INTO audit_logs (id,organization_id,workspace_id,actor_id,action,resource_type,resource_id,request_id,trace_id,metadata_json,occurred_at,schema_version) VALUES (?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(3),1)',[auditId,'verify-org','verify-workspace','verify-actor','file.write','file',fileId,id,id,JSON.stringify(audit.metadata)]);
  const [rows]=await pool.query('SELECT COUNT(*) AS count FROM file_assets f JOIN audit_logs a ON a.organization_id=f.organization_id AND a.resource_id=f.id WHERE f.id=?',[fileId]);if(Number(rows[0].count)!==1)throw new Error('file/audit persistence mismatch');await cleanup();console.log(JSON.stringify({status:'passed',scope:'organization_and_workspace',grant:'verified',audit:'redacted_and_persisted',temp_cleanup:'passed',request_id:id,trace_id:id}));
}catch(error){console.error(JSON.stringify({status:'blocked',code:'file_audit_integration_failed',message:error instanceof Error?error.message:'unknown',request_id:id,trace_id:id}));process.exitCode=2;}
finally{if(!cleaned)await cleanup();await pool.end();}
