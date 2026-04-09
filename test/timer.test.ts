import { expect } from 'chai';
import sinon from 'sinon';
import { PomodoroTimer, TimerType, TimerState, TIMER_DURATIONS } from '../src/timer';

describe('PomodoroTimer', () => {
  let tickSpy: sinon.SinonSpy;
  let completeSpy: sinon.SinonSpy;
  let stateChangeSpy: sinon.SinonSpy;
  let fakeSetInterval: sinon.SinonStub;
  let fakeClearInterval: sinon.SinonStub;
  let intervalCallback: (() => void) | null;
  let timer: PomodoroTimer;

  beforeEach(() => {
    tickSpy = sinon.spy();
    completeSpy = sinon.spy();
    stateChangeSpy = sinon.spy();
    intervalCallback = null;

    fakeSetInterval = sinon.stub().callsFake((fn: () => void) => {
      intervalCallback = fn;
      return 999;
    });
    fakeClearInterval = sinon.stub();

    timer = new PomodoroTimer(
      {
        onTick: tickSpy,
        onComplete: completeSpy,
        onStateChange: stateChangeSpy,
      },
      fakeSetInterval,
      fakeClearInterval
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('TIMER_DURATIONS', () => {
    it('should have 25 min for work', () => {
      expect(TIMER_DURATIONS['work']).to.equal(25 * 60);
    });
    it('should have 5 min for short-break', () => {
      expect(TIMER_DURATIONS['short-break']).to.equal(5 * 60);
    });
    it('should have 15 min for long-break', () => {
      expect(TIMER_DURATIONS['long-break']).to.equal(15 * 60);
    });
  });

  describe('initial state', () => {
    it('should start in idle state', () => {
      expect(timer.getState()).to.equal('idle');
    });
    it('should have no current type', () => {
      expect(timer.getCurrentType()).to.be.null;
    });
    it('should have 0 remaining', () => {
      expect(timer.getRemaining()).to.equal(0);
    });
  });

  describe('start()', () => {
    it('should set state to running when started', () => {
      timer.start('work');
      expect(timer.getState()).to.equal('running');
    });

    it('should set the current type', () => {
      timer.start('work');
      expect(timer.getCurrentType()).to.equal('work');
    });

    it('should set remaining to full duration on first start', () => {
      timer.start('work');
      // tick event fires immediately with remaining after first interval setup
      expect(timer.getRemaining()).to.equal(TIMER_DURATIONS['work']);
    });

    it('should call onStateChange with running state', () => {
      timer.start('work');
      expect(stateChangeSpy.calledWith('running', 'work')).to.be.true;
    });

    it('should call onTick immediately with remaining seconds', () => {
      timer.start('work');
      expect(tickSpy.called).to.be.true;
      expect(tickSpy.firstCall.args[0]).to.equal(TIMER_DURATIONS['work']);
    });

    it('should start setInterval', () => {
      timer.start('work');
      expect(fakeSetInterval.calledOnce).to.be.true;
    });

    it('should not start again if already running', () => {
      timer.start('work');
      timer.start('work');
      expect(fakeSetInterval.calledOnce).to.be.true;
    });

    it('should work for short-break type', () => {
      timer.start('short-break');
      expect(timer.getCurrentType()).to.equal('short-break');
      expect(timer.getRemaining()).to.equal(TIMER_DURATIONS['short-break']);
    });

    it('should work for long-break type', () => {
      timer.start('long-break');
      expect(timer.getCurrentType()).to.equal('long-break');
      expect(timer.getRemaining()).to.equal(TIMER_DURATIONS['long-break']);
    });
  });

  describe('tick behavior', () => {
    it('should decrement remaining each tick', () => {
      timer.start('work');
      intervalCallback!();
      expect(timer.getRemaining()).to.equal(TIMER_DURATIONS['work'] - 1);
    });

    it('should call onTick on each interval', () => {
      timer.start('work');
      const initialCallCount = tickSpy.callCount;
      intervalCallback!();
      expect(tickSpy.callCount).to.equal(initialCallCount + 1);
    });

    it('should complete timer when remaining reaches 0', () => {
      timer.start('work');
      // Set remaining to 1
      for (let i = 0; i < TIMER_DURATIONS['work'] - 1; i++) {
        intervalCallback!();
      }
      expect(completeSpy.notCalled).to.be.true;
      intervalCallback!(); // final tick
      expect(completeSpy.calledOnce).to.be.true;
      expect(completeSpy.calledWith('work')).to.be.true;
    });

    it('should return to idle after completion', () => {
      timer.start('work');
      for (let i = 0; i < TIMER_DURATIONS['work']; i++) {
        intervalCallback!();
      }
      expect(timer.getState()).to.equal('idle');
    });

    it('should clear interval after completion', () => {
      timer.start('work');
      for (let i = 0; i < TIMER_DURATIONS['work']; i++) {
        intervalCallback!();
      }
      expect(fakeClearInterval.calledOnce).to.be.true;
    });
  });

  describe('pause()', () => {
    it('should set state to paused', () => {
      timer.start('work');
      timer.pause();
      expect(timer.getState()).to.equal('paused');
    });

    it('should call onStateChange with paused', () => {
      timer.start('work');
      timer.pause();
      expect(stateChangeSpy.calledWith('paused', 'work')).to.be.true;
    });

    it('should clear the interval', () => {
      timer.start('work');
      timer.pause();
      expect(fakeClearInterval.calledOnce).to.be.true;
    });

    it('should preserve remaining time on pause', () => {
      timer.start('work');
      intervalCallback!();
      intervalCallback!();
      const remaining = timer.getRemaining();
      timer.pause();
      expect(timer.getRemaining()).to.equal(remaining);
    });

    it('should do nothing if not running', () => {
      timer.pause(); // idle
      expect(timer.getState()).to.equal('idle');
      expect(stateChangeSpy.notCalled).to.be.true;
    });
  });

  describe('resume()', () => {
    it('should resume from paused state', () => {
      timer.start('work');
      timer.pause();
      timer.resume();
      expect(timer.getState()).to.equal('running');
    });

    it('should continue from remaining time (not reset)', () => {
      timer.start('work');
      intervalCallback!();
      intervalCallback!();
      const remaining = timer.getRemaining();
      timer.pause();
      timer.resume();
      expect(timer.getRemaining()).to.equal(remaining);
    });

    it('should do nothing if not paused', () => {
      timer.resume(); // idle
      expect(timer.getState()).to.equal('idle');
    });

    it('should start a new interval on resume', () => {
      timer.start('work');
      timer.pause();
      timer.resume();
      expect(fakeSetInterval.calledTwice).to.be.true;
    });
  });

  describe('cancel()', () => {
    it('should set state to idle', () => {
      timer.start('work');
      timer.cancel();
      expect(timer.getState()).to.equal('idle');
    });

    it('should clear current type and remaining', () => {
      timer.start('work');
      timer.cancel();
      expect(timer.getCurrentType()).to.be.null;
      expect(timer.getRemaining()).to.equal(0);
    });

    it('should call onStateChange with idle', () => {
      timer.start('work');
      timer.cancel();
      expect(stateChangeSpy.calledWith('idle', null)).to.be.true;
    });

    it('should trigger onComplete with work type when cancelling a work timer', () => {
      timer.start('work');
      timer.cancel();
      expect(completeSpy.calledOnce).to.be.true;
      expect(completeSpy.calledWith('work')).to.be.true;
    });

    it('should NOT trigger onComplete when cancelling a short-break timer', () => {
      timer.start('short-break');
      timer.cancel();
      expect(completeSpy.notCalled).to.be.true;
    });

    it('should NOT trigger onComplete when cancelling a long-break timer', () => {
      timer.start('long-break');
      timer.cancel();
      expect(completeSpy.notCalled).to.be.true;
    });

    it('should do nothing if timer is idle', () => {
      timer.cancel();
      expect(stateChangeSpy.notCalled).to.be.true;
    });

    it('should cancel a paused timer', () => {
      timer.start('work');
      timer.pause();
      timer.cancel();
      expect(timer.getState()).to.equal('idle');
      expect(completeSpy.calledWith('work')).to.be.true;
    });

    it('should clear interval on cancel', () => {
      timer.start('work');
      timer.cancel();
      expect(fakeClearInterval.calledOnce).to.be.true;
    });
  });

  describe('formatTime()', () => {
    it('should format 0 seconds as 00:00', () => {
      expect(timer.formatTime(0)).to.equal('00:00');
    });

    it('should format 25 minutes correctly', () => {
      expect(timer.formatTime(25 * 60)).to.equal('25:00');
    });

    it('should format 5 minutes correctly', () => {
      expect(timer.formatTime(5 * 60)).to.equal('05:00');
    });

    it('should format 90 seconds as 01:30', () => {
      expect(timer.formatTime(90)).to.equal('01:30');
    });

    it('should pad single digit seconds', () => {
      expect(timer.formatTime(65)).to.equal('01:05');
    });

    it('should format 1 second as 00:01', () => {
      expect(timer.formatTime(1)).to.equal('00:01');
    });
  });

  describe('state transitions', () => {
    it('should support idle -> running -> paused -> running -> idle (cancel)', () => {
      timer.start('work');
      expect(timer.getState()).to.equal('running');
      timer.pause();
      expect(timer.getState()).to.equal('paused');
      timer.resume();
      expect(timer.getState()).to.equal('running');
      timer.cancel();
      expect(timer.getState()).to.equal('idle');
    });

    it('should allow starting a new timer type after completion', () => {
      timer.start('work');
      for (let i = 0; i < TIMER_DURATIONS['work']; i++) {
        intervalCallback!();
      }
      // reset intervalCallback since timer completed
      intervalCallback = null;
      timer.start('short-break');
      expect(timer.getState()).to.equal('running');
      expect(timer.getCurrentType()).to.equal('short-break');
    });
  });
});
