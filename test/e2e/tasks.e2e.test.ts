import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { AppHarness, byRole, byTestId, closeApp, setupApp } from './helpers/appFrame';

async function addItems(app: AppHarness, inputLabel: string, buttonName: string, items: string[]): Promise<void> {
  const input = app.getByLabelText(inputLabel);
  const button = app.getByRole('button', { name: buttonName });

  for (const item of items) {
    await input.fill(item);
    await button.click();
  }
}

async function expectListOrder(app: AppHarness, prefix: 'tasks' | 'side-quests', ids: string[], expectedTexts: string[]): Promise<void> {
  const texts = await Promise.all(ids.map((id) => app.getByTestId(`${prefix}-item-${id}`).text()));
  expectedTexts.forEach((text, index) => expect(texts[index]).toContain(text));
}

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

  test('reorders main tasks, moves a task to the bottom, and persists the order', async () => {
    const tasksList = app.getByRole('list', { name: 'Tasks' });

    await addItems(app, 'New task', 'Add task', ['Task A', 'Task B', 'Task C']);
    await app.dragPointer(
      byTestId('tasks-reorder-3'),
      byTestId('tasks-item-1'),
    );
    await expectListOrder(app, 'tasks', ['3', '1', '2'], ['Task C', 'Task A', 'Task B']);

    await app.dragPointer(
      byTestId('tasks-reorder-3'),
      byRole('list', 'Tasks'),
      { dropPosition: 'bottom' },
    );
    await expectListOrder(app, 'tasks', ['1', '2', '3'], ['Task A', 'Task B', 'Task C']);

    await app.reload();
    expect(await tasksList.text()).toContain('Task A');
    await expectListOrder(app, 'tasks', ['1', '2', '3'], ['Task A', 'Task B', 'Task C']);
  });

  test('reorders side quests with touch-style pointer input and persists the order', async () => {
    const sideQuestList = app.getByRole('list', { name: 'Side Quests' });

    await addItems(app, 'New side quest', 'Add side quest', ['Quest A', 'Quest B', 'Quest C']);
    await app.dragPointer(
      byTestId('side-quests-reorder-3'),
      byTestId('side-quests-item-1'),
      { pointerType: 'touch' },
    );
    await expectListOrder(app, 'side-quests', ['3', '1', '2'], ['Quest C', 'Quest A', 'Quest B']);

    await app.dragPointer(
      byTestId('side-quests-reorder-3'),
      byRole('list', 'Side Quests'),
      { pointerType: 'touch', dropPosition: 'bottom' },
    );
    await expectListOrder(app, 'side-quests', ['1', '2', '3'], ['Quest A', 'Quest B', 'Quest C']);

    await app.reload();
    expect(await sideQuestList.text()).toContain('Quest A');
    await expectListOrder(app, 'side-quests', ['1', '2', '3'], ['Quest A', 'Quest B', 'Quest C']);
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
