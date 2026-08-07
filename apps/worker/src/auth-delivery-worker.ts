import { randomUUID } from 'node:crypto';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { openAuthDelivery, type AuthDeliveryMessage } from '@scoutops/auth';
import { withTransaction } from '@scoutops/database';

export interface AuthMailProvider { send(message: AuthDeliveryMessage): Promise<void>; }
export class PendingMailProvider implements AuthMailProvider {
  async send(): Promise<void> { const error = new Error('mail_provider_pending'); error.name='mail_provider_pending'; throw error; }
}

interface ClaimedRow extends RowDataPacket { id:string;user_id:string;kind:'email_verification'|'password_reset';ciphertext:Buffer;nonce:Buffer;authTag:Buffer;attempt_count:number;request_id:string;trace_id:string }

export async function processAuthDeliveryOnce(input:{pool:Pool;workerId:string;masterKey:string;provider:AuthMailProvider;now?:()=>Date}) {
  const now=(input.now??(()=>new Date()))();const leaseUntil=new Date(now.getTime()+30_000);
  const claimed=await withTransaction(input.pool,async(connection)=>{const[rows]=await connection.query<ClaimedRow[]>("SELECT id,user_id,kind,payload_ciphertext AS ciphertext,payload_nonce AS nonce,payload_auth_tag AS authTag,attempt_count,request_id,trace_id FROM auth_delivery_outbox WHERE ((status IN ('queued','retry_scheduled') AND available_at<=?) OR (status='leased' AND lease_expires_at<=?)) ORDER BY available_at,id LIMIT 1 FOR UPDATE",[now,now]);const row=rows[0];if(!row)return null;await connection.query("UPDATE auth_delivery_outbox SET status='leased',attempt_count=attempt_count+1,lease_owner=?,lease_expires_at=?,updated_at=? WHERE id=?",[input.workerId,leaseUntil,now,row.id]);row.attempt_count+=1;return row;});
  if(!claimed)return{status:'idle'} as const;
  try{const message=openAuthDelivery(claimed,input.masterKey);await input.provider.send(message);await input.pool.query("UPDATE auth_delivery_outbox SET status='succeeded',lease_owner=NULL,lease_expires_at=NULL,last_error_code=NULL,updated_at=? WHERE id=?",[now,claimed.id]);return{status:'succeeded',trace_id:claimed.trace_id} as const;}
  catch(error){const code=error instanceof Error?(error.name==='mail_provider_pending'?'mail_provider_pending':'delivery_failed'):'delivery_failed';const terminal=code==='mail_provider_pending'?'blocked_provider':claimed.attempt_count>=3?'dead_letter':'retry_scheduled';const availableAt=new Date(now.getTime()+Math.min(300,2**claimed.attempt_count)*1000);await input.pool.query('UPDATE auth_delivery_outbox SET status=?,available_at=?,lease_owner=NULL,lease_expires_at=NULL,last_error_code=?,updated_at=? WHERE id=?',[terminal,availableAt,code,now,claimed.id]);await input.pool.query("INSERT INTO auth_security_events (id,user_id,event_type,outcome,request_id,trace_id,ip_hash,user_agent_hash,occurred_at,schema_version) VALUES (?,?,?,'blocked',?,?,NULL,NULL,?,1)",[randomUUID(),claimed.user_id,`auth_delivery.${terminal}`,claimed.request_id,claimed.trace_id,now]);return{status:terminal,error_code:code,trace_id:claimed.trace_id} as const;}
}
