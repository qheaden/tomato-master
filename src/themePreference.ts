export type ThemePreference = 'system' | 'light' | 'dark';

const THEME_STORAGE_KEY = 'tomato-master:theme-preference';

export function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function loadThemePreference(storage: Storage): ThemePreference {
  const value = storage.getItem(THEME_STORAGE_KEY);
  return isThemePreference(value) ? value : 'system';
}

export function saveThemePreference(storage: Storage, preference: ThemePreference): void {
  storage.setItem(THEME_STORAGE_KEY, preference);
}

export function getEffectiveTheme(preference: ThemePreference, prefersDark: boolean): 'light' | 'dark' {
  if (preference === 'system') return prefersDark ? 'dark' : 'light';
  return preference;
}

export { THEME_STORAGE_KEY };
