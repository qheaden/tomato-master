import { describe, expect, it } from 'vitest';
import {
  getEffectiveTheme,
  isThemePreference,
  loadThemePreference,
  saveThemePreference,
  THEME_STORAGE_KEY,
} from '../../src/themePreference';

describe('themePreference', () => {
  const makeStorage = () => {
    const data = new Map<string, string>();
    return {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
    } as unknown as Storage;
  };

  it('validates theme preference values', () => {
    expect(isThemePreference('system')).toBe(true);
    expect(isThemePreference('light')).toBe(true);
    expect(isThemePreference('dark')).toBe(true);
    expect(isThemePreference('nope')).toBe(false);
    expect(isThemePreference(null)).toBe(false);
  });

  it('loads system as default when storage value is invalid', () => {
    const storage = makeStorage();
    storage.setItem(THEME_STORAGE_KEY, 'invalid');

    expect(loadThemePreference(storage)).toBe('system');
  });

  it('persists and loads preference', () => {
    const storage = makeStorage();
    saveThemePreference(storage, 'dark');

    expect(loadThemePreference(storage)).toBe('dark');
  });

  it('resolves effective theme for system/light/dark', () => {
    expect(getEffectiveTheme('system', true)).toBe('dark');
    expect(getEffectiveTheme('system', false)).toBe('light');
    expect(getEffectiveTheme('light', true)).toBe('light');
    expect(getEffectiveTheme('dark', false)).toBe('dark');
  });
});
