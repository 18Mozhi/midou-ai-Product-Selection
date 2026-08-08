export type PlatformDashboardWindow="15m"|"24h"|"7d"|"30d";
export interface PlatformDashboardRepository{read(input:{actorId:string;window:PlatformDashboardWindow;windowMinutes:number;requestId:string;traceId:string}):Promise<unknown>}
export class PlatformDashboardError extends Error{constructor(readonly code:string,readonly statusCode:number,readonly actionHint:string,message=code){super(message);this.name="PlatformDashboardError";}}
const windows:Record<PlatformDashboardWindow,number>={"15m":15,"24h":1440,"7d":10080,"30d":43200};
export class PlatformDashboardService{
  constructor(private readonly repository:PlatformDashboardRepository,private readonly defaultWindow:PlatformDashboardWindow="24h"){}
  read(input:{actorId:string;window?:unknown;requestId:string;traceId:string}){const window=String(input.window??this.defaultWindow) as PlatformDashboardWindow;if(!(window in windows))throw new PlatformDashboardError("platform_dashboard_window_invalid",400,"选择 15m、24h、7d 或 30d。");return this.repository.read({...input,window,windowMinutes:windows[window]});}
}
