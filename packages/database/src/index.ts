import { createHash } from 'node:crypto';
import mysql, { type Pool, type PoolConnection } from 'mysql2/promise';
import type { RuntimeConfig } from '@scoutops/config';

export const migrationChecksum = (sql: string) => createHash('sha256').update(sql.replace(/\r\n/g,'\n')).digest('hex');
export function createDatabasePool(config: RuntimeConfig): Pool {
  return mysql.createPool({host:config.database.host,port:config.database.port,database:config.database.name,user:config.database.user,password:config.database.password,charset:'utf8mb4',connectionLimit:10,waitForConnections:true,queueLimit:0,enableKeepAlive:true});
}
export async function withTransaction<T>(pool: Pick<Pool,'getConnection'>, work:(connection:PoolConnection)=>Promise<T>):Promise<T>{
  const connection=await pool.getConnection(); try{await connection.beginTransaction();const result=await work(connection);await connection.commit();return result;}catch(error){await connection.rollback();throw error;}finally{connection.release();}
}
export interface MigrationRecord { name:string; checksum:string }
export interface MigrationExecutor { execute(sql:string,values?:unknown[]):Promise<unknown>; queryApplied():Promise<MigrationRecord[]> }
export function createMigrationExecutor(pool: Pool): MigrationExecutor {
  return {
    execute: async (sql, values = []) => pool.query(sql, values),
    queryApplied: async () => {
      const [rows] = await pool.query('SELECT name, checksum FROM schema_migrations ORDER BY name');
      return rows as MigrationRecord[];
    },
  };
}
export async function applyMigration(executor:MigrationExecutor,migration:{name:string;sql:string}){
  const checksum=migrationChecksum(migration.sql);const applied=await executor.queryApplied();const existing=applied.find(item=>item.name===migration.name);
  if(existing&&existing.checksum!==checksum) throw new Error(`migration_checksum_mismatch:${migration.name}`);
  if(existing) return 'already_applied';
  await executor.execute(migration.sql);await executor.execute('INSERT INTO schema_migrations (name, checksum, applied_at) VALUES (?, ?, UTC_TIMESTAMP(3))',[migration.name,checksum]);return 'applied';
}
