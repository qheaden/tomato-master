export type TimerType = 'work' | 'short-break' | 'long-break';
export type TimerState = 'idle' | 'running' | 'paused';

export const TIMER_DURATIONS: Record<TimerType, number> = {
  'work': 25 * 60,
  'short-break': 5 * 60,
  'long-break': 15 * 60,
};

export interface TimerConfig {
  onTick: (remaining: number) => void;
  onComplete: (type: TimerType) => void;
  onStateChange: (state: TimerState, type: TimerType | null) => void;
}

export class PomodoroTimer {
  private state: TimerState = 'idle';
  private currentType: TimerType | null = null;
  private remaining: number = 0;
  private intervalId: number | null = null;
  private config: TimerConfig;
  private setIntervalFn: (fn: () => void, ms: number) => number;
  private clearIntervalFn: (id: number) => void;

  constructor(
    config: TimerConfig,
    setIntervalFn: (fn: () => void, ms: number) => number = (fn, ms) => window.setInterval(fn, ms),
    clearIntervalFn: (id: number) => void = (id) => window.clearInterval(id)
  ) {
    this.config = config;
    this.setIntervalFn = setIntervalFn;
    this.clearIntervalFn = clearIntervalFn;
  }

  getState(): TimerState {
    return this.state;
  }

  getCurrentType(): TimerType | null {
    return this.currentType;
  }

  getRemaining(): number {
    return this.remaining;
  }

  start(type: TimerType): void {
    if (this.state === 'running') return;

    if (this.state === 'idle' || this.currentType !== type) {
      this.remaining = TIMER_DURATIONS[type];
      this.currentType = type;
    }

    this.state = 'running';
    this.config.onStateChange(this.state, this.currentType);
    this.config.onTick(this.remaining);

    this.intervalId = this.setIntervalFn(() => {
      this.remaining -= 1;
      this.config.onTick(this.remaining);

      if (this.remaining <= 0) {
        this.completeTimer();
      }
    }, 1000);
  }

  pause(): void {
    if (this.state !== 'running') return;
    this.clearTimer();
    this.state = 'paused';
    this.config.onStateChange(this.state, this.currentType);
  }

  resume(): void {
    if (this.state !== 'paused') return;
    this.start(this.currentType!);
  }

  cancel(): void {
    if (this.state === 'idle') return;
    const cancelledType = this.currentType;
    this.clearTimer();
    this.state = 'idle';
    this.currentType = null;
    this.remaining = 0;
    this.config.onStateChange('idle', null);
    // If cancelling a work timer, trigger completion callback as if it ended naturally
    if (cancelledType === 'work') {
      this.config.onComplete('work');
    }
  }

  private completeTimer(): void {
    const type = this.currentType!;
    this.clearTimer();
    this.state = 'idle';
    this.currentType = null;
    this.remaining = 0;
    this.config.onStateChange('idle', null);
    this.config.onComplete(type);
  }

  private clearTimer(): void {
    if (this.intervalId !== null) {
      this.clearIntervalFn(this.intervalId);
      this.intervalId = null;
    }
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
}
