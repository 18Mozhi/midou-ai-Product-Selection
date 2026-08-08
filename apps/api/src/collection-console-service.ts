export class CollectionConsoleError extends Error{constructor(readonly code:string,readonly statusCode:number,readonly actionHint:string,message=code){super(message);this.name="CollectionConsoleError";}}
export interface CollectionConsoleRepository{read(i:any):Promise<any>}
const id=(v:unknown)=>{const x=String(v??"");if(x&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x))throw new CollectionConsoleError("collection_console_scope_invalid",400,"提交有效组织或工作区标识。");return x||null;};
export class CollectionConsoleService{constructor(private readonly repo:CollectionConsoleRepository,private readonly recentLimit=50){}read(i:any){return this.repo.read({...i,organizationId:id(i.organizationId),workspaceId:id(i.workspaceId),recentLimit:this.recentLimit});}}
