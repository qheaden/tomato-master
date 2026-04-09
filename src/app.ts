import { PomodoroTimer, TimerType, TimerState } from './timer';
import { TaskManager, Task } from './taskManager';
import { NoteManager, Note } from './noteManager';

class TomatoMasterApp {
  private timer: PomodoroTimer;
  private taskManager: TaskManager;
  private noteManager: NoteManager;
  private _timerCancelledByUser = false;

  // Timer UI elements
  private timerDisplay!: HTMLElement;
  private timerLabel!: HTMLElement;
  private startWorkBtn!: HTMLButtonElement;
  private startShortBreakBtn!: HTMLButtonElement;
  private startLongBreakBtn!: HTMLButtonElement;
  private pauseResumeBtn!: HTMLButtonElement;
  private cancelBtn!: HTMLButtonElement;
  private timerRing!: SVGCircleElement;

  // Task UI elements
  private taskInput!: HTMLInputElement;
  private addTaskBtn!: HTMLButtonElement;
  private taskList!: HTMLElement;
  private activeTaskDisplay!: HTMLElement;

  // Note UI elements
  private noteModal!: HTMLElement;
  private noteTextarea!: HTMLTextAreaElement;
  private noteSaveBtn!: HTMLButtonElement;
  private noteSkipBtn!: HTMLButtonElement;
  private noteContext!: HTMLElement;
  private noteContextText!: HTMLElement;

  // Ring animation constants
  private readonly RING_CIRCUMFERENCE = 2 * Math.PI * 120;

  constructor() {
    this.timer = new PomodoroTimer({
      onTick: (remaining) => this.onTick(remaining),
      onComplete: (type) => this.onTimerComplete(type),
      onStateChange: (state, type) => this.onStateChange(state, type),
    });

    this.taskManager = new TaskManager({
      onTasksChanged: (tasks, active) => this.renderTasks(tasks, active),
    });

    this.noteManager = new NoteManager({
      onNoteSet: (note) => this.renderNote(note),
      onNoteRequested: () => { /* handled directly via showNoteModal */ },
    });
  }

  init(): void {
    this.bindElements();
    this.bindEvents();
    this.resetTimerDisplay();
  }

  private bindElements(): void {
    this.timerDisplay = document.getElementById('timer-display')!;
    this.timerLabel = document.getElementById('timer-label')!;
    this.startWorkBtn = document.getElementById('btn-work') as HTMLButtonElement;
    this.startShortBreakBtn = document.getElementById('btn-short-break') as HTMLButtonElement;
    this.startLongBreakBtn = document.getElementById('btn-long-break') as HTMLButtonElement;
    this.pauseResumeBtn = document.getElementById('btn-pause-resume') as HTMLButtonElement;
    this.cancelBtn = document.getElementById('btn-cancel') as HTMLButtonElement;
    this.timerRing = document.getElementById('timer-ring') as unknown as SVGCircleElement;

    this.taskInput = document.getElementById('task-input') as HTMLInputElement;
    this.addTaskBtn = document.getElementById('btn-add-task') as HTMLButtonElement;
    this.taskList = document.getElementById('task-list')!;
    this.activeTaskDisplay = document.getElementById('active-task-display')!;

    this.noteModal = document.getElementById('note-modal')!;
    this.noteTextarea = document.getElementById('note-textarea') as HTMLTextAreaElement;
    this.noteSaveBtn = document.getElementById('btn-note-save') as HTMLButtonElement;
    this.noteSkipBtn = document.getElementById('btn-note-skip') as HTMLButtonElement;
    this.noteContext = document.getElementById('note-context')!;
    this.noteContextText = document.getElementById('note-context-text')!;
  }

  private bindEvents(): void {
    this.startWorkBtn.addEventListener('click', () => this.startTimer('work'));
    this.startShortBreakBtn.addEventListener('click', () => this.startTimer('short-break'));
    this.startLongBreakBtn.addEventListener('click', () => this.startTimer('long-break'));
    this.pauseResumeBtn.addEventListener('click', () => this.togglePause());
    this.cancelBtn.addEventListener('click', () => this.cancelTimer());

    this.addTaskBtn.addEventListener('click', () => this.addTask());
    this.taskInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.addTask();
    });

    this.noteSaveBtn.addEventListener('click', () => this.saveNote());
    this.noteSkipBtn.addEventListener('click', () => this.skipNote());
    this.noteTextarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.saveNote();
      }
    });
  }

  private startTimer(type: TimerType): void {
    if (type === 'work') {
      // Clear the context note when starting a new work session
      // (it was already shown, user acknowledged)
    }
    this.timer.start(type);
    this.updateTimerButtons(type);
  }

  private togglePause(): void {
    const state = this.timer.getState();
    if (state === 'running') {
      this.timer.pause();
    } else if (state === 'paused') {
      this.timer.resume();
    }
  }

  private cancelTimer(): void {
    this._timerCancelledByUser = true;
    this.timer.cancel();
  }

  private addTask(): void {
    const text = this.taskInput.value.trim();
    if (!text) return;
    try {
      this.taskManager.addTask(text);
      this.taskInput.value = '';
      this.taskInput.focus();
    } catch (e) {
      console.error(e);
    }
  }

  private saveNote(): void {
    const text = this.noteTextarea.value;
    this.noteManager.saveNote(text);
    this.hideNoteModal();
  }

  private skipNote(): void {
    this.noteManager.saveNote('');
    this.hideNoteModal();
  }

  private onTick(remaining: number): void {
    this.timerDisplay.textContent = this.timer.formatTime(remaining);
    this.updateRingProgress(remaining);
  }

  private onTimerComplete(type: TimerType): void {
    if (type === 'work') {
      const cancelled = this._timerCancelledByUser;
      this._timerCancelledByUser = false;
      const title = cancelled ? 'Session Cancelled' : 'Work Session Complete!';
      this.showNoteModal(title);
    }
  }

  private onStateChange(state: TimerState, type: TimerType | null): void {
    const isActive = state !== 'idle';

    this.pauseResumeBtn.style.display = isActive ? 'inline-flex' : 'none';
    this.cancelBtn.style.display = isActive ? 'inline-flex' : 'none';

    if (state === 'running') {
      const icon = this.pauseResumeBtn.querySelector('.material-icons');
      if (icon) icon.textContent = 'pause';
      this.pauseResumeBtn.setAttribute('aria-label', 'Pause timer');
      document.getElementById('timer-card')?.classList.add('timer-running');
      document.getElementById('timer-card')?.classList.remove('timer-paused');
    } else if (state === 'paused') {
      const icon = this.pauseResumeBtn.querySelector('.material-icons');
      if (icon) icon.textContent = 'play_arrow';
      this.pauseResumeBtn.setAttribute('aria-label', 'Resume timer');
      document.getElementById('timer-card')?.classList.remove('timer-running');
      document.getElementById('timer-card')?.classList.add('timer-paused');
    } else {
      document.getElementById('timer-card')?.classList.remove('timer-running', 'timer-paused');
      this.resetTimerDisplay();
    }

    if (type) {
      const labels: Record<TimerType, string> = {
        'work': 'Work Session',
        'short-break': 'Short Break',
        'long-break': 'Long Break',
      };
      this.timerLabel.textContent = labels[type];
      document.body.dataset.timerType = type;
    } else {
      this.timerLabel.textContent = 'Ready';
      delete document.body.dataset.timerType;
    }

    this.updateTimerButtons(type);
  }

  private updateTimerButtons(activeType: TimerType | null): void {
    const state = this.timer.getState();
    const isRunning = state === 'running' || state === 'paused';

    [this.startWorkBtn, this.startShortBreakBtn, this.startLongBreakBtn].forEach(btn => {
      btn.disabled = isRunning;
    });

    if (activeType) {
      const map: Record<TimerType, HTMLButtonElement> = {
        'work': this.startWorkBtn,
        'short-break': this.startShortBreakBtn,
        'long-break': this.startLongBreakBtn,
      };
      map[activeType].classList.add('active');
      Object.entries(map).forEach(([t, btn]) => {
        if (t !== activeType) btn.classList.remove('active');
      });
    } else {
      [this.startWorkBtn, this.startShortBreakBtn, this.startLongBreakBtn].forEach(b =>
        b.classList.remove('active')
      );
    }
  }

  private resetTimerDisplay(): void {
    this.timerDisplay.textContent = '25:00';
    this.timerLabel.textContent = 'Ready';
    if (this.timerRing) {
      this.timerRing.style.strokeDashoffset = '0';
    }
    this.pauseResumeBtn.style.display = 'none';
    this.cancelBtn.style.display = 'none';
  }

  private updateRingProgress(remaining: number): void {
    const type = this.timer.getCurrentType();
    if (!type || !this.timerRing) return;
    const total = 25 * 60; // use work duration as reference for visual consistency
    const elapsed = total - remaining;
    const progress = Math.min(elapsed / total, 1);
    const offset = this.RING_CIRCUMFERENCE * progress;
    this.timerRing.style.strokeDashoffset = String(offset);
  }

  private renderTasks(tasks: Task[], activeTask: Task | null): void {
    this.taskList.innerHTML = '';

    if (tasks.length === 0) {
      this.taskList.innerHTML = '<li class="task-empty">No tasks yet. Add one above!</li>';
    } else {
      tasks.forEach(task => {
        const li = document.createElement('li');
        li.className = `task-item${task.completed ? ' completed' : ''}${task.id === activeTask?.id ? ' active-task' : ''}`;
        li.dataset.id = task.id;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = task.completed;
        checkbox.className = 'task-checkbox';
        checkbox.setAttribute('aria-label', `Mark "${task.text}" as complete`);
        if (!task.completed) {
          checkbox.addEventListener('change', () => this.taskManager.completeTask(task.id));
        }

        const span = document.createElement('span');
        span.className = 'task-text';
        span.textContent = task.text;
        if (!task.completed) {
          span.addEventListener('click', () => this.taskManager.setActiveTask(task.id));
          span.title = 'Click to set as active task';
        }

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'task-delete-btn';
        deleteBtn.innerHTML = '<span class="material-icons">delete</span>';
        deleteBtn.setAttribute('aria-label', `Delete task "${task.text}"`);
        deleteBtn.addEventListener('click', () => this.taskManager.deleteTask(task.id));

        li.appendChild(checkbox);
        li.appendChild(span);
        li.appendChild(deleteBtn);
        this.taskList.appendChild(li);
      });
    }

    // Update active task display
    if (activeTask) {
      this.activeTaskDisplay.textContent = activeTask.text;
      this.activeTaskDisplay.parentElement?.parentElement?.classList.remove('hidden');
    } else {
      this.activeTaskDisplay.textContent = '';
      this.activeTaskDisplay.parentElement?.parentElement?.classList.add('hidden');
    }
  }

  private showNoteModal(title?: string): void {
    const modalTitle = document.getElementById('modal-title');
    if (modalTitle) {
      modalTitle.textContent = title ?? 'Work Session Complete!';
    }
    this.noteTextarea.value = '';
    this.noteModal.classList.add('visible');
    setTimeout(() => this.noteTextarea.focus(), 100);
  }

  private hideNoteModal(): void {
    this.noteModal.classList.remove('visible');
  }

  private renderNote(note: Note | null): void {
    if (note && note.text) {
      this.noteContextText.textContent = note.text;
      this.noteContext.classList.remove('hidden');
    } else {
      this.noteContext.classList.add('hidden');
      this.noteContextText.textContent = '';
    }
  }
}

// Boot the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new TomatoMasterApp();
  app.init();
});
