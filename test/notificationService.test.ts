import { expect } from 'chai';
import sinon from 'sinon';
import { NotificationService, NotificationConstructor } from '../src/notificationService';

// Minimal mock types for AudioContext nodes
interface MockAudioParam {
  value: number;
  setValueAtTime: sinon.SinonStub;
  linearRampToValueAtTime: sinon.SinonStub;
  exponentialRampToValueAtTime: sinon.SinonStub;
}

interface MockOscillator {
  type: string;
  frequency: MockAudioParam;
  connect: sinon.SinonStub;
  start: sinon.SinonStub;
  stop: sinon.SinonStub;
}

interface MockGainNode {
  gain: MockAudioParam;
  connect: sinon.SinonStub;
}

interface MockAudioContext {
  currentTime: number;
  destination: object;
  createOscillator: sinon.SinonStub;
  createGain: sinon.SinonStub;
}

function makeAudioParam(): MockAudioParam {
  return {
    value: 0,
    setValueAtTime: sinon.stub(),
    linearRampToValueAtTime: sinon.stub(),
    exponentialRampToValueAtTime: sinon.stub(),
  };
}

function makeOscillator(): MockOscillator {
  return {
    type: 'sine',
    frequency: makeAudioParam(),
    connect: sinon.stub(),
    start: sinon.stub(),
    stop: sinon.stub(),
  };
}

function makeGainNode(): MockGainNode {
  return {
    gain: makeAudioParam(),
    connect: sinon.stub(),
  };
}

function makeMockAudioContext(currentTime = 0): MockAudioContext {
  return {
    currentTime,
    destination: {},
    createOscillator: sinon.stub().callsFake(makeOscillator),
    createGain: sinon.stub().callsFake(makeGainNode),
  };
}

interface MockNotificationCtor extends NotificationConstructor {
  _instances: Array<{ title: string; options?: object }>;
  requestPermission: sinon.SinonStub;
}

function makeMockNotificationCtor(permission: NotificationPermission = 'default'): MockNotificationCtor {
  const instances: Array<{ title: string; options?: object }> = [];

  function MockNotification(this: object, title: string, options?: object) {
    instances.push({ title, options });
  }
  MockNotification.requestPermission = sinon.stub().resolves(permission);
  MockNotification.permission = permission;
  MockNotification._instances = instances;

  return MockNotification as unknown as MockNotificationCtor;
}

describe('NotificationService', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('requestPermission()', () => {
    it('calls Notification.requestPermission', async () => {
      const ctor = makeMockNotificationCtor('granted');
      const service = new NotificationService({ NotificationCtor: ctor });

      await service.requestPermission();

      expect(ctor.requestPermission.calledOnce).to.be.true;
    });

    it('does nothing when NotificationCtor is not available', async () => {
      const service = new NotificationService({ NotificationCtor: undefined });
      // Should not throw
      await service.requestPermission();
    });

    it('stores granted permission so notify() works afterwards', async () => {
      const ctor = makeMockNotificationCtor('granted');
      const service = new NotificationService({ NotificationCtor: ctor });

      await service.requestPermission();
      service.notify('Test');

      expect(ctor._instances).to.have.length(1);
    });

    it('stores denied permission so notify() is blocked afterwards', async () => {
      const ctor = makeMockNotificationCtor('denied');
      const service = new NotificationService({ NotificationCtor: ctor });

      await service.requestPermission();
      service.notify('Test');

      expect(ctor._instances).to.have.length(0);
    });
  });

  describe('notify()', () => {
    it('creates a notification when permission is granted', async () => {
      const ctor = makeMockNotificationCtor('granted');
      const service = new NotificationService({ NotificationCtor: ctor });
      await service.requestPermission();

      service.notify('Timer Complete!', 'Great work!');

      expect(ctor._instances).to.have.length(1);
      expect(ctor._instances[0].title).to.equal('Timer Complete!');
    });

    it('includes body in notification options', async () => {
      const ctor = makeMockNotificationCtor('granted');
      const service = new NotificationService({ NotificationCtor: ctor });
      await service.requestPermission();

      service.notify('Title', 'Body text');

      const opts = ctor._instances[0].options as { body: string };
      expect(opts.body).to.equal('Body text');
    });

    it('does not require a body', async () => {
      const ctor = makeMockNotificationCtor('granted');
      const service = new NotificationService({ NotificationCtor: ctor });
      await service.requestPermission();

      service.notify('Title only');

      expect(ctor._instances).to.have.length(1);
    });

    it('does not create notification when permission is denied', async () => {
      const ctor = makeMockNotificationCtor('denied');
      const service = new NotificationService({ NotificationCtor: ctor });
      await service.requestPermission();

      service.notify('Timer Complete!');

      expect(ctor._instances).to.have.length(0);
    });

    it('does not create notification before requestPermission is called', () => {
      const ctor = makeMockNotificationCtor('granted');
      const service = new NotificationService({ NotificationCtor: ctor });
      // requestPermission NOT called — internal permission stays 'default'

      service.notify('Timer Complete!');

      expect(ctor._instances).to.have.length(0);
    });

    it('does nothing when NotificationCtor is not available', () => {
      const service = new NotificationService({ NotificationCtor: undefined });
      // Should not throw
      service.notify('Test');
    });
  });

  describe('playAlarm()', () => {
    it('creates an AudioContext on first call', () => {
      const mockCtx = makeMockAudioContext();
      const createAudioContext = sinon.stub().returns(mockCtx);
      const service = new NotificationService({ createAudioContext: createAudioContext as unknown as () => AudioContext });

      service.playAlarm();

      expect(createAudioContext.calledOnce).to.be.true;
    });

    it('reuses the same AudioContext on subsequent calls', () => {
      const mockCtx = makeMockAudioContext();
      const createAudioContext = sinon.stub().returns(mockCtx);
      const service = new NotificationService({ createAudioContext: createAudioContext as unknown as () => AudioContext });

      service.playAlarm();
      service.playAlarm();

      expect(createAudioContext.calledOnce).to.be.true;
    });

    it('creates 12 oscillators (4 beeps × 3 harmonics)', () => {
      const mockCtx = makeMockAudioContext();
      const service = new NotificationService({ createAudioContext: () => mockCtx as unknown as AudioContext });

      service.playAlarm();

      expect(mockCtx.createOscillator.callCount).to.equal(12);
      expect(mockCtx.createGain.callCount).to.equal(12);
    });

    it('starts and stops every oscillator', () => {
      const oscillators: MockOscillator[] = [];
      const mockCtx: MockAudioContext = {
        currentTime: 0,
        destination: {},
        createOscillator: sinon.stub().callsFake(() => {
          const osc = makeOscillator();
          oscillators.push(osc);
          return osc;
        }),
        createGain: sinon.stub().callsFake(makeGainNode),
      };
      const service = new NotificationService({ createAudioContext: () => mockCtx as unknown as AudioContext });

      service.playAlarm();

      expect(oscillators).to.have.length(12);
      oscillators.forEach(osc => {
        expect(osc.start.calledOnce).to.be.true;
        expect(osc.stop.calledOnce).to.be.true;
      });
    });

    it('schedules beeps at increasing start times', () => {
      const startTimes: number[] = [];
      const mockCtx: MockAudioContext = {
        currentTime: 0,
        destination: {},
        createOscillator: sinon.stub().callsFake(() => {
          const osc = makeOscillator();
          osc.start = sinon.stub().callsFake((t: number) => startTimes.push(t));
          return osc;
        }),
        createGain: sinon.stub().callsFake(makeGainNode),
      };
      const service = new NotificationService({ createAudioContext: () => mockCtx as unknown as AudioContext });

      service.playAlarm();

      // 12 start calls: grouped in 3s per beep (same time within a beep)
      expect(startTimes).to.have.length(12);

      // First 3 oscillators all belong to beep 0 — same start time
      expect(startTimes[0]).to.equal(startTimes[1]);
      expect(startTimes[1]).to.equal(startTimes[2]);

      // Beep 1 starts after beep 0
      expect(startTimes[3]).to.be.greaterThan(startTimes[0]);

      // Beep 2 starts after beep 1
      expect(startTimes[6]).to.be.greaterThan(startTimes[3]);

      // Beep 3 starts after beep 2
      expect(startTimes[9]).to.be.greaterThan(startTimes[6]);
    });

    it('sets oscillator type to sine for each harmonic', () => {
      const oscillators: MockOscillator[] = [];
      const mockCtx: MockAudioContext = {
        currentTime: 0,
        destination: {},
        createOscillator: sinon.stub().callsFake(() => {
          const osc = makeOscillator();
          oscillators.push(osc);
          return osc;
        }),
        createGain: sinon.stub().callsFake(makeGainNode),
      };
      const service = new NotificationService({ createAudioContext: () => mockCtx as unknown as AudioContext });

      service.playAlarm();

      oscillators.forEach(osc => {
        expect(osc.type).to.equal('sine');
      });
    });

    it('applies gain envelope (attack and decay) on each oscillator', () => {
      const gainNodes: MockGainNode[] = [];
      const mockCtx: MockAudioContext = {
        currentTime: 0,
        destination: {},
        createOscillator: sinon.stub().callsFake(makeOscillator),
        createGain: sinon.stub().callsFake(() => {
          const g = makeGainNode();
          gainNodes.push(g);
          return g;
        }),
      };
      const service = new NotificationService({ createAudioContext: () => mockCtx as unknown as AudioContext });

      service.playAlarm();

      gainNodes.forEach(g => {
        expect(g.gain.setValueAtTime.calledOnce).to.be.true;
        expect(g.gain.linearRampToValueAtTime.calledOnce).to.be.true;
        expect(g.gain.exponentialRampToValueAtTime.calledOnce).to.be.true;
      });
    });
  });
});
