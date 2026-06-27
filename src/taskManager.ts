export interface Task {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
}

export interface TaskStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface TaskManagerConfig {
  onTasksChanged: (tasks: Task[], activeTask: Task | null) => void;
  storage?: TaskStorage;
  storageKey?: string;
}

interface PersistedTaskState {
  tasks: Task[];
  activeTaskId: string | null;
  nextId: number;
}

const STORAGE_KEY = 'tomato-master:tasks';

export class TaskManager {
  private tasks: Task[] = [];
  private activeTaskId: string | null = null;
  private config: TaskManagerConfig;
  private nextId: number = 1;
  private storage: TaskStorage | null;
  private storageKey: string;

  constructor(config: TaskManagerConfig) {
    this.config = config;
    this.storage = config.storage ?? null;
    this.storageKey = config.storageKey ?? STORAGE_KEY;
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    if (!this.storage) return;
    const raw = this.storage.getItem(this.storageKey);
    if (!raw) return;
    try {
      const state: PersistedTaskState = JSON.parse(raw);
      this.tasks = state.tasks ?? [];
      this.activeTaskId = state.activeTaskId ?? null;
      this.nextId = state.nextId ?? this.tasks.length + 1;
    } catch {
      // ignore corrupt data
    }
  }

  private saveToStorage(): void {
    if (!this.storage) return;
    const state: PersistedTaskState = {
      tasks: this.tasks,
      activeTaskId: this.activeTaskId,
      nextId: this.nextId,
    };
    this.storage.setItem(this.storageKey, JSON.stringify(state));
  }

  addTask(text: string): Task {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new Error('Task text cannot be empty');
    }
    const task: Task = {
      id: String(this.nextId++),
      text: trimmed,
      completed: false,
      createdAt: Date.now(),
    };
    this.tasks.push(task);
    // Auto-set as active if no active task
    if (this.activeTaskId === null) {
      this.activeTaskId = task.id;
    }
    this.notify();
    return task;
  }

  completeTask(id: string): void {
    const task = this.tasks.find(t => t.id === id);
    if (!task) throw new Error(`Task ${id} not found`);
    task.completed = true;
    if (this.activeTaskId === id) {
      // Set next incomplete task as active
      const next = this.tasks.find(t => !t.completed && t.id !== id);
      this.activeTaskId = next ? next.id : null;
    }
    this.notify();
  }

  deleteTask(id: string): void {
    const idx = this.tasks.findIndex(t => t.id === id);
    if (idx === -1) throw new Error(`Task ${id} not found`);
    this.tasks.splice(idx, 1);
    if (this.activeTaskId === id) {
      const next = this.tasks.find(t => !t.completed);
      this.activeTaskId = next ? next.id : null;
    }
    this.notify();
  }

  setActiveTask(id: string): void {
    const task = this.tasks.find(t => t.id === id);
    if (!task) throw new Error(`Task ${id} not found`);
    if (task.completed) throw new Error('Cannot set a completed task as active');
    this.activeTaskId = id;
    this.notify();
  }

  getActiveTask(): Task | null {
    if (this.activeTaskId === null) return null;
    return this.tasks.find(t => t.id === this.activeTaskId) ?? null;
  }

  getTasks(): Task[] {
    return [...this.tasks];
  }

  getIncompleteTasks(): Task[] {
    return this.tasks.filter(t => !t.completed);
  }

  moveTaskBefore(taskId: string, beforeTaskId: string): void {
    const taskIndex = this.tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) throw new Error(`Task ${taskId} not found`);

    const beforeIndex = this.tasks.findIndex(t => t.id === beforeTaskId);
    if (beforeIndex === -1) throw new Error(`Task ${beforeTaskId} not found`);

    if (taskId === beforeTaskId) {
      return;
    }

    const [task] = this.tasks.splice(taskIndex, 1);
    const adjustedBeforeIndex = this.tasks.findIndex(t => t.id === beforeTaskId);
    this.tasks.splice(adjustedBeforeIndex, 0, task);
    this.notify();
  }

  moveTaskToEnd(taskId: string): void {
    const taskIndex = this.tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) throw new Error(`Task ${taskId} not found`);

    if (taskIndex === this.tasks.length - 1) {
      return;
    }

    const [task] = this.tasks.splice(taskIndex, 1);
    this.tasks.push(task);
    this.notify();
  }

  private notify(): void {
    this.saveToStorage();
    this.config.onTasksChanged([...this.tasks], this.getActiveTask());
  }
}
