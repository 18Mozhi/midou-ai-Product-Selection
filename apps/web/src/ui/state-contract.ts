export const UI_STATE_KINDS=['loading','empty','error','forbidden','expired','blocked','recovery','not_found'] as const;
export type UiStateKind=typeof UI_STATE_KINDS[number];
export interface ConfirmationInput{destructive:boolean;acknowledged:boolean;confirmationText?:string;typedText?:string;}
export const stateFromHttp=(status:number):UiStateKind=>status===401?'expired':status===403?'forbidden':status===404?'not_found':[408,425,429,502,503,504].includes(status)?'blocked':'error';
export function sanitizeCorrelationId(value:unknown){return typeof value==='string'&&/^[A-Za-z0-9._:-]{1,128}$/.test(value)?value:'';}
export function canConfirm(input:ConfirmationInput){if(input.destructive&&!input.acknowledged)return false;const required=input.confirmationText?.trim();return !required||input.typedText?.trim()===required;}
export const DEFAULT_STATE_COPY:Record<UiStateKind,{eyebrow:string;title:string;description:string;primary:string;secondary?:string}>={
 loading:{eyebrow:'LOADING',title:'正在读取真实数据',description:'请求完成前不显示旧数据或推测结果。',primary:'请稍候'},
 empty:{eyebrow:'EMPTY',title:'这里还没有内容',description:'当前范围内没有结果；可调整条件或执行明确的首次操作。',primary:'开始创建',secondary:'调整筛选'},
 error:{eyebrow:'ERROR',title:'操作未完成',description:'请求失败且没有写入成功；请按提示重试。',primary:'重新尝试',secondary:'返回上一页'},
 forbidden:{eyebrow:'PERMISSION',title:'你没有此项权限',description:'服务端已拒绝访问；页面不会展示受限数据。',primary:'返回工作台',secondary:'申请权限'},
 expired:{eyebrow:'SESSION',title:'登录已失效',description:'重新登录后再继续，未提交的敏感操作不会自动重放。',primary:'重新登录'},
 blocked:{eyebrow:'BLOCKED',title:'依赖暂时受阻',description:'请求因限流、超时或依赖不可用而停止；不会伪装为成功。',primary:'稍后重试',secondary:'查看影响'},
 recovery:{eyebrow:'RECOVERED',title:'服务已恢复',description:'最新检查已通过；后续数据仍以服务端时间和来源为准。',primary:'继续'},
 not_found:{eyebrow:'404 / LOST IN SIGNAL',title:'没有找到这个页面',description:'地址可能已变更，或该入口不属于当前角色。',primary:'返回今日行动',secondary:'返回上一页'}
};
