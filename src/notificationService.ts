export interface NotificationConstructor {
  new(title: string, options?: object): { close(): void };
  requestPermission(): Promise<NotificationPermission>;
  readonly permission: NotificationPermission;
}

export interface NotificationServiceDeps {
  createAudioContext?: () => AudioContext;
  NotificationCtor?: NotificationConstructor;
}

export class NotificationService {
  private audioCtx: AudioContext | null = null;
  private permission: NotificationPermission = 'default';
  private readonly createAudioContextFn: () => AudioContext;
  private readonly NotificationCtor: NotificationConstructor | null;

  constructor(deps: NotificationServiceDeps = {}) {
    this.createAudioContextFn = deps.createAudioContext ?? (() => new AudioContext());
    this.NotificationCtor = deps.NotificationCtor ??
      (typeof Notification !== 'undefined' ? Notification as unknown as NotificationConstructor : null);
  }

  async requestPermission(): Promise<void> {
    if (!this.NotificationCtor) return;
    this.permission = await this.NotificationCtor.requestPermission();
  }

  notify(title: string, body?: string): void {
    if (!this.NotificationCtor || this.permission !== 'granted') return;
    new this.NotificationCtor(title, { body });
  }

  playAlarm(): void {
    if (!this.audioCtx) {
      this.audioCtx = this.createAudioContextFn();
    }

    const ctx = this.audioCtx;
    const beepCount = 4;
    const beepDuration = 0.3;
    const gapDuration = 0.15;

    for (let i = 0; i < beepCount; i++) {
      const startTime = ctx.currentTime + i * (beepDuration + gapDuration);
      this.playBeep(ctx, startTime, beepDuration);
    }
  }

  private playBeep(ctx: AudioContext, startTime: number, duration: number): void {
    // Three harmonics (fundamental + fifth + octave) for a pleasing, non-jarring tone
    const harmonics: { freq: number; gain: number }[] = [
      { freq: 523.25, gain: 0.30 },  // C5 - fundamental
      { freq: 783.99, gain: 0.15 },  // G5 - perfect fifth
      { freq: 1046.5, gain: 0.075 }, // C6 - octave
    ];

    harmonics.forEach(({ freq, gain: maxGain }) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.value = freq;

      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(maxGain, startTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.start(startTime);
      osc.stop(startTime + duration);
    });
  }
}
