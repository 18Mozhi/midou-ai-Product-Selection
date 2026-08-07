import type { Pool, RowDataPacket } from 'mysql2/promise';
import { withTransaction } from '@scoutops/database';
import { TenancyError, type Membership, type Organization, type SessionContext, type Team, type TenancyAuditEvent, type TenancyRepository, type Workspace } from '@scoutops/tenancy';

const organizationColumns='id,name,slug,status,timezone,data_retention_days,default_workspace_id,created_by,version,created_at,updated_at';
const workspaceColumns='id,organization_id,name,slug,status,created_by,version,created_at,updated_at';
const membershipColumns='id,organization_id,user_id,status,joined_at,version,created_at,updated_at';
const teamColumns='id,organization_id,name,status,created_by,version,created_at,updated_at';
const asOrganization=(row:RowDataPacket)=>row as Organization;
const asWorkspace=(row:RowDataPacket)=>row as Workspace;
const asMembership=(row:RowDataPacket)=>row as Membership;
const asTeam=(row:RowDataPacket)=>row as Team;
const auditValues=(event:TenancyAuditEvent)=>[event.id,event.organization_id,event.workspace_id,event.actor_id,event.action,event.resource_type,event.resource_id,event.request_id,event.trace_id,event.occurred_at,event.schema_version];

export class MySqlTenancyRepository implements TenancyRepository {
  constructor(private readonly pool:Pool){}

  async provision(input:{organization:Organization;workspace:Workspace;membership:Membership;audit:TenancyAuditEvent}){
    try{
      await withTransaction(this.pool,async(connection)=>{
        const o=input.organization,w=input.workspace,m=input.membership;
        await connection.query('INSERT INTO organizations (id,name,slug,status,timezone,data_retention_days,default_workspace_id,created_by,version,created_at,updated_at) VALUES (?,?,?,?,?,?,NULL,?,?,?,?)',[o.id,o.name,o.slug,o.status,o.timezone,o.data_retention_days,o.created_by,o.version,o.created_at,o.updated_at]);
        await connection.query('INSERT INTO workspaces (id,organization_id,name,slug,status,created_by,version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)',[w.id,w.organization_id,w.name,w.slug,w.status,w.created_by,w.version,w.created_at,w.updated_at]);
        await connection.query('UPDATE organizations SET default_workspace_id=? WHERE id=?',[w.id,o.id]);
        await connection.query('INSERT INTO memberships (id,organization_id,user_id,status,joined_at,version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)',[m.id,m.organization_id,m.user_id,m.status,m.joined_at,m.version,m.created_at,m.updated_at]);
        await connection.query('INSERT INTO tenancy_audit_events (id,organization_id,workspace_id,actor_id,action,resource_type,resource_id,request_id,trace_id,occurred_at,schema_version) VALUES (?,?,?,?,?,?,?,?,?,?,?)',auditValues(input.audit));
      });
    }catch(error){
      if(typeof error==='object'&&error&&'code' in error&&error.code==='ER_DUP_ENTRY')throw new TenancyError('organization_slug_conflict',409,'更换组织标识后重试。');
      throw error;
    }
  }

  async listOrganizations(userId:string){
    const[rows]=await this.pool.query<RowDataPacket[]>(`SELECT ${organizationColumns.split(',').map(x=>`o.${x}`).join(',')},${membershipColumns.split(',').map(x=>`m.${x} AS membership_${x}`).join(',')} FROM memberships m JOIN organizations o ON o.id=m.organization_id WHERE m.user_id=? AND m.status='active' ORDER BY o.name,o.id`,[userId]);
    return rows.map(row=>({organization:asOrganization(row),membership:asMembership({id:row.membership_id,organization_id:row.membership_organization_id,user_id:row.membership_user_id,status:row.membership_status,joined_at:row.membership_joined_at,version:row.membership_version,created_at:row.membership_created_at,updated_at:row.membership_updated_at} as RowDataPacket)}));
  }
  async findActiveMembership(userId:string,organizationId:string){const[rows]=await this.pool.query<RowDataPacket[]>(`SELECT ${membershipColumns} FROM memberships WHERE user_id=? AND organization_id=? AND status='active' LIMIT 1`,[userId,organizationId]);return rows[0]?asMembership(rows[0]):null;}
  async findOrganization(id:string){const[rows]=await this.pool.query<RowDataPacket[]>(`SELECT ${organizationColumns} FROM organizations WHERE id=? LIMIT 1`,[id]);return rows[0]?asOrganization(rows[0]):null;}
  async findWorkspace(id:string){const[rows]=await this.pool.query<RowDataPacket[]>(`SELECT ${workspaceColumns} FROM workspaces WHERE id=? LIMIT 1`,[id]);return rows[0]?asWorkspace(rows[0]):null;}
  async listWorkspaces(organizationId:string){const[rows]=await this.pool.query<RowDataPacket[]>(`SELECT ${workspaceColumns} FROM workspaces WHERE organization_id=? ORDER BY name,id`,[organizationId]);return rows.map(asWorkspace);}
  async listTeams(organizationId:string){const[rows]=await this.pool.query<RowDataPacket[]>(`SELECT ${teamColumns} FROM teams WHERE organization_id=? ORDER BY name,id`,[organizationId]);return rows.map(asTeam);}
  async saveContext(context:SessionContext,audit:TenancyAuditEvent){
    await withTransaction(this.pool,async(connection)=>{
      await connection.query('INSERT INTO user_session_contexts (session_id,user_id,organization_id,workspace_id,selected_at) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id),organization_id=VALUES(organization_id),workspace_id=VALUES(workspace_id),selected_at=VALUES(selected_at)',[context.session_id,context.user_id,context.organization_id,context.workspace_id,context.selected_at]);
      await connection.query('INSERT INTO tenancy_audit_events (id,organization_id,workspace_id,actor_id,action,resource_type,resource_id,request_id,trace_id,occurred_at,schema_version) VALUES (?,?,?,?,?,?,?,?,?,?,?)',auditValues(audit));
    });
  }
}
