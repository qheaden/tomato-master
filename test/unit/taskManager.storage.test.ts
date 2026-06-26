import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskManager, TaskStorage } from '../../src/taskManager';

function makeStorage(initial: Record<string, string> = {}): TaskStorage {
  const store: Record<string, string> = { ...initial };
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
  };
}

const STORAGE_KEY = 'tomato-master:tasks';

describe('TaskManager - storage persistence', () => {
  let onTasksChanged: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onTasksChanged = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('saving to storage', () => {
    it('should save tasks to storage when a task is added', () => {
      const storage = makeStorage();
      const manager = new TaskManager({ onTasksChanged, storage });
      manager.addTask('Test task');
      const raw = storage.getItem(STORAGE_KEY);
      expect(raw).not.toBeNull();
      const state = JSON.parse(raw!);
      expect(state.tasks).toHaveLength(1);
      expect(state.tasks[0].text).toBe('Test task');
    });

    it('should save activeTaskId to storage', () => {
      const storage = makeStorage();
      const manager = new TaskManager({ onTasksChanged, storage });
      manager.addTask('Task A');
      const t2 = manager.addTask('Task B');
      manager.setActiveTask(t2.id);
      const state = JSON.parse(storage.getItem(STORAGE_KEY)!);
      expect(state.activeTaskId).toBe(t2.id);
    });

    it('should update storage when a task is completed', () => {
      const storage = makeStorage();
      const manager = new TaskManager({ onTasksChanged, storage });
      const task = manager.addTask('Task A');
      manager.completeTask(task.id);
      const state = JSON.parse(storage.getItem(STORAGE_KEY)!);
      expect(state.tasks[0].completed).toBe(true);
    });

    it('should update storage when a task is deleted', () => {
      const storage = makeStorage();
      const manager = new TaskManager({ onTasksChanged, storage });
      const task = manager.addTask('Task A');
      manager.deleteTask(task.id);
      const state = JSON.parse(storage.getItem(STORAGE_KEY)!);
      expect(state.tasks).toHaveLength(0);
    });

    it('should save nextId to storage', () => {
      const storage = makeStorage();
      const manager = new TaskManager({ onTasksChanged, storage });
      manager.addTask('Task 1');
      manager.addTask('Task 2');
      const state = JSON.parse(storage.getItem(STORAGE_KEY)!);
      expect(state.nextId).toBe(3);
    });
  });

  describe('loading from storage', () => {
    it('should restore tasks from storage on construction', () => {
      const storage = makeStorage();
      const manager1 = new TaskManager({ onTasksChanged, storage });
      manager1.addTask('Persisted Task');

      const manager2 = new TaskManager({ onTasksChanged: vi.fn(), storage });
      const tasks = manager2.getTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].text).toBe('Persisted Task');
    });

    it('should restore activeTaskId from storage', () => {
      const storage = makeStorage();
      const manager1 = new TaskManager({ onTasksChanged, storage });
      manager1.addTask('Task A');
      const t2 = manager1.addTask('Task B');
      manager1.setActiveTask(t2.id);

      const manager2 = new TaskManager({ onTasksChanged: vi.fn(), storage });
      expect(manager2.getActiveTask()!.id).toBe(t2.id);
    });

    it('should resume nextId so IDs do not repeat after reload', () => {
      const storage = makeStorage();
      const manager1 = new TaskManager({ onTasksChanged, storage });
      const t1 = manager1.addTask('Task 1');

      const manager2 = new TaskManager({ onTasksChanged: vi.fn(), storage });
      const t2 = manager2.addTask('Task 2');
      expect(t2.id).not.toBe(t1.id);
    });

    it('should start empty when storage has no data', () => {
      const storage = makeStorage();
      const manager = new TaskManager({ onTasksChanged, storage });
      expect(manager.getTasks()).toHaveLength(0);
      expect(manager.getActiveTask()).toBeNull();
    });

    it('should handle corrupt storage data gracefully', () => {
      const storage = makeStorage({ [STORAGE_KEY]: 'not valid json{{{' });
      const manager = new TaskManager({ onTasksChanged, storage });
      expect(manager.getTasks()).toHaveLength(0);
    });
  });

  describe('no storage provided', () => {
    it('should work normally without storage', () => {
      const manager = new TaskManager({ onTasksChanged });
      manager.addTask('Task A');
      expect(manager.getTasks()).toHaveLength(1);
    });
  });

  describe('custom storageKey', () => {
    it('should write to the custom key instead of the default key', () => {
      const storage = makeStorage();
      const manager = new TaskManager({ onTasksChanged, storage, storageKey: 'custom:key' });
      manager.addTask('Side quest');
      expect(storage.getItem('custom:key')).not.toBeNull();
      expect(storage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('should load from the custom key on construction', () => {
      const storage = makeStorage();
      const m1 = new TaskManager({ onTasksChanged, storage, storageKey: 'custom:key' });
      m1.addTask('Persisted side quest');

      const m2 = new TaskManager({ onTasksChanged: vi.fn(), storage, storageKey: 'custom:key' });
      const tasks = m2.getTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].text).toBe('Persisted side quest');
    });

    it('should keep two managers with different keys isolated', () => {
      const storage = makeStorage();
      const m1 = new TaskManager({ onTasksChanged, storage, storageKey: 'ns:tasks' });
      const m2 = new TaskManager({ onTasksChanged: vi.fn(), storage, storageKey: 'ns:side-quests' });
      m1.addTask('Work task');
      m2.addTask('Side quest');

      const reloaded1 = new TaskManager({ onTasksChanged: vi.fn(), storage, storageKey: 'ns:tasks' });
      const reloaded2 = new TaskManager({ onTasksChanged: vi.fn(), storage, storageKey: 'ns:side-quests' });
      expect(reloaded1.getTasks().map((t) => t.text)).toEqual(['Work task']);
      expect(reloaded2.getTasks().map((t) => t.text)).toEqual(['Side quest']);
    });
  });
});
