export interface Task {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
}

export interface TaskManagerConfig {
  onTasksChanged: (tasks: Task[], activeTask: Task | null) => void;
}

export class TaskManager {
  private tasks: Task[] = [];
  private activeTaskId: string | null = null;
  private config: TaskManagerConfig;
  private nextId: number = 1;

  constructor(config: TaskManagerConfig) {
    this.config = config;
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

  private notify(): void {
    this.config.onTasksChanged([...this.tasks], this.getActiveTask());
  }
}
