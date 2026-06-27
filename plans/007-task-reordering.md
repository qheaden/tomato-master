# Plan: Reorder Tasks and Side Quests by Drag Handle

## Goal

Add drag-and-drop reordering to both task lists:

- Main `Tasks` list (`#task-list`)
- `Side Quests` list (`#side-quest-list`)

Each task row will include a drag handle on the right side that visually appears as a vertical triple dot. Dragging a task by that handle and dropping it over another task will move the dragged task above the task it was dropped over.

## Current state

- Task data lives in `src/taskManager.ts` as an ordered `tasks: Task[]` array.
- Main tasks and side quests each use a separate `TaskManager` instance in `src/app.ts`.
- Persistence stores the `tasks` array in order in localStorage:
  - Main tasks: `tomato-master:tasks`
  - Side quests: `tomato-master:side-quests`
- The UI renders task rows in `renderTasks()` and `renderSideQuests()`.
- Both render methods currently duplicate most task-row creation logic.

## Implementation steps

### 1. Add task reordering to `TaskManager`

Update `src/taskManager.ts` with public reorder methods such as:

```ts
moveTaskBefore(taskId: string, beforeTaskId: string): void
moveTaskToEnd(taskId: string): void
```

Behavior:

- Throw `Task ${id} not found` if any referenced id does not exist.
- If `taskId === beforeTaskId`, do nothing and do not notify.
- For `moveTaskBefore()`, remove the dragged task from its current index and insert it immediately before `beforeTaskId`.
- For `moveTaskToEnd()`, remove the task from its current index and append it to the end. If it is already last, do nothing and do not notify.
- Preserve all task object data, including `completed`, `createdAt`, and active task status.
- Call `notify()` after a successful reorder so the UI rerenders and storage is updated.

Suggested edge cases:

- Moving the first task before the second task.
- Moving the last task before the first task.
- Moving a task before itself.
- Moving a task before an unknown id.
- Moving an unknown task.
- Moving a task to the end.
- Moving a task to the end when it is already last.
- Moving completed tasks.
- Moving the active task should keep the same active task id.

### 2. Add unit tests

Update `test/unit/taskManager.test.ts` to cover `moveTaskBefore()`.

Add persistence coverage in `test/unit/taskManager.storage.test.ts` confirming reordered task order is saved and restored.

### 3. Add reusable rendering/helper code in `src/app.ts`

Reduce duplication between `renderTasks()` and `renderSideQuests()` by adding a helper that renders a task list with callbacks, for example:

```ts
private renderTaskList(options: {
  tasks: Task[];
  activeTask: Task | null;
  listElement: HTMLElement;
  emptyText: string;
  completeLabelPrefix: string;
  deleteLabelPrefix: string;
  activeTitle: string;
  manager: TaskManager;
}): void
```

The helper should create:

1. Checkbox
2. Task text span
3. Delete button
4. New drag handle button/span

This keeps main tasks and side quests behavior consistent.

### 4. Add drag handle UI

For each non-empty task row, append a handle to the right side after the delete button.

Recommended markup:

```ts
const dragHandle = document.createElement('button');
dragHandle.type = 'button';
dragHandle.className = 'task-drag-handle';
dragHandle.draggable = true;
dragHandle.innerHTML = '<span class="material-icons">more_vert</span>';
dragHandle.setAttribute('aria-label', `Reorder task "${task.text}"`);
dragHandle.title = 'Drag to reorder';
```

Notes:

- The `more_vert` Material Icon gives the requested vertical triple-dot look.
- Only the handle should be draggable, not the whole task row, to avoid interfering with text click-to-activate, checkbox, and delete interactions.
- Use `button` for keyboard focus and accessibility, even if keyboard reordering is not included in the initial scope.

### 5. Implement drag-and-drop behavior

Support both desktop mouse and touch devices. Prefer Pointer Events for a unified implementation rather than relying only on native HTML Drag and Drop, because native drag/drop is inconsistent on touch browsers.

Suggested app-level fields:

```ts
private draggedTaskId: string | null = null;
private draggedTaskListType: 'tasks' | 'side-quests' | null = null;
private draggedTaskElement: HTMLElement | null = null;
private currentDropTargetId: string | null = null;
```

On handle `pointerdown`:

- Ignore non-primary pointers.
- Set `draggedTaskId` and `draggedTaskListType`.
- Store the dragged row element.
- Call `setPointerCapture()` on the handle.
- Add a `dragging` CSS class to the row.
- Prevent default to avoid page scrolling while dragging from the handle.

On document or handle `pointermove` while dragging:

- Use `document.elementFromPoint(event.clientX, event.clientY)` to find the task row under the pointer.
- Only accept rows from the same list type.
- Add a visual `drag-over` class to the current target row.
- If the pointer is over the same dragged row, do not show a target.
- If the pointer is below the final item in the same list or over blank list space beneath the items, mark a list-level `drag-over-bottom` state.

On `pointerup` / `pointercancel`:

- If over a different task row, call:
  - `this.taskManager.moveTaskBefore(draggedId, targetTask.id)` for main tasks.
  - `this.sideQuestManager.moveTaskBefore(draggedId, targetTask.id)` for side quests.
- If dropped into blank space below the list, call a new manager method to move the task to the end, such as `moveTaskToEnd(taskId)`.
- Clear drag state and remove transient CSS classes.

Important behavior:

- Dropping a task over another task places the dragged task above the target task.
- Dropping a task below all items or into blank list space at the bottom moves it to the bottom.
- Cross-list moves between main tasks and side quests should not be allowed.
- All tasks are reorderable, including completed tasks.

### 6. Add styling in `app.css`

Add styles for the new handle and drag feedback.

Suggested classes:

```css
.task-drag-handle {
  background: transparent;
  border: none;
  color: var(--on-surface-variant);
  cursor: grab;
  padding: 4px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.6;
  transition: opacity var(--transition), background var(--transition), color var(--transition);
  flex-shrink: 0;
}

.task-drag-handle:active {
  cursor: grabbing;
}

.task-drag-handle .material-icons {
  font-size: 1.2rem;
}

.task-item:hover .task-drag-handle,
.task-drag-handle:focus-visible {
  opacity: 1;
}

.task-item.dragging {
  opacity: 0.4;
}

.task-item.drag-over {
  border-color: var(--primary);
  box-shadow: inset 0 3px 0 var(--primary);
}

.side-quests-card .task-item.drag-over {
  border-color: var(--sq-primary);
  box-shadow: inset 0 3px 0 var(--sq-primary);
}
```

The drag handle should always be visible. The delete button can remain hover/focus-visible as it is today unless implementation shows the right-side controls feel unbalanced. Ensure spacing remains comfortable on small screens.

### 7. Add E2E tests

Update `test/e2e/tasks.e2e.test.ts` with user-facing behavior coverage.

Test main task reordering:

1. Add tasks `Task A`, `Task B`, `Task C`.
2. Drag `Task C` handle over `Task A` row and drop.
3. Assert list text/order is `Task C`, `Task A`, `Task B`.
4. Drag `Task C` into blank space below the list.
5. Assert order is `Task A`, `Task B`, `Task C`.
6. Reload app.
7. Assert order remains `Task A`, `Task B`, `Task C`.

Test side quest reordering similarly:

1. Add side quests `Quest A`, `Quest B`, `Quest C`.
2. Drag `Quest C` handle over `Quest A` row and drop.
3. Assert order is `Quest C`, `Quest A`, `Quest B`.
4. Drag `Quest C` into blank space below the list.
5. Assert order is `Quest A`, `Quest B`, `Quest C`.
6. Reload and assert persistence.

Add at least one E2E test that uses touch-style pointer events to verify the implementation is not mouse-only.

Implementation notes for tests:

- Prefer stable accessible selectors using handle aria labels like `Reorder task "Task C"` and `Reorder side quest "Quest C"` if separate labels are used.
- Add small test helper code in the e2e helper layer to simulate pointer-based drag gestures with `pointerdown`, `pointermove`, and `pointerup`, including a touch-style pointer where supported by the harness.

### 8. Validation commands

Run:

```bash
npm run test:unit
npm run test:e2e
npm run build
```

## Decisions

1. All tasks are reorderable, including completed tasks.
2. Reordering must support both touch and desktop mouse.
3. Dropping below all items or into blank list space at the bottom should move the task to the bottom.
4. Keyboard-accessible reordering is out of scope for this version.
5. The drag handle should always be visible.

## Open questions

None at this time.
