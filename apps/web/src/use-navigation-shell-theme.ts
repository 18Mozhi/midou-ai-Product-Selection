import { ref } from "vue";
import { applyTheme, isThemeId, type ThemeId } from "./design/theme";

interface ThemePreference {
  theme: ThemeId;
  version: number;
}
type Request = <T>(
  path: string,
  options?: { method?: string; body?: unknown },
) => Promise<{ data: T }>;

export function useNavigationShellTheme(request: Request) {
  const themeOpen = ref(false),
    activeTheme = ref<ThemeId>(
      isThemeId(document.documentElement.dataset.theme)
        ? document.documentElement.dataset.theme
        : "deep-ocean",
    ),
    themeVersion = ref<number | null>(null),
    themeNotice = ref("");
  let sequence = 0;

  async function loadThemePreference(showFailure = false) {
    const current = ++sequence;
    try {
      const response = await request<ThemePreference>("/me/ui-preferences");
      if (!isThemeId(response.data?.theme)) throw new Error("主题偏好读取失败");
      if (current !== sequence) return false;
      activeTheme.value = response.data.theme;
      themeVersion.value = Number(response.data.version ?? 0);
      applyTheme(activeTheme.value);
      return true;
    } catch {
      if (showFailure) themeNotice.value = "主题偏好暂时无法同步，已保留当前界面主题。";
      return false;
    }
  }

  async function chooseTheme(theme: ThemeId) {
    if (themeVersion.value === null) await loadThemePreference(false);
    ++sequence;
    const previousTheme = activeTheme.value;
    applyTheme(theme);
    activeTheme.value = theme;
    themeOpen.value = false;
    themeNotice.value = "正在保存主题…";
    try {
      const response = await request<ThemePreference>("/me/ui-preferences", {
        method: "PUT",
        body: { theme, expected_version: themeVersion.value ?? 0 },
      });
      if (!isThemeId(response.data?.theme)) throw new Error("主题保存失败");
      activeTheme.value = response.data.theme;
      themeVersion.value = Number(response.data.version);
      applyTheme(activeTheme.value);
      themeNotice.value = "主题已应用到全部模块。";
    } catch {
      activeTheme.value = previousTheme;
      applyTheme(previousTheme);
      themeNotice.value = "主题保存失败，已恢复原主题，请稍后重试。";
    }
  }
  return { themeOpen, activeTheme, themeNotice, loadThemePreference, chooseTheme };
}
