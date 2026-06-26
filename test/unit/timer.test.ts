import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PomodoroTimer, TIMER_DURATIONS } from '../../src/timer';

describe('PomodoroTimer', () => {
  let tickSpy: ReturnType<typeof vi.fn>;
  let completeSpy: ReturnType<typeof vi.fn>;
  let stateChangeSpy: ReturnType<typeof vi.fn>;
  let fakeSetInterval: ReturnType<typeof vi.fn>;
  let fakeClearInterval: ReturnType<typeof vi.fn>;
  let intervalCallback: (() => void) | null;
  let timer: PomodoroTimer;

  beforeEach(() => {
    tickSpy = vi.fn();
    completeSpy = vi.fn();
    stateChangeSpy = vi.fn();
    intervalCallback = null;

    fakeSetInterval = vi.fn((fn: () => void) => {
      intervalCallback = fn;
      return 999;
    });
    fakeClearInterval = vi.fn();

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
    vi.restoreAllMocks();
  });

  describe('TIMER_DURATIONS', () => {
    it('should have 25 min for work', () => {
      expect(TIMER_DURATIONS.work).toBe(25 * 60);
    });
    it('should have 5 min for short-break', () => {
      expect(TIMER_DURATIONS['short-break']).toBe(5 * 60);
    });
    it('should have 15 min for long-break', () => {
      expect(TIMER_DURATIONS['long-break']).toBe(15 * 60);
    });
  });

  describe('initial state', () => {
    it('should start in idle state', () => {
      expect(timer.getState()).toBe('idle');
    });
    it('should have no current type', () => {
      expect(timer.getCurrentType()).toBeNull();
    });
    it('should have 0 remaining', () => {
      expect(timer.getRemaining()).toBe(0);
    });
  });

  describe('start()', () => {
    it('should set state to running when started', () => {
      timer.start('work');
      expect(timer.getState()).toBe('running');
    });

    it('should set the current type', () => {
      timer.start('work');
      expect(timer.getCurrentType()).toBe('work');
    });

    it('should set remaining to full duration on first start', () => {
      timer.start('work');
      expect(timer.getRemaining()).toBe(TIMER_DURATIONS.work);
    });

    it('should call onStateChange with running state', () => {
      timer.start('work');
      expect(stateChangeSpy).toHaveBeenCalledWith('running', 'work');
    });

    it('should call onTick immediately with remaining seconds', () => {
      timer.start('work');
      expect(tickSpy).toHaveBeenCalled();
      expect(tickSpy.mock.calls[0][0]).toBe(TIMER_DURATIONS.work);
    });

    it('should start setInterval', () => {
      timer.start('work');
      expect(fakeSetInterval).toHaveBeenCalledTimes(1);
    });

    it('should not start again if already running', () => {
      timer.start('work');
      timer.start('work');
      expect(fakeSetInterval).toHaveBeenCalledTimes(1);
    });

    it('should work for short-break type', () => {
      timer.start('short-break');
      expect(timer.getCurrentType()).toBe('short-break');
      expect(timer.getRemaining()).toBe(TIMER_DURATIONS['short-break']);
    });

    it('should work for long-break type', () => {
      timer.start('long-break');
      expect(timer.getCurrentType()).toBe('long-break');
      expect(timer.getRemaining()).toBe(TIMER_DURATIONS['long-break']);
    });
  });

  describe('tick behavior', () => {
    it('should decrement remaining each tick', () => {
      timer.start('work');
      intervalCallback!();
      expect(timer.getRemaining()).toBe(TIMER_DURATIONS.work - 1);
    });

    it('should call onTick on each interval', () => {
      timer.start('work');
      const initialCallCount = tickSpy.mock.calls.length;
      intervalCallback!();
      expect(tickSpy).toHaveBeenCalledTimes(initialCallCount + 1);
    });

    it('should complete timer when remaining reaches 0', () => {
      timer.start('work');
      for (let i = 0; i < TIMER_DURATIONS.work - 1; i++) {
        intervalCallback!();
      }
      expect(completeSpy).not.toHaveBeenCalled();
      intervalCallback!();
      expect(completeSpy).toHaveBeenCalledTimes(1);
      expect(completeSpy).toHaveBeenCalledWith('work');
    });

    it('should return to idle after completion', () => {
      timer.start('work');
      for (let i = 0; i < TIMER_DURATIONS.work; i++) {
        intervalCallback!();
      }
      expect(timer.getState()).toBe('idle');
    });

    it('should clear interval after completion', () => {
      timer.start('work');
      for (let i = 0; i < TIMER_DURATIONS.work; i++) {
        intervalCallback!();
      }
      expect(fakeClearInterval).toHaveBeenCalledTimes(1);
    });
  });

  describe('pause()', () => {
    it('should set state to paused', () => {
      timer.start('work');
      timer.pause();
      expect(timer.getState()).toBe('paused');
    });

    it('should call onStateChange with paused', () => {
      timer.start('work');
      timer.pause();
      expect(stateChangeSpy).toHaveBeenCalledWith('paused', 'work');
    });

    it('should clear the interval', () => {
      timer.start('work');
      timer.pause();
      expect(fakeClearInterval).toHaveBeenCalledTimes(1);
    });

    it('should preserve remaining time on pause', () => {
      timer.start('work');
      intervalCallback!();
      intervalCallback!();
      const remaining = timer.getRemaining();
      timer.pause();
      expect(timer.getRemaining()).toBe(remaining);
    });

    it('should do nothing if not running', () => {
      timer.pause();
      expect(timer.getState()).toBe('idle');
      expect(stateChangeSpy).not.toHaveBeenCalled();
    });
  });

  describe('resume()', () => {
    it('should resume from paused state', () => {
      timer.start('work');
      timer.pause();
      timer.resume();
      expect(timer.getState()).toBe('running');
    });

    it('should continue from remaining time (not reset)', () => {
      timer.start('work');
      intervalCallback!();
      intervalCallback!();
      const remaining = timer.getRemaining();
      timer.pause();
      timer.resume();
      expect(timer.getRemaining()).toBe(remaining);
    });

    it('should do nothing if not paused', () => {
      timer.resume();
      expect(timer.getState()).toBe('idle');
    });

    it('should start a new interval on resume', () => {
      timer.start('work');
      timer.pause();
      timer.resume();
      expect(fakeSetInterval).toHaveBeenCalledTimes(2);
    });
  });

  describe('cancel()', () => {
    it('should set state to idle', () => {
      timer.start('work');
      timer.cancel();
      expect(timer.getState()).toBe('idle');
    });

    it('should clear current type and remaining', () => {
      timer.start('work');
      timer.cancel();
      expect(timer.getCurrentType()).toBeNull();
      expect(timer.getRemaining()).toBe(0);
    });

    it('should call onStateChange with idle', () => {
      timer.start('work');
      timer.cancel();
      expect(stateChangeSpy).toHaveBeenCalledWith('idle', null);
    });

    it('should trigger onComplete with work type when cancelling a work timer', () => {
      timer.start('work');
      timer.cancel();
      expect(completeSpy).toHaveBeenCalledTimes(1);
      expect(completeSpy).toHaveBeenCalledWith('work');
    });

    it('should NOT trigger onComplete when cancelling a short-break timer', () => {
      timer.start('short-break');
      timer.cancel();
      expect(completeSpy).not.toHaveBeenCalled();
    });

    it('should NOT trigger onComplete when cancelling a long-break timer', () => {
      timer.start('long-break');
      timer.cancel();
      expect(completeSpy).not.toHaveBeenCalled();
    });

    it('should do nothing if timer is idle', () => {
      timer.cancel();
      expect(stateChangeSpy).not.toHaveBeenCalled();
    });

    it('should cancel a paused timer', () => {
      timer.start('work');
      timer.pause();
      timer.cancel();
      expect(timer.getState()).toBe('idle');
      expect(completeSpy).toHaveBeenCalledWith('work');
    });

    it('should clear interval on cancel', () => {
      timer.start('work');
      timer.cancel();
      expect(fakeClearInterval).toHaveBeenCalledTimes(1);
    });
  });

  describe('formatTime()', () => {
    it('should format 0 seconds as 00:00', () => {
      expect(timer.formatTime(0)).toBe('00:00');
    });

    it('should format 25 minutes correctly', () => {
      expect(timer.formatTime(25 * 60)).toBe('25:00');
    });

    it('should format 5 minutes correctly', () => {
      expect(timer.formatTime(5 * 60)).toBe('05:00');
    });

    it('should format 90 seconds as 01:30', () => {
      expect(timer.formatTime(90)).toBe('01:30');
    });

    it('should pad single digit seconds', () => {
      expect(timer.formatTime(65)).toBe('01:05');
    });

    it('should format 1 second as 00:01', () => {
      expect(timer.formatTime(1)).toBe('00:01');
    });
  });

  describe('state transitions', () => {
    it('should support idle -> running -> paused -> running -> idle (cancel)', () => {
      timer.start('work');
      expect(timer.getState()).toBe('running');
      timer.pause();
      expect(timer.getState()).toBe('paused');
      timer.resume();
      expect(timer.getState()).toBe('running');
      timer.cancel();
      expect(timer.getState()).toBe('idle');
    });

    it('should allow starting a new timer type after completion', () => {
      timer.start('work');
      for (let i = 0; i < TIMER_DURATIONS.work; i++) {
        intervalCallback!();
      }
      intervalCallback = null;
      timer.start('short-break');
      expect(timer.getState()).toBe('running');
      expect(timer.getCurrentType()).toBe('short-break');
    });
  });
});
