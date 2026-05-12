import { expect } from 'chai';
import { YouTubePlaybackState, PlaybackStorage } from '../../src/youtubePlaybackState';

function makeStorage(initial: Record<string, string> = {}): PlaybackStorage {
  const store: Record<string, string> = { ...initial };
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
  };
}

describe('YouTubePlaybackState', () => {
  describe('save()', () => {
    it('writes index and position to storage', () => {
      const storage = makeStorage();
      const state = new YouTubePlaybackState(storage);
      state.save(3, 142.5);
      expect(storage.getItem(YouTubePlaybackState.INDEX_KEY)).to.equal('3');
      expect(storage.getItem(YouTubePlaybackState.POSITION_KEY)).to.equal('142.5');
    });

    it('overwrites previously saved values', () => {
      const storage = makeStorage();
      const state = new YouTubePlaybackState(storage);
      state.save(0, 10);
      state.save(2, 99.9);
      expect(storage.getItem(YouTubePlaybackState.INDEX_KEY)).to.equal('2');
      expect(storage.getItem(YouTubePlaybackState.POSITION_KEY)).to.equal('99.9');
    });
  });

  describe('load()', () => {
    it('returns null when storage is empty', () => {
      const storage = makeStorage();
      const state = new YouTubePlaybackState(storage);
      expect(state.load()).to.be.null;
    });

    it('returns null when only index key is present', () => {
      const storage = makeStorage({ [YouTubePlaybackState.INDEX_KEY]: '1' });
      const state = new YouTubePlaybackState(storage);
      expect(state.load()).to.be.null;
    });

    it('returns null when only position key is present', () => {
      const storage = makeStorage({ [YouTubePlaybackState.POSITION_KEY]: '30' });
      const state = new YouTubePlaybackState(storage);
      expect(state.load()).to.be.null;
    });

    it('returns parsed index and position when both keys are present', () => {
      const storage = makeStorage({
        [YouTubePlaybackState.INDEX_KEY]: '4',
        [YouTubePlaybackState.POSITION_KEY]: '73.25',
      });
      const state = new YouTubePlaybackState(storage);
      const result = state.load();
      expect(result).to.deep.equal({ index: 4, position: 73.25 });
    });

    it('returns null when index value is not a number', () => {
      const storage = makeStorage({
        [YouTubePlaybackState.INDEX_KEY]: 'bad',
        [YouTubePlaybackState.POSITION_KEY]: '30',
      });
      const state = new YouTubePlaybackState(storage);
      expect(state.load()).to.be.null;
    });

    it('returns null when position value is not a number', () => {
      const storage = makeStorage({
        [YouTubePlaybackState.INDEX_KEY]: '1',
        [YouTubePlaybackState.POSITION_KEY]: 'bad',
      });
      const state = new YouTubePlaybackState(storage);
      expect(state.load()).to.be.null;
    });

    it('round-trips a saved state correctly', () => {
      const storage = makeStorage();
      const state = new YouTubePlaybackState(storage);
      state.save(7, 222.75);
      expect(state.load()).to.deep.equal({ index: 7, position: 222.75 });
    });
  });

  describe('clear()', () => {
    it('removes both keys from storage', () => {
      const storage = makeStorage();
      const state = new YouTubePlaybackState(storage);
      state.save(1, 50);
      state.clear();
      expect(storage.getItem(YouTubePlaybackState.INDEX_KEY)).to.be.null;
      expect(storage.getItem(YouTubePlaybackState.POSITION_KEY)).to.be.null;
    });

    it('load() returns null after clear()', () => {
      const storage = makeStorage();
      const state = new YouTubePlaybackState(storage);
      state.save(2, 100);
      state.clear();
      expect(state.load()).to.be.null;
    });

    it('does not throw when storage is already empty', () => {
      const storage = makeStorage();
      const state = new YouTubePlaybackState(storage);
      expect(() => state.clear()).to.not.throw();
    });
  });
});
