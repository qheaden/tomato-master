import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { AppHarness, closeApp, setupApp } from './helpers/appFrame';

describe('Tomato Master smoke', () => {
  let app: AppHarness;

  beforeEach(async () => {
    app = await setupApp();
  });

  afterEach(async () => {
    await closeApp();
  });

  test('renders the main dashboard state', async () => {
    expect(await app.getByText('Tomato Master').visible()).toBe(true);
    expect(await app.getByText('25:00').visible()).toBe(true);
    expect(await app.getByText('Ready').visible()).toBe(true);

    expect(await app.getByRole('button', { name: 'Start work session' }).visible()).toBe(true);
    expect(await app.getByRole('button', { name: 'Start short break' }).visible()).toBe(true);
    expect(await app.getByRole('button', { name: 'Start long break' }).visible()).toBe(true);

    expect(await app.getByText('No tasks yet. Add one above!').visible()).toBe(true);
    expect(await app.getByText('No side quests yet. Add one above!').visible()).toBe(true);

    expect((await app.getByTestId('note-modal').className()) ?? '').not.toContain('visible');
  });
});
