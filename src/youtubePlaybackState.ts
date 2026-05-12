export interface PlaybackState {
  index: number;
  position: number;
}

export interface PlaybackStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class YouTubePlaybackState {
  static readonly INDEX_KEY = 'youtube-playlist-index';
  static readonly POSITION_KEY = 'youtube-playlist-position';

  private storage: PlaybackStorage;

  constructor(storage: PlaybackStorage = localStorage) {
    this.storage = storage;
  }

  save(index: number, position: number): void {
    this.storage.setItem(YouTubePlaybackState.INDEX_KEY, String(index));
    this.storage.setItem(YouTubePlaybackState.POSITION_KEY, String(position));
  }

  load(): PlaybackState | null {
    const index = this.storage.getItem(YouTubePlaybackState.INDEX_KEY);
    const position = this.storage.getItem(YouTubePlaybackState.POSITION_KEY);
    if (index === null || position === null) return null;
    const parsedIndex = parseInt(index, 10);
    const parsedPosition = parseFloat(position);
    if (isNaN(parsedIndex) || isNaN(parsedPosition)) return null;
    return { index: parsedIndex, position: parsedPosition };
  }

  clear(): void {
    this.storage.removeItem(YouTubePlaybackState.INDEX_KEY);
    this.storage.removeItem(YouTubePlaybackState.POSITION_KEY);
  }
}
