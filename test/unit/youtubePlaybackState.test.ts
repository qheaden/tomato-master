import { describe, expect, it } from 'vitest';
import { YouTubePlaybackState, PlaybackStorage } from '../../src/youtubePlaybackState';

function makeStorage(initial: Record<string, string> = {}): PlaybackStorage {
  const store: Record<string, string> = { ...initial };
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
  };
}

describe('YouTubePlaybackState', () => {
  describe('save()', () => {
    it('writes index and position to storage', () => {
      const storage = makeStorage();
      const state = new YouTubePlaybackState(storage);
      state.save(3, 142.5);
      expect(storage.getItem(YouTubePlaybackState.INDEX_KEY)).toBe('3');
      expect(storage.getItem(YouTubePlaybackState.POSITION_KEY)).toBe('142.5');
    });

    it('overwrites previously saved values', () => {
      const storage = makeStorage();
      const state = new YouTubePlaybackState(storage);
      state.save(0, 10);
      state.save(2, 99.9);
      expect(storage.getItem(YouTubePlaybackState.INDEX_KEY)).toBe('2');
      expect(storage.getItem(YouTubePlaybackState.POSITION_KEY)).toBe('99.9');
    });
  });

  describe('load()', () => {
    it('returns null when storage is empty', () => {
      const storage = makeStorage();
      const state = new YouTubePlaybackState(storage);
      expect(state.load()).toBeNull();
    });

    it('returns null when only index key is present', () => {
      const storage = makeStorage({ [YouTubePlaybackState.INDEX_KEY]: '1' });
      const state = new YouTubePlaybackState(storage);
      expect(state.load()).toBeNull();
    });

    it('returns null when only position key is present', () => {
      const storage = makeStorage({ [YouTubePlaybackState.POSITION_KEY]: '30' });
      const state = new YouTubePlaybackState(storage);
      expect(state.load()).toBeNull();
    });

    it('returns parsed index and position when both keys are present', () => {
      const storage = makeStorage({
        [YouTubePlaybackState.INDEX_KEY]: '4',
        [YouTubePlaybackState.POSITION_KEY]: '73.25',
      });
      const state = new YouTubePlaybackState(storage);
      const result = state.load();
      expect(result).toEqual({ index: 4, position: 73.25 });
    });

    it('returns null when index value is not a number', () => {
      const storage = makeStorage({
        [YouTubePlaybackState.INDEX_KEY]: 'bad',
        [YouTubePlaybackState.POSITION_KEY]: '30',
      });
      const state = new YouTubePlaybackState(storage);
      expect(state.load()).toBeNull();
    });

    it('returns null when position value is not a number', () => {
      const storage = makeStorage({
        [YouTubePlaybackState.INDEX_KEY]: '1',
        [YouTubePlaybackState.POSITION_KEY]: 'bad',
      });
      const state = new YouTubePlaybackState(storage);
      expect(state.load()).toBeNull();
    });

    it('round-trips a saved state correctly', () => {
      const storage = makeStorage();
      const state = new YouTubePlaybackState(storage);
      state.save(7, 222.75);
      expect(state.load()).toEqual({ index: 7, position: 222.75 });
    });
  });

  describe('clear()', () => {
    it('removes both keys from storage', () => {
      const storage = makeStorage();
      const state = new YouTubePlaybackState(storage);
      state.save(1, 50);
      state.clear();
      expect(storage.getItem(YouTubePlaybackState.INDEX_KEY)).toBeNull();
      expect(storage.getItem(YouTubePlaybackState.POSITION_KEY)).toBeNull();
    });

    it('load() returns null after clear()', () => {
      const storage = makeStorage();
      const state = new YouTubePlaybackState(storage);
      state.save(2, 100);
      state.clear();
      expect(state.load()).toBeNull();
    });

    it('does not throw when storage is already empty', () => {
      const storage = makeStorage();
      const state = new YouTubePlaybackState(storage);
      expect(() => state.clear()).not.toThrow();
    });
  });
});
