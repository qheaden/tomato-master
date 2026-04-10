import { expect } from 'chai';
import sinon from 'sinon';
import { TaskManager, TaskStorage } from '../src/taskManager';

function makeStorage(initial: Record<string, string> = {}): TaskStorage {
  const store: Record<string, string> = { ...initial };
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
  };
}

const STORAGE_KEY = 'tomato-master:tasks';

describe('TaskManager - storage persistence', () => {
  let onTasksChanged: sinon.SinonSpy;

  beforeEach(() => {
    onTasksChanged = sinon.spy();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('saving to storage', () => {
    it('should save tasks to storage when a task is added', () => {
      const storage = makeStorage();
      const manager = new TaskManager({ onTasksChanged, storage });
      manager.addTask('Test task');
      const raw = storage.getItem(STORAGE_KEY);
      expect(raw).to.not.be.null;
      const state = JSON.parse(raw!);
      expect(state.tasks).to.have.length(1);
      expect(state.tasks[0].text).to.equal('Test task');
    });

    it('should save activeTaskId to storage', () => {
      const storage = makeStorage();
      const manager = new TaskManager({ onTasksChanged, storage });
      manager.addTask('Task A');
      const t2 = manager.addTask('Task B');
      manager.setActiveTask(t2.id);
      const state = JSON.parse(storage.getItem(STORAGE_KEY)!);
      expect(state.activeTaskId).to.equal(t2.id);
    });

    it('should update storage when a task is completed', () => {
      const storage = makeStorage();
      const manager = new TaskManager({ onTasksChanged, storage });
      const task = manager.addTask('Task A');
      manager.completeTask(task.id);
      const state = JSON.parse(storage.getItem(STORAGE_KEY)!);
      expect(state.tasks[0].completed).to.be.true;
    });

    it('should update storage when a task is deleted', () => {
      const storage = makeStorage();
      const manager = new TaskManager({ onTasksChanged, storage });
      const task = manager.addTask('Task A');
      manager.deleteTask(task.id);
      const state = JSON.parse(storage.getItem(STORAGE_KEY)!);
      expect(state.tasks).to.have.length(0);
    });

    it('should save nextId to storage', () => {
      const storage = makeStorage();
      const manager = new TaskManager({ onTasksChanged, storage });
      manager.addTask('Task 1');
      manager.addTask('Task 2');
      const state = JSON.parse(storage.getItem(STORAGE_KEY)!);
      expect(state.nextId).to.equal(3);
    });
  });

  describe('loading from storage', () => {
    it('should restore tasks from storage on construction', () => {
      const storage = makeStorage();
      const manager1 = new TaskManager({ onTasksChanged, storage });
      manager1.addTask('Persisted Task');

      const manager2 = new TaskManager({ onTasksChanged: sinon.spy(), storage });
      const tasks = manager2.getTasks();
      expect(tasks).to.have.length(1);
      expect(tasks[0].text).to.equal('Persisted Task');
    });

    it('should restore activeTaskId from storage', () => {
      const storage = makeStorage();
      const manager1 = new TaskManager({ onTasksChanged, storage });
      manager1.addTask('Task A');
      const t2 = manager1.addTask('Task B');
      manager1.setActiveTask(t2.id);

      const manager2 = new TaskManager({ onTasksChanged: sinon.spy(), storage });
      expect(manager2.getActiveTask()!.id).to.equal(t2.id);
    });

    it('should resume nextId so IDs do not repeat after reload', () => {
      const storage = makeStorage();
      const manager1 = new TaskManager({ onTasksChanged, storage });
      const t1 = manager1.addTask('Task 1');

      const manager2 = new TaskManager({ onTasksChanged: sinon.spy(), storage });
      const t2 = manager2.addTask('Task 2');
      expect(t2.id).to.not.equal(t1.id);
    });

    it('should start empty when storage has no data', () => {
      const storage = makeStorage();
      const manager = new TaskManager({ onTasksChanged, storage });
      expect(manager.getTasks()).to.have.length(0);
      expect(manager.getActiveTask()).to.be.null;
    });

    it('should handle corrupt storage data gracefully', () => {
      const storage = makeStorage({ [STORAGE_KEY]: 'not valid json{{{' });
      const manager = new TaskManager({ onTasksChanged, storage });
      expect(manager.getTasks()).to.have.length(0);
    });
  });

  describe('no storage provided', () => {
    it('should work normally without storage', () => {
      const manager = new TaskManager({ onTasksChanged });
      manager.addTask('Task A');
      expect(manager.getTasks()).to.have.length(1);
    });
  });
});
