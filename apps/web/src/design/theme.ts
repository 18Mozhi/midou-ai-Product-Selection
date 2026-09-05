export const themeIds = ["deep-ocean", "aurora-purple", "cloud-white"] as const;
export type ThemeId = (typeof themeIds)[number];
export const themes: ReadonlyArray<{ id: ThemeId; name: string; caption: string; mode: string }> = [
  { id: "deep-ocean", name: "信号纸", caption: "暖白纸张与朱砂信号，适合持续决策", mode: "纸张" },
  { id: "aurora-purple", name: "档案纸", caption: "偏暖档案底色，适合高密度复核", mode: "纸张" },
  { id: "cloud-white", name: "净页白", caption: "清晰白底，适合高照度环境", mode: "纸张" },
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
  document.documentElement.style.colorScheme = "light";
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
