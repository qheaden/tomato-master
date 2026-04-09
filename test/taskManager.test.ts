import { expect } from 'chai';
import sinon from 'sinon';
import { TaskManager, Task } from '../src/taskManager';

describe('TaskManager', () => {
  let onTasksChanged: sinon.SinonSpy;
  let manager: TaskManager;

  beforeEach(() => {
    onTasksChanged = sinon.spy();
    manager = new TaskManager({ onTasksChanged });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('addTask()', () => {
    it('should add a task and return it', () => {
      const task = manager.addTask('Write tests');
      expect(task.text).to.equal('Write tests');
      expect(task.completed).to.be.false;
      expect(task.id).to.be.a('string');
    });

    it('should call onTasksChanged after adding', () => {
      manager.addTask('Task A');
      expect(onTasksChanged.calledOnce).to.be.true;
    });

    it('should trim whitespace from task text', () => {
      const task = manager.addTask('  Hello World  ');
      expect(task.text).to.equal('Hello World');
    });

    it('should throw on empty task text', () => {
      expect(() => manager.addTask('')).to.throw('Task text cannot be empty');
    });

    it('should throw on whitespace-only text', () => {
      expect(() => manager.addTask('   ')).to.throw('Task text cannot be empty');
    });

    it('should auto-set first task as active', () => {
      manager.addTask('Task A');
      const active = manager.getActiveTask();
      expect(active).to.not.be.null;
      expect(active!.text).to.equal('Task A');
    });

    it('should not change active task when adding subsequent tasks', () => {
      manager.addTask('Task A');
      manager.addTask('Task B');
      const active = manager.getActiveTask();
      expect(active!.text).to.equal('Task A');
    });

    it('should assign unique IDs to each task', () => {
      const t1 = manager.addTask('Task 1');
      const t2 = manager.addTask('Task 2');
      expect(t1.id).to.not.equal(t2.id);
    });

    it('should include createdAt timestamp', () => {
      const before = Date.now();
      const task = manager.addTask('Task');
      const after = Date.now();
      expect(task.createdAt).to.be.at.least(before);
      expect(task.createdAt).to.be.at.most(after);
    });
  });

  describe('completeTask()', () => {
    it('should mark a task as completed', () => {
      const task = manager.addTask('Task A');
      manager.completeTask(task.id);
      const tasks = manager.getTasks();
      expect(tasks[0].completed).to.be.true;
    });

    it('should call onTasksChanged after completing', () => {
      const task = manager.addTask('Task A');
      onTasksChanged.resetHistory();
      manager.completeTask(task.id);
      expect(onTasksChanged.calledOnce).to.be.true;
    });

    it('should set next incomplete task as active when active task is completed', () => {
      const t1 = manager.addTask('Task A');
      manager.addTask('Task B');
      manager.completeTask(t1.id);
      const active = manager.getActiveTask();
      expect(active!.text).to.equal('Task B');
    });

    it('should set active to null when last task is completed', () => {
      const t1 = manager.addTask('Task A');
      manager.completeTask(t1.id);
      expect(manager.getActiveTask()).to.be.null;
    });

    it('should throw on unknown task id', () => {
      expect(() => manager.completeTask('999')).to.throw('Task 999 not found');
    });

    it('should not change active task when completing a non-active task', () => {
      const t1 = manager.addTask('Task A');
      const t2 = manager.addTask('Task B');
      manager.completeTask(t2.id);
      expect(manager.getActiveTask()!.id).to.equal(t1.id);
    });
  });

  describe('deleteTask()', () => {
    it('should remove the task from the list', () => {
      const task = manager.addTask('Task A');
      manager.deleteTask(task.id);
      expect(manager.getTasks()).to.have.length(0);
    });

    it('should call onTasksChanged after deleting', () => {
      const task = manager.addTask('Task A');
      onTasksChanged.resetHistory();
      manager.deleteTask(task.id);
      expect(onTasksChanged.calledOnce).to.be.true;
    });

    it('should throw on unknown task id', () => {
      expect(() => manager.deleteTask('not-a-real-id')).to.throw();
    });

    it('should set next active task when active is deleted', () => {
      const t1 = manager.addTask('Task A');
      const t2 = manager.addTask('Task B');
      manager.deleteTask(t1.id);
      expect(manager.getActiveTask()!.id).to.equal(t2.id);
    });

    it('should set active to null when only task is deleted', () => {
      const t1 = manager.addTask('Only Task');
      manager.deleteTask(t1.id);
      expect(manager.getActiveTask()).to.be.null;
    });
  });

  describe('setActiveTask()', () => {
    it('should set the specified task as active', () => {
      manager.addTask('Task A');
      const t2 = manager.addTask('Task B');
      manager.setActiveTask(t2.id);
      expect(manager.getActiveTask()!.id).to.equal(t2.id);
    });

    it('should call onTasksChanged', () => {
      manager.addTask('Task A');
      const t2 = manager.addTask('Task B');
      onTasksChanged.resetHistory();
      manager.setActiveTask(t2.id);
      expect(onTasksChanged.calledOnce).to.be.true;
    });

    it('should throw on unknown id', () => {
      expect(() => manager.setActiveTask('unknown')).to.throw();
    });

    it('should throw when setting a completed task as active', () => {
      const task = manager.addTask('Task A');
      manager.completeTask(task.id);
      expect(() => manager.setActiveTask(task.id)).to.throw('Cannot set a completed task as active');
    });
  });

  describe('getTasks()', () => {
    it('should return empty array initially', () => {
      expect(manager.getTasks()).to.have.length(0);
    });

    it('should return a copy of the tasks array', () => {
      manager.addTask('Task A');
      const tasks = manager.getTasks();
      tasks.push({ id: 'fake', text: 'fake', completed: false, createdAt: 0 });
      expect(manager.getTasks()).to.have.length(1);
    });

    it('should return all tasks including completed', () => {
      const t1 = manager.addTask('Task A');
      manager.addTask('Task B');
      manager.completeTask(t1.id);
      expect(manager.getTasks()).to.have.length(2);
    });
  });

  describe('getIncompleteTasks()', () => {
    it('should return only incomplete tasks', () => {
      const t1 = manager.addTask('Task A');
      manager.addTask('Task B');
      manager.completeTask(t1.id);
      const incomplete = manager.getIncompleteTasks();
      expect(incomplete).to.have.length(1);
      expect(incomplete[0].text).to.equal('Task B');
    });

    it('should return empty array when all tasks complete', () => {
      const t1 = manager.addTask('Task A');
      manager.completeTask(t1.id);
      expect(manager.getIncompleteTasks()).to.have.length(0);
    });
  });

  describe('onTasksChanged callback', () => {
    it('should pass tasks and active task to callback', () => {
      manager.addTask('Task A');
      const [tasks, active] = onTasksChanged.firstCall.args as [Task[], Task | null];
      expect(tasks).to.have.length(1);
      expect(active).to.not.be.null;
      expect(active!.text).to.equal('Task A');
    });

    it('should pass null active task when no tasks exist after delete', () => {
      const t = manager.addTask('Only Task');
      onTasksChanged.resetHistory();
      manager.deleteTask(t.id);
      const [, active] = onTasksChanged.firstCall.args as [Task[], Task | null];
      expect(active).to.be.null;
    });
  });
});
