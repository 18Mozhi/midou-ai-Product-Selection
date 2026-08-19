export const themeIds=['deep-ocean','aurora-purple','cloud-white'] as const;
export type ThemeId=(typeof themeIds)[number];
export const themes:ReadonlyArray<{id:ThemeId;name:string;caption:string;mode:string}>=[
 {id:'deep-ocean',name:'深海蓝',caption:'专注、克制，适合长时间决策工作',mode:'深色'},
 {id:'aurora-purple',name:'极光紫',caption:'增强探索感，保持同一业务语义',mode:'深色'},
 {id:'cloud-white',name:'云雾白',caption:'明亮、清晰，适合高照度环境',mode:'浅色'}
];
export function isThemeId(value:unknown):value is ThemeId{return typeof value==='string'&&themeIds.includes(value as ThemeId)}
const themeStorageKey="scoutops:ui-theme";
export function applyTheme(theme:ThemeId,cache=true){document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme==='cloud-white'?'light':'dark';if(cache)try{window.localStorage.setItem(themeStorageKey,theme)}catch{}}
export function applyCachedTheme(){let cached:unknown;try{cached=window.localStorage.getItem(themeStorageKey)}catch{}const theme=isThemeId(cached)?cached:'deep-ocean';applyTheme(theme,false);return theme;}
