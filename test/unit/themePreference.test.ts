import { expect } from 'chai';
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
    expect(isThemePreference('system')).to.equal(true);
    expect(isThemePreference('light')).to.equal(true);
    expect(isThemePreference('dark')).to.equal(true);
    expect(isThemePreference('nope')).to.equal(false);
    expect(isThemePreference(null)).to.equal(false);
  });

  it('loads system as default when storage value is invalid', () => {
    const storage = makeStorage();
    storage.setItem(THEME_STORAGE_KEY, 'invalid');

    expect(loadThemePreference(storage)).to.equal('system');
  });

  it('persists and loads preference', () => {
    const storage = makeStorage();
    saveThemePreference(storage, 'dark');

    expect(loadThemePreference(storage)).to.equal('dark');
  });

  it('resolves effective theme for system/light/dark', () => {
    expect(getEffectiveTheme('system', true)).to.equal('dark');
    expect(getEffectiveTheme('system', false)).to.equal('light');
    expect(getEffectiveTheme('light', true)).to.equal('light');
    expect(getEffectiveTheme('dark', false)).to.equal('dark');
  });
});
