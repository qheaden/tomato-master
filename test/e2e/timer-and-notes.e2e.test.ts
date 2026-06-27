import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { AppHarness, closeApp, setupApp } from './helpers/appFrame';

describe('Tomato Master timer and notes', () => {
  let app: AppHarness;

  beforeEach(async () => {
    app = await setupApp();
  });

  afterEach(async () => {
    await closeApp();
  });

  test('runs a work session, pauses, resumes, cancels, and saves a context note', async () => {
    const workButton = app.getByRole('button', { name: 'Start work session' });
    await workButton.click();

    expect(await app.getByTestId('timer-label').text()).toBe('Work Session');
    expect(await app.getByRole('button', { name: 'Pause timer' }).visible()).toBe(true);
    expect(await app.getByRole('button', { name: 'Cancel timer' }).visible()).toBe(true);
    expect(await workButton.disabled()).toBe(true);
    expect(await app.getByRole('button', { name: 'Start short break' }).disabled()).toBe(true);
    expect(await app.getByRole('button', { name: 'Start long break' }).disabled()).toBe(true);

    const pauseButton = app.getByRole('button', { name: 'Pause timer' });
    await pauseButton.click();
    expect(await app.getByRole('button', { name: 'Resume timer' }).visible()).toBe(true);

    await app.getByRole('button', { name: 'Resume timer' }).click();
    expect(await app.getByRole('button', { name: 'Pause timer' }).visible()).toBe(true);

    await app.getByRole('button', { name: 'Cancel timer' }).click();
    expect(await app.getByText('Ready').visible()).toBe(true);
    expect(await app.getByText('Session Cancelled').visible()).toBe(true);
    expect((await app.getByTestId('note-modal').className()) ?? '').toContain('visible');

    const noteTextarea = app.getByLabelText('Context note');
    await noteTextarea.fill('Picked up the next task after the break.');
    await app.getByRole('button', { name: 'Save Note' }).click();

    expect(await app.getByRole('alert').visible()).toBe(true);
    expect(await app.getByRole('alert').text()).toContain('Picked up the next task after the break.');

    await app.getByRole('button', { name: 'Dismiss note' }).click();
    expect(await app.getByRole('alert').visible()).toBe(false);
  });

  test('starts a short break and cancels without opening the note modal', async () => {
    await app.getByRole('button', { name: 'Start short break' }).click();

    expect(await app.getByText('05:00').visible()).toBe(true);
    expect(await app.getByTestId('timer-label').text()).toBe('Short Break');

    await app.getByRole('button', { name: 'Cancel timer' }).click();
    expect(await app.getByText('Ready').visible()).toBe(true);
    expect((await app.getByTestId('note-modal').className()) ?? '').not.toContain('visible');
  });
});
