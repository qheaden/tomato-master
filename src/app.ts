import { PomodoroTimer, TimerType, TimerState } from './timer';
import { TaskManager, Task } from './taskManager';
import { NoteManager, Note } from './noteManager';
import { NotificationService } from './notificationService';
import { YouTubePlaybackState } from './youtubePlaybackState';
import { getEffectiveTheme, loadThemePreference, saveThemePreference, ThemePreference } from './themePreference';

// Declare YouTube API types to avoid TypeScript errors
declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
  }
}

type TaskListType = 'tasks' | 'side-quests';

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
  private draggedTaskId: string | null = null;
  private draggedTaskListType: TaskListType | null = null;
  private draggedTaskElement: HTMLElement | null = null;
  private draggedHandleElement: HTMLElement | null = null;
  private currentDropTargetId: string | null = null;
  private dragOverBottomListType: TaskListType | null = null;

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
  private playbackState = new YouTubePlaybackState(localStorage);
  private playbackTrackingInterval: ReturnType<typeof setInterval> | null = null;
  private pendingRestorePosition: number | null = null;
  private youtubePlayerContainer!: HTMLElement;
  private themePreference: ThemePreference = 'system';
  private mediaQueryList: MediaQueryList | null = null;

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
    this.initTheme();

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
    document.getElementById('theme-system')?.addEventListener('click', () => this.setThemePreference('system'));
    document.getElementById('theme-light')?.addEventListener('click', () => this.setThemePreference('light'));
    document.getElementById('theme-dark')?.addEventListener('click', () => this.setThemePreference('dark'));

    // Setup global YouTube callback
    (window as any).onYouTubeIframeAPIReady = () => {
      this.onYouTubeIframeAPIReady();
    };

    window.addEventListener('beforeunload', () => {
      this.savePlaybackState();
    });

    document.addEventListener('pointermove', (event) => this.handleDragPointerMove(event));
    document.addEventListener('pointerup', (event) => this.finishDrag(event));
    document.addEventListener('pointercancel', (event) => this.finishDrag(event));
  }

  private initTheme(): void {
    this.themePreference = loadThemePreference(localStorage);
    this.mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');
    this.mediaQueryList.addEventListener('change', () => this.applyTheme());
    this.applyTheme();
    this.updateThemeButtons();
  }

  private setThemePreference(preference: ThemePreference): void {
    this.themePreference = preference;
    saveThemePreference(localStorage, preference);
    this.applyTheme();
    this.updateThemeButtons();
  }

  private applyTheme(): void {
    const isDark = this.mediaQueryList ? this.mediaQueryList.matches : false;
    const theme = getEffectiveTheme(this.themePreference, isDark);
    document.body.setAttribute('data-theme', theme);
  }

  private updateThemeButtons(): void {
    const buttons: Record<ThemePreference, HTMLElement | null> = {
      system: document.getElementById('theme-system'),
      light: document.getElementById('theme-light'),
      dark: document.getElementById('theme-dark'),
    };

    (Object.keys(buttons) as ThemePreference[]).forEach((key) => {
      buttons[key]?.classList.toggle('active', key === this.themePreference);
    });
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

    if (!url) {
      // User-initiated load: clear saved position so we start fresh
      this.playbackState.clear();
    }

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

    const saved = this.playbackState.load();
    if (saved) {
      this.pendingRestorePosition = saved.position;
      event.target.playVideoAt(saved.index);
    }
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

    // Restore seek position after navigating to the saved playlist index IF the player is playing or about to play
    if (this.pendingRestorePosition !== null && state === PLAYER_STATE.PLAYING) {
      event.target.seekTo(this.pendingRestorePosition, true);
      this.pendingRestorePosition = null; // Clear after seeking
      // Do not pauseVideo here, let it continue playing if timer is active
    }

    if (state === PLAYER_STATE.PLAYING) {
      this.startTrackingPlayback();
    } else {
      this.stopTrackingPlayback();
    }

    if (timerType === 'work' && state === PLAYER_STATE.PLAYING) {
      // Player is playing during work session - this is fine
    } else if (timerType !== 'work' || state === PLAYER_STATE.PAUSED || state === PLAYER_STATE.ENDED) {
      if (this.player && typeof this.player.pauseVideo === 'function') {
        this.player.pauseVideo();
      }
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
    // Ensure container is cleared if player is destroyed
    const container = document.getElementById('youtube-player-container') as HTMLElement;
    if (container) {
      container.innerHTML = '';
    }

    this.youtubePlayerContainer.classList.add('hidden');

    localStorage.removeItem('youtube-playlist-url');
    this.playbackState.clear();
    this.stopTrackingPlayback();
    this.youtubeUrlInput.value = '';

    this.updatePlaylistButton(false);
  }

  private savePlaybackState(): void {
    if (!this.player || typeof this.player.getCurrentTime !== 'function' || typeof this.player.getPlaylistIndex !== 'function') {
      return;
    }
    const index = this.player.getPlaylistIndex();
    const position = this.player.getCurrentTime();
    if (index >= 0) {
      this.playbackState.save(index, position);
    }
  }

  private startTrackingPlayback(): void {
    if (this.playbackTrackingInterval !== null) return;
    this.playbackTrackingInterval = setInterval(() => this.savePlaybackState(), 5000);
  }

  private stopTrackingPlayback(): void {
    if (this.playbackTrackingInterval === null) return;
    clearInterval(this.playbackTrackingInterval);
    this.playbackTrackingInterval = null;
    this.savePlaybackState();
  }

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
    this.renderTaskList({
      tasks,
      activeTask,
      listElement: this.sideQuestList,
      emptyText: 'No side quests yet. Add one above!',
      completeLabelPrefix: 'Mark',
      deleteLabelPrefix: 'Delete side quest',
      reorderLabelPrefix: 'Reorder side quest',
      activeTitle: 'Click to set as active side quest',
      listType: 'side-quests',
      manager: this.sideQuestManager,
    });
    this.updateActiveTaskDisplay(this.activeSideQuestDisplay, activeTask);
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
    this.renderTaskList({
      tasks,
      activeTask,
      listElement: this.taskList,
      emptyText: 'No tasks yet. Add one above!',
      completeLabelPrefix: 'Mark',
      deleteLabelPrefix: 'Delete task',
      reorderLabelPrefix: 'Reorder task',
      activeTitle: 'Click to set as active task',
      listType: 'tasks',
      manager: this.taskManager,
    });
    this.updateActiveTaskDisplay(this.activeTaskDisplay, activeTask);
  }

  private renderTaskList(options: {
    tasks: Task[];
    activeTask: Task | null;
    listElement: HTMLElement;
    emptyText: string;
    completeLabelPrefix: string;
    deleteLabelPrefix: string;
    reorderLabelPrefix: string;
    activeTitle: string;
    listType: TaskListType;
    manager: TaskManager;
  }): void {
    const { tasks, activeTask, listElement, emptyText, completeLabelPrefix, deleteLabelPrefix, reorderLabelPrefix, activeTitle, listType, manager } = options;
    listElement.innerHTML = '';

    if (tasks.length === 0) {
      listElement.innerHTML = `<li class="task-empty">${emptyText}</li>`;
      return;
    }

    tasks.forEach(task => {
      const li = document.createElement('li');
      li.className = `task-item${task.completed ? ' completed' : ''}${task.id === activeTask?.id ? ' active-task' : ''}`;
      li.dataset.id = task.id;
      li.dataset.listType = listType;
      li.dataset.testid = `${listType}-item-${task.id}`;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = task.completed;
      checkbox.className = 'task-checkbox';
      checkbox.setAttribute('aria-label', `${completeLabelPrefix} "${task.text}" as complete`);
      if (!task.completed) {
        checkbox.addEventListener('change', () => manager.completeTask(task.id));
      }

      const span = document.createElement('span');
      span.className = 'task-text';
      span.textContent = task.text;
      if (!task.completed) {
        span.addEventListener('click', () => manager.setActiveTask(task.id));
        span.title = activeTitle;
      }

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'task-delete-btn';
      deleteBtn.innerHTML = '<span class="material-icons">delete</span>';
      deleteBtn.setAttribute('aria-label', `${deleteLabelPrefix} "${task.text}"`);
      deleteBtn.addEventListener('click', () => manager.deleteTask(task.id));

      const dragHandle = document.createElement('button');
      dragHandle.type = 'button';
      dragHandle.className = 'task-drag-handle';
      dragHandle.innerHTML = '<span class="material-icons">more_vert</span>';
      dragHandle.setAttribute('aria-label', `${reorderLabelPrefix} "${task.text}"`);
      dragHandle.dataset.testid = `${listType}-reorder-${task.id}`;
      dragHandle.title = 'Drag to reorder';
      dragHandle.addEventListener('pointerdown', (event) => this.startDrag(event, task.id, listType, li, dragHandle));

      li.appendChild(checkbox);
      li.appendChild(span);
      li.appendChild(deleteBtn);
      li.appendChild(dragHandle);
      listElement.appendChild(li);
    });
  }

  private startDrag(event: PointerEvent, taskId: string, listType: TaskListType, rowElement: HTMLElement, handleElement: HTMLElement): void {
    if (!event.isPrimary || event.button !== 0) {
      return;
    }

    this.clearDragState();
    this.draggedTaskId = taskId;
    this.draggedTaskListType = listType;
    this.draggedTaskElement = rowElement;
    this.draggedHandleElement = handleElement;
    rowElement.classList.add('dragging');
    event.preventDefault();
  }

  private handleDragPointerMove(event: PointerEvent): void {
    if (!this.draggedTaskId || !this.draggedTaskListType || !this.draggedTaskElement) {
      return;
    }

    const taskRow = this.getTaskRowFromPoint(event.clientX, event.clientY);
    if (taskRow && taskRow.dataset.listType === this.draggedTaskListType && taskRow.dataset.id !== this.draggedTaskId) {
      this.setCurrentDropTarget(taskRow.dataset.id ?? null);
      this.setBottomDropTarget(null);
      return;
    }

    this.setCurrentDropTarget(null);
    const bottomListType = this.getBottomDropListType(event.clientX, event.clientY);
    this.setBottomDropTarget(bottomListType === this.draggedTaskListType ? bottomListType : null);
  }

  private finishDrag(event: PointerEvent): void {
    if (!this.draggedTaskId || !this.draggedTaskListType) {
      return;
    }

    const draggedTaskId = this.draggedTaskId;
    const draggedTaskListType = this.draggedTaskListType;
    const taskRow = this.getTaskRowFromPoint(event.clientX, event.clientY);
    const targetTaskId = taskRow && taskRow.dataset.listType === draggedTaskListType && taskRow.dataset.id !== draggedTaskId
      ? taskRow.dataset.id ?? null
      : this.currentDropTargetId;
    const bottomListType = this.getBottomDropListType(event.clientX, event.clientY);
    const dropToBottom = bottomListType === draggedTaskListType || this.dragOverBottomListType === draggedTaskListType;

    if (targetTaskId) {
      this.getManagerForListType(draggedTaskListType).moveTaskBefore(draggedTaskId, targetTaskId);
    } else if (dropToBottom) {
      this.getManagerForListType(draggedTaskListType).moveTaskToEnd(draggedTaskId);
    }

    this.clearDragState();
  }

  private getManagerForListType(listType: TaskListType): TaskManager {
    return listType === 'tasks' ? this.taskManager : this.sideQuestManager;
  }

  private getTaskRowFromPoint(clientX: number, clientY: number): HTMLElement | null {
    const element = document.elementFromPoint(clientX, clientY);
    return element?.closest('.task-item') as HTMLElement | null;
  }

  private getBottomDropListType(clientX: number, clientY: number): TaskListType | null {
    const candidates: Array<{ listType: TaskListType; element: HTMLElement }> = [
      { listType: 'tasks', element: this.taskList },
      { listType: 'side-quests', element: this.sideQuestList },
    ];

    for (const candidate of candidates) {
      const rect = candidate.element.getBoundingClientRect();
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom + 32) {
        continue;
      }

      const rows = Array.from(candidate.element.querySelectorAll('.task-item')) as HTMLElement[];
      if (rows.length === 0) {
        continue;
      }

      const lastRowRect = rows[rows.length - 1].getBoundingClientRect();
      if (clientY >= lastRowRect.bottom) {
        return candidate.listType;
      }
    }

    return null;
  }

  private setCurrentDropTarget(taskId: string | null): void {
    if (this.currentDropTargetId === taskId) {
      return;
    }

    const activeListType = this.draggedTaskListType;

    if (this.currentDropTargetId && activeListType) {
      const previous = this.getListElement(activeListType).querySelector(`.task-item[data-id="${this.currentDropTargetId}"]`);
      previous?.classList.remove('drag-over');
    }

    this.currentDropTargetId = taskId;

    if (taskId && activeListType) {
      const next = this.getListElement(activeListType).querySelector(`.task-item[data-id="${taskId}"]`);
      next?.classList.add('drag-over');
    }
  }

  private setBottomDropTarget(listType: TaskListType | null): void {
    if (this.dragOverBottomListType === listType) {
      return;
    }

    if (this.dragOverBottomListType) {
      this.getListElement(this.dragOverBottomListType).classList.remove('drag-over-bottom');
    }

    this.dragOverBottomListType = listType;

    if (listType) {
      this.getListElement(listType).classList.add('drag-over-bottom');
    }
  }

  private getListElement(listType: TaskListType): HTMLElement {
    return listType === 'tasks' ? this.taskList : this.sideQuestList;
  }

  private clearDragState(): void {
    this.draggedTaskElement?.classList.remove('dragging');
    this.setCurrentDropTarget(null);
    this.setBottomDropTarget(null);
    this.draggedTaskId = null;
    this.draggedTaskListType = null;
    this.draggedTaskElement = null;
    this.draggedHandleElement = null;
  }

  private updateActiveTaskDisplay(display: HTMLElement, activeTask: Task | null): void {
    if (activeTask) {
      display.textContent = activeTask.text;
      display.parentElement?.parentElement?.classList.remove('hidden');
    } else {
      display.textContent = '';
      display.parentElement?.parentElement?.classList.add('hidden');
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
