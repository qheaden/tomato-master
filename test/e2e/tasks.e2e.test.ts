import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { AppHarness, closeApp, setupApp } from './helpers/appFrame';

describe('Tomato Master tasks', () => {
  let app: AppHarness;

  beforeEach(async () => {
    app = await setupApp();
  });

  afterEach(async () => {
    await closeApp();
  });

  test('adds tasks, updates the active banner, completes tasks, and deletes tasks', async () => {
    const taskInput = app.getByLabelText('New task');
    const addTask = app.getByRole('button', { name: 'Add task' });
    const tasksList = app.getByRole('list', { name: 'Tasks' });

    await taskInput.fill('Write docs');
    await addTask.click();

    expect(await tasksList.text()).toContain('Write docs');
    expect(await app.getByText('Working on:').visible()).toBe(true);
    expect(await app.getByTestId('active-task-display').text()).toBe('Write docs');

    await taskInput.fill('Review PR');
    await addTask.click();

    expect(await tasksList.text()).toContain('Review PR');

    await app.getByText('Review PR').click();
    expect(await app.getByTestId('active-task-display').text()).toBe('Review PR');

    await app.getByRole('checkbox', { name: 'Mark "Write docs" as complete' }).click();
    expect(await app.getByRole('checkbox', { name: 'Mark "Write docs" as complete' }).checked()).toBe(true);
    expect(await app.getByTestId('active-task-display').text()).toBe('Review PR');

    await app.getByRole('button', { name: 'Delete task "Review PR"' }).click();
    expect(await tasksList.text()).not.toContain('Review PR');
  });

  test('adds side quests and shows the break plan banner', async () => {
    const sideQuestInput = app.getByLabelText('New side quest');
    const addSideQuest = app.getByRole('button', { name: 'Add side quest' });
    const sideQuestList = app.getByRole('list', { name: 'Side Quests' });

    await sideQuestInput.fill('Stretch');
    await addSideQuest.click();

    expect(await sideQuestList.text()).toContain('Stretch');
    expect(await app.getByText('Break plan:').visible()).toBe(true);
    expect(await app.getByTestId('active-side-quest-display').text()).toBe('Stretch');
  });
});
