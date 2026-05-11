import { PomodoroTimer, TimerType, TimerState } from './timer';
import { TaskManager, Task } from './taskManager';
import { NoteManager, Note } from './noteManager';
import { NotificationService } from './notificationService';

// Declare YouTube API types to avoid TypeScript errors
declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
  }
}

class TomatoMasterApp {
  private timer: PomodoroTimer;
  private taskManager: TaskManager;
  private sideQuestManager: TaskManager;
  private noteManager: NoteManager;
  private notificationService: NotificationService;
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

  // Side Quest UI elements
  private sideQuestInput!: HTMLInputElement;
  private addSideQuestBtn!: HTMLButtonElement;
  private sideQuestList!: HTMLElement;
  private activeSideQuestDisplay!: HTMLElement;
  private sideQuestCard!: HTMLElement;

  // Note UI elements
  private noteModal!: HTMLElement;
  private noteTextarea!: HTMLTextAreaElement;
  private noteSaveBtn!: HTMLButtonElement;
  private noteSkipBtn!: HTMLButtonElement;
  private noteContext!: HTMLElement;
  private noteContextText!: HTMLElement;

  // YouTube UI elements
  private youtubeCard!: HTMLElement;
  private youtubeUrlInput!: HTMLInputElement;
  private loadPlaylistBtn!: HTMLButtonElement;
  private youtubeApiReady = false;
  private pendingYouTubePlaylistUrl: string | null = null;
  private player!: any;

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
      storage: localStorage,
    });

    this.sideQuestManager = new TaskManager({
      onTasksChanged: (tasks, active) => this.renderSideQuests(tasks, active),
      storage: localStorage,
      storageKey: 'tomato-master:side-quests',
    });

    this.noteManager = new NoteManager({
      onNoteSet: (note) => this.renderNote(note),
      onNoteRequested: () => { /* handled directly via showNoteModal */ },
      storage: localStorage,
    });

    this.notificationService = new NotificationService();
  }

  init(): void {
    this.bindElements();
    this.bindEvents();
    this.resetTimerDisplay();
    this.notificationService.requestPermission();
    this.renderTasks(this.taskManager.getTasks(), this.taskManager.getActiveTask());
    this.renderSideQuests(this.sideQuestManager.getTasks(), this.sideQuestManager.getActiveTask());
    this.renderNote(this.noteManager.getCurrentNote());

    this.initYouTube();
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

    this.sideQuestInput = document.getElementById('side-quest-input') as HTMLInputElement;
    this.addSideQuestBtn = document.getElementById('btn-add-side-quest') as HTMLButtonElement;
    this.sideQuestList = document.getElementById('side-quest-list')!;
    this.activeSideQuestDisplay = document.getElementById('active-side-quest-display')!;
    this.sideQuestCard = document.getElementById('side-quest-card')!;

    this.noteModal = document.getElementById('note-modal')!;
    this.noteTextarea = document.getElementById('note-textarea') as HTMLTextAreaElement;
    this.noteSaveBtn = document.getElementById('btn-note-save') as HTMLButtonElement;
    this.noteSkipBtn = document.getElementById('btn-note-skip') as HTMLButtonElement;
    this.noteContext = document.getElementById('note-context')!;
    this.noteContextText = document.getElementById('note-context-text')!;

    this.youtubeCard = document.getElementById('youtube-card')!;
    this.youtubeUrlInput = document.getElementById('youtube-url-input') as HTMLInputElement;
    this.loadPlaylistBtn = document.getElementById('btn-load-playlist') as HTMLButtonElement;
    this.youtubePlayerContainer = document.getElementById('youtube-player-container')!;
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

    this.addSideQuestBtn.addEventListener('click', () => this.addSideQuest());
    this.sideQuestInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.addSideQuest();
    });

    this.noteSaveBtn.addEventListener('click', () => this.saveNote());
    this.noteSkipBtn.addEventListener('click', () => this.skipNote());
    this.noteTextarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.saveNote();
      }
    });

    this.loadPlaylistBtn.addEventListener('click', () => {
      const icon = this.loadPlaylistBtn.querySelector('.material-icons')!;
      if (icon.textContent === 'close') {
        this.clearPlaylist();
      } else {
        this.handlePlaylistUrlSubmit();
      }
    });

    document.getElementById('btn-test-notifications')?.addEventListener('click', () => {
      this.notificationService.playAlarm();
      this.notificationService.notify('Work Session Complete!', 'Great work! Time for a break.');
    });

    // Setup global YouTube callback
    (window as any).onYouTubeIframeAPIReady = () => {
      this.onYouTubeIframeAPIReady();
    };
  }

  private initYouTube(): void {
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    const savedUrl = localStorage.getItem('youtube-playlist-url');
    if (savedUrl) {
      this.youtubeUrlInput.value = savedUrl;
      this.updatePlaylistButton(true);
      this.handlePlaylistUrlSubmit(savedUrl);
    }
  }

  private onYouTubeIframeAPIReady(): void {
    this.youtubeApiReady = true;
    if (this.pendingYouTubePlaylistUrl) {
      const pendingUrl = this.pendingYouTubePlaylistUrl;
      this.pendingYouTubePlaylistUrl = null;
      this.handlePlaylistUrlSubmit(pendingUrl);
    }
  }

  private handlePlaylistUrlSubmit(url?: string): void {
    const inputUrl = url || this.youtubeUrlInput.value.trim();
    if (!inputUrl) return;

    const playlistId = this.extractPlaylistId(inputUrl);
    if (!playlistId) {
      alert('Invalid YouTube playlist URL. Please provide a link to a playlist or a video with a list parameter.');
      return;
    }

    this.youtubeCard.classList.remove('hidden');
    this.youtubePlayerContainer.classList.remove('hidden');
    localStorage.setItem('youtube-playlist-url', inputUrl);
    this.updatePlaylistButton(true);

    if (!this.youtubeApiReady || !window.YT || typeof window.YT.Player !== 'function') {
      this.pendingYouTubePlaylistUrl = inputUrl;
      return;
    }

    if (!this.player) {
      this.player = new window.YT.Player('youtube-player-container', {
        height: '100%',
        width: '100%',
        playerVars: {
          listType: 'playlist',
          list: playlistId,
          playsinline: 1,
        },
        events: {
          onReady: (event: any) => this.onYouTubePlayerReady(event),
          onStateChange: (event: any) => this.onYouTubeStateChange(event),
        },
      });
    } else {
      this.player.setSize('100%', '100%');
      this.player.loadPlaylist({
        listType: 'playlist',
        list: playlistId,
      });
    }
  }

  private onYouTubePlayerReady(event: any): void {
    if (event?.target?.setSize) {
      event.target.setSize('100%', '100%');
    }
  }

  private extractPlaylistId(url: string): string | null {
    try {
      const urlObj = new URL(url);
      if (urlObj.searchParams.has('list')) {
        return urlObj.searchParams.get('list');
      }
      return null;
    } catch {
      return null;
    }
  }

  private updatePlaylistButton(loaded: boolean): void {
    const icon = this.loadPlaylistBtn.querySelector('.material-icons')!;
    if (loaded) {
      icon.textContent = 'close';
      this.loadPlaylistBtn.setAttribute('aria-label', 'Remove playlist');
    } else {
      icon.textContent = 'playlist_add';
      this.loadPlaylistBtn.setAttribute('aria-label', 'Load playlist');
    }
  }

  private clearPlaylist(): void {
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }
    const container = document.getElementById('youtube-player-container') as HTMLElement;
    container.innerHTML = '';

    this.youtubePlayerContainer.classList.add('hidden');

    localStorage.removeItem('youtube-playlist-url');
    this.youtubeUrlInput.value = '';

    this.updatePlaylistButton(false);
  }

  private onYouTubeStateChange(event: any): void {
    const timerType = this.timer.getCurrentType();
    const state = event.data;

    // YT.PlayerState
    const PLAYER_STATE = {
      BUFFERING: 3,
      PLAYING: 1,
      PAUSED: 2,
      ENDED: 0,
    };

    if (timerType === 'work' && state === PLAYER_STATE.PLAYING) {
      // Player is playing during work session - this is fine
    } else if (timerType !== 'work' || state === PLAYER_STATE.PAUSED || state === PLAYER_STATE.ENDED) {
      // If not work session, or paused/ended, ensure it's paused
      // Note: We don't want to fight the user if they manually pause, 
      // but the requirement says: "When the timer is paused, stopped, or a break timer is running, the player will stop."
      // Actually, "the player will stop" usually means pause or stop.
      if (this.player && typeof this.player.pauseVideo === 'function') {
        this.player.pauseVideo();
      }
    }
  }

  // This needs to be called from onStateChange in the timer
  // Wait, the requirement says: 
  // "In onStateChange, if the state is running and the timer type is work, call player.playVideo()."
  // "If the state is paused, idle, or the type is not work, call player.pauseVideo()."

  // I'll modify the existing onStateChange to handle this.
  // But I need to ensure it's called.

  private startTimer(type: TimerType): void {
    if (type === 'work') {
      // Clear the context note when starting a new work session
      // (it was already shown, user acknowledged)
    }
    this.timer.start(type);
    this.updateTimerButtons(type);

    // Sync YouTube
    this.syncYouTubeWithTimer(type, 'running');
  }

  private togglePause(): void {
    const state = this.timer.getState();
    if (state === 'running') {
      this.timer.pause();
      this.syncYouTubeWithTimer(this.timer.getCurrentType()!, 'paused');
    } else if (state === 'paused') {
      this.timer.resume();
      this.syncYouTubeWithTimer(this.timer.getCurrentType()!, 'running');
    }
  }

  private cancelTimer(): void {
    this._timerCancelledByUser = true;
    this.timer.cancel();
    this.syncYouTubeWithTimer(this.timer.getCurrentType()!, 'idle');
  }

  private syncYouTubeWithTimer(type: TimerType, timerState: string): void {
    if (!this.player || typeof this.player.playVideo !== 'function' || typeof this.player.pauseVideo !== 'function') {
      return;
    }

    if (type === 'work' && timerState === 'running') {
      this.player.playVideo();
    } else {
      this.player.pauseVideo();
    }
  }

  private onTimerComplete(type: TimerType): void {
    const cancelled = this._timerCancelledByUser;
    this._timerCancelledByUser = false;

    // Sync YouTube before notification/modal
    this.syncYouTubeWithTimer(type, 'idle');

    if (!cancelled) {
      this.notificationService.playAlarm();
      const notifyMessages: Record<TimerType, { title: string; body: string }> = {
        'work': { title: 'Work Session Complete!', body: 'Great work! Time for a break.' },
        'short-break': { title: 'Break Complete!', body: 'Ready to get back to work?' },
        'long-break': { title: 'Long Break Complete!', body: 'Ready to get back to work?' },
      };
      const { title, body } = notifyMessages[type];
      this.notificationService.notify(title, body);
    }

    if (type === 'work') {
      const title = cancelled ? 'Session Cancelled' : 'Work Session Complete!';
      this.showNoteModal(title);
    }
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

  private addSideQuest(): void {
    const text = this.sideQuestInput.value.trim();
    if (!text) return;
    try {
      this.sideQuestManager.addTask(text);
      this.sideQuestInput.value = '';
      this.sideQuestInput.focus();
    } catch (e) {
      console.error(e);
    }
  }

  private renderSideQuests(tasks: Task[], activeTask: Task | null): void {
    this.sideQuestList.innerHTML = '';

    if (tasks.length === 0) {
      this.sideQuestList.innerHTML = '<li class="task-empty">No side quests yet. Add one above!</li>';
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
          checkbox.addEventListener('change', () => this.sideQuestManager.completeTask(task.id));
        }

        const span = document.createElement('span');
        span.className = 'task-text';
        span.textContent = task.text;
        if (!task.completed) {
          span.addEventListener('click', () => this.sideQuestManager.setActiveTask(task.id));
          span.title = 'Click to set as active side quest';
        }

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'task-delete-btn';
        deleteBtn.innerHTML = '<span class="material-icons">delete</span>';
        deleteBtn.setAttribute('aria-label', `Delete side quest "${task.text}"`);
        deleteBtn.addEventListener('click', () => this.sideQuestManager.deleteTask(task.id));

        li.appendChild(checkbox);
        li.appendChild(span);
        li.appendChild(deleteBtn);
        this.sideQuestList.appendChild(li);
      });
    }

    if (activeTask) {
      this.activeSideQuestDisplay.textContent = activeTask.text;
      this.activeSideQuestDisplay.parentElement?.parentElement?.classList.remove('hidden');
    } else {
      this.activeSideQuestDisplay.textContent = '';
      this.activeSideQuestDisplay.parentElement?.parentElement?.classList.add('hidden');
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

    const workRunning = state === 'running' && type === 'work';
    this.sideQuestCard.classList.toggle('sq-disabled', workRunning);
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
