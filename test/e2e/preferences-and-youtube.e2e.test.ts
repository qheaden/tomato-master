import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { AppHarness, closeApp, setupApp } from './helpers/appFrame';

describe('Tomato Master preferences and YouTube playlist UI', () => {
  let app: AppHarness;

  beforeEach(async () => {
    app = await setupApp();
  });

  afterEach(async () => {
    await closeApp();
  });

  test('switches theme modes and updates the active button state', async () => {
    const body = app.getByTestId('app-body');
    const systemTheme = app.getByRole('button', { name: 'System theme' });
    const lightTheme = app.getByRole('button', { name: 'Light theme' });
    const darkTheme = app.getByRole('button', { name: 'Dark theme' });

    await darkTheme.click();
    expect(await body.attribute('data-theme')).toBe('dark');
    expect((await darkTheme.className()) ?? '').toContain('active');
    expect((await lightTheme.className()) ?? '').not.toContain('active');
    expect((await systemTheme.className()) ?? '').not.toContain('active');

    await lightTheme.click();
    expect(await body.attribute('data-theme')).toBe('light');
    expect((await lightTheme.className()) ?? '').toContain('active');
    expect((await darkTheme.className()) ?? '').not.toContain('active');

    await systemTheme.click();
    expect((await body.attribute('data-theme'))).toMatch(/^(light|dark)$/);
    expect((await systemTheme.className()) ?? '').toContain('active');
    expect((await lightTheme.className()) ?? '').not.toContain('active');
    expect((await darkTheme.className()) ?? '').not.toContain('active');
  });

  test('loads and removes a YouTube playlist URL without needing the external player API', async () => {
    const playlistUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL1234567890';
    const playlistInput = app.getByLabelText('YouTube playlist URL');
    const loadPlaylist = app.getByRole('button', { name: 'Load playlist' });
    const playerContainer = app.getByTestId('youtube-player-container');

    await playlistInput.fill(playlistUrl);
    await loadPlaylist.click();

    expect(await app.getByRole('button', { name: 'Remove playlist' }).visible()).toBe(true);
    expect(await playerContainer.visible()).toBe(true);
    expect(await playlistInput.value()).toBe(playlistUrl);

    await app.getByRole('button', { name: 'Remove playlist' }).click();

    expect(await playlistInput.value()).toBe('');
    expect(await app.getByRole('button', { name: 'Load playlist' }).visible()).toBe(true);
    expect(await playerContainer.visible()).toBe(false);
  });
});
