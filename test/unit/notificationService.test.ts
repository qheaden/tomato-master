import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationService, NotificationConstructor } from '../../src/notificationService';

interface MockAudioParam {
  value: number;
  setValueAtTime: ReturnType<typeof vi.fn>;
  linearRampToValueAtTime: ReturnType<typeof vi.fn>;
  exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
}

interface MockOscillator {
  type: string;
  frequency: MockAudioParam;
  connect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
}

interface MockGainNode {
  gain: MockAudioParam;
  connect: ReturnType<typeof vi.fn>;
}

interface MockAudioContext {
  currentTime: number;
  destination: object;
  createOscillator: ReturnType<typeof vi.fn>;
  createGain: ReturnType<typeof vi.fn>;
}

function makeAudioParam(): MockAudioParam {
  return {
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
}

function makeOscillator(): MockOscillator {
  return {
    type: 'sine',
    frequency: makeAudioParam(),
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
}

function makeGainNode(): MockGainNode {
  return {
    gain: makeAudioParam(),
    connect: vi.fn(),
  };
}

function makeMockAudioContext(currentTime = 0): MockAudioContext {
  return {
    currentTime,
    destination: {},
    createOscillator: vi.fn(() => makeOscillator()),
    createGain: vi.fn(() => makeGainNode()),
  };
}

interface MockNotificationCtor extends NotificationConstructor {
  _instances: Array<{ title: string; options?: object }>;
  requestPermission: ReturnType<typeof vi.fn>;
}

function makeMockNotificationCtor(permission: NotificationPermission = 'default'): MockNotificationCtor {
  const instances: Array<{ title: string; options?: object }> = [];

  function MockNotification(this: object, title: string, options?: object) {
    instances.push({ title, options });
  }

  const typedMockNotification = MockNotification as unknown as MockNotificationCtor;
  typedMockNotification.requestPermission = vi.fn().mockResolvedValue(permission);
  typedMockNotification.permission = permission;
  typedMockNotification._instances = instances;

  return typedMockNotification;
}

describe('NotificationService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('requestPermission()', () => {
    it('calls Notification.requestPermission', async () => {
      const ctor = makeMockNotificationCtor('granted');
      const service = new NotificationService({ NotificationCtor: ctor });

      await service.requestPermission();

      expect(ctor.requestPermission).toHaveBeenCalledTimes(1);
    });

    it('does nothing when NotificationCtor is not available', async () => {
      const service = new NotificationService({ NotificationCtor: undefined });
      await service.requestPermission();
    });

    it('stores granted permission so notify() works afterwards', async () => {
      const ctor = makeMockNotificationCtor('granted');
      const service = new NotificationService({ NotificationCtor: ctor });

      await service.requestPermission();
      service.notify('Test');

      expect(ctor._instances).toHaveLength(1);
    });

    it('stores denied permission so notify() is blocked afterwards', async () => {
      const ctor = makeMockNotificationCtor('denied');
      const service = new NotificationService({ NotificationCtor: ctor });

      await service.requestPermission();
      service.notify('Test');

      expect(ctor._instances).toHaveLength(0);
    });
  });

  describe('notify()', () => {
    it('creates a notification when permission is granted', async () => {
      const ctor = makeMockNotificationCtor('granted');
      const service = new NotificationService({ NotificationCtor: ctor });
      await service.requestPermission();

      service.notify('Timer Complete!', 'Great work!');

      expect(ctor._instances).toHaveLength(1);
      expect(ctor._instances[0].title).toBe('Timer Complete!');
    });

    it('includes body in notification options', async () => {
      const ctor = makeMockNotificationCtor('granted');
      const service = new NotificationService({ NotificationCtor: ctor });
      await service.requestPermission();

      service.notify('Title', 'Body text');

      const opts = ctor._instances[0].options as { body: string };
      expect(opts.body).toBe('Body text');
    });

    it('does not require a body', async () => {
      const ctor = makeMockNotificationCtor('granted');
      const service = new NotificationService({ NotificationCtor: ctor });
      await service.requestPermission();

      service.notify('Title only');

      expect(ctor._instances).toHaveLength(1);
    });

    it('does not create notification when permission is denied', async () => {
      const ctor = makeMockNotificationCtor('denied');
      const service = new NotificationService({ NotificationCtor: ctor });
      await service.requestPermission();

      service.notify('Timer Complete!');

      expect(ctor._instances).toHaveLength(0);
    });

    it('does not create notification before requestPermission is called', () => {
      const ctor = makeMockNotificationCtor('granted');
      const service = new NotificationService({ NotificationCtor: ctor });

      service.notify('Timer Complete!');

      expect(ctor._instances).toHaveLength(0);
    });

    it('does nothing when NotificationCtor is not available', () => {
      const service = new NotificationService({ NotificationCtor: undefined });
      service.notify('Test');
    });
  });

  describe('playAlarm()', () => {
    it('creates an AudioContext on first call', () => {
      const mockCtx = makeMockAudioContext();
      const createAudioContext = vi.fn(() => mockCtx);
      const service = new NotificationService({ createAudioContext: createAudioContext as unknown as () => AudioContext });

      service.playAlarm();

      expect(createAudioContext).toHaveBeenCalledTimes(1);
    });

    it('reuses the same AudioContext on subsequent calls', () => {
      const mockCtx = makeMockAudioContext();
      const createAudioContext = vi.fn(() => mockCtx);
      const service = new NotificationService({ createAudioContext: createAudioContext as unknown as () => AudioContext });

      service.playAlarm();
      service.playAlarm();

      expect(createAudioContext).toHaveBeenCalledTimes(1);
    });

    it('creates 12 oscillators (4 beeps × 3 harmonics)', () => {
      const mockCtx = makeMockAudioContext();
      const service = new NotificationService({ createAudioContext: () => mockCtx as unknown as AudioContext });

      service.playAlarm();

      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(12);
      expect(mockCtx.createGain).toHaveBeenCalledTimes(12);
    });

    it('starts and stops every oscillator', () => {
      const oscillators: MockOscillator[] = [];
      const mockCtx: MockAudioContext = {
        currentTime: 0,
        destination: {},
        createOscillator: vi.fn(() => {
          const osc = makeOscillator();
          oscillators.push(osc);
          return osc;
        }),
        createGain: vi.fn(() => makeGainNode()),
      };
      const service = new NotificationService({ createAudioContext: () => mockCtx as unknown as AudioContext });

      service.playAlarm();

      expect(oscillators).toHaveLength(12);
      oscillators.forEach((osc) => {
        expect(osc.start).toHaveBeenCalledTimes(1);
        expect(osc.stop).toHaveBeenCalledTimes(1);
      });
    });

    it('schedules beeps at increasing start times', () => {
      const startTimes: number[] = [];
      const mockCtx: MockAudioContext = {
        currentTime: 0,
        destination: {},
        createOscillator: vi.fn(() => {
          const osc = makeOscillator();
          osc.start = vi.fn((t: number) => startTimes.push(t));
          return osc;
        }),
        createGain: vi.fn(() => makeGainNode()),
      };
      const service = new NotificationService({ createAudioContext: () => mockCtx as unknown as AudioContext });

      service.playAlarm();

      expect(startTimes).toHaveLength(12);
      expect(startTimes[0]).toBe(startTimes[1]);
      expect(startTimes[1]).toBe(startTimes[2]);
      expect(startTimes[3]).toBeGreaterThan(startTimes[0]);
      expect(startTimes[6]).toBeGreaterThan(startTimes[3]);
      expect(startTimes[9]).toBeGreaterThan(startTimes[6]);
    });

    it('sets oscillator type to sine for each harmonic', () => {
      const oscillators: MockOscillator[] = [];
      const mockCtx: MockAudioContext = {
        currentTime: 0,
        destination: {},
        createOscillator: vi.fn(() => {
          const osc = makeOscillator();
          oscillators.push(osc);
          return osc;
        }),
        createGain: vi.fn(() => makeGainNode()),
      };
      const service = new NotificationService({ createAudioContext: () => mockCtx as unknown as AudioContext });

      service.playAlarm();

      oscillators.forEach((osc) => {
        expect(osc.type).toBe('sine');
      });
    });

    it('applies gain envelope (attack and decay) on each oscillator', () => {
      const gainNodes: MockGainNode[] = [];
      const mockCtx: MockAudioContext = {
        currentTime: 0,
        destination: {},
        createOscillator: vi.fn(() => makeOscillator()),
        createGain: vi.fn(() => {
          const g = makeGainNode();
          gainNodes.push(g);
          return g;
        }),
      };
      const service = new NotificationService({ createAudioContext: () => mockCtx as unknown as AudioContext });

      service.playAlarm();

      gainNodes.forEach((g) => {
        expect(g.gain.setValueAtTime).toHaveBeenCalledTimes(1);
        expect(g.gain.linearRampToValueAtTime).toHaveBeenCalledTimes(1);
        expect(g.gain.exponentialRampToValueAtTime).toHaveBeenCalledTimes(1);
      });
    });
  });
});
