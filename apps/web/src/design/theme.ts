export const themeIds = ["deep-ocean", "aurora-purple", "cloud-white"] as const;
export type ThemeId = (typeof themeIds)[number];
export const themes: ReadonlyArray<{ id: ThemeId; name: string; caption: string; mode: string }> = [
  { id: "deep-ocean", name: "深海蓝", caption: "专注、克制，适合长时间决策工作", mode: "深色" },
  { id: "aurora-purple", name: "极光紫", caption: "增强探索感，保持同一业务语义", mode: "深色" },
  { id: "cloud-white", name: "云雾白", caption: "明亮、清晰，适合高照度环境", mode: "浅色" },
];

export const densityIds = ["standard", "compact"] as const;
export type DensityId = (typeof densityIds)[number];
export const densities: ReadonlyArray<{
  id: DensityId;
  name: string;
  caption: string;
}> = [
  { id: "standard", name: "标准", caption: "舒适间距，适合浏览与日常处理" },
  { id: "compact", name: "紧凑", caption: "提高信息密度，适合批量操作" },
];

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && themeIds.includes(value as ThemeId);
}

export function isDensityId(value: unknown): value is DensityId {
  return typeof value === "string" && densityIds.includes(value as DensityId);
}

const themeStorageKey = "scoutops:ui-theme";
let preferredDensity: DensityId = "standard";

export function applyTheme(theme: ThemeId, cache = true) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme === "cloud-white" ? "light" : "dark";
  if (cache)
    try {
      window.localStorage.setItem(themeStorageKey, theme);
    } catch (error) {
      void error;
    }
}

export function applyDensity(density: DensityId) {
  preferredDensity = density;
  document.documentElement.dataset.density = density;
}

export function applyShellDensity(administrative: boolean) {
  document.documentElement.dataset.density = administrative ? "compact" : preferredDensity;
}

export function applyCachedTheme() {
  let cached: unknown;
  try {
    cached = window.localStorage.getItem(themeStorageKey);
  } catch (error) {
    void error;
  }
  const theme = isThemeId(cached) ? cached : "deep-ocean";
  applyTheme(theme, false);
  return theme;
}
