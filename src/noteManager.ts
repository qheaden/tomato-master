export interface Note {
  text: string;
  timestamp: number;
}

export interface NoteStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface NoteManagerConfig {
  onNoteSet: (note: Note | null) => void;
  onNoteRequested: () => void;
  storage?: NoteStorage;
}

const STORAGE_KEY = 'tomato-master:note';

export class NoteManager {
  private currentNote: Note | null = null;
  private config: NoteManagerConfig;
  private storage: NoteStorage | null;

  constructor(config: NoteManagerConfig) {
    this.config = config;
    this.storage = config.storage ?? null;
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    if (!this.storage) return;
    const raw = this.storage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const note: Note = JSON.parse(raw);
      if (note && note.text) {
        this.currentNote = note;
      }
    } catch {
      // ignore corrupt data
    }
  }

  private saveToStorage(): void {
    if (!this.storage) return;
    if (this.currentNote) {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.currentNote));
    } else {
      this.storage.setItem(STORAGE_KEY, '');
    }
  }

  requestNote(): void {
    this.config.onNoteRequested();
  }

  saveNote(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) {
      this.currentNote = null;
    } else {
      this.currentNote = {
        text: trimmed,
        timestamp: Date.now(),
      };
    }
    this.saveToStorage();
    this.config.onNoteSet(this.currentNote);
  }

  clearNote(): void {
    this.currentNote = null;
    this.saveToStorage();
    this.config.onNoteSet(null);
  }

  getCurrentNote(): Note | null {
    return this.currentNote;
  }

  hasNote(): boolean {
    return this.currentNote !== null;
  }
}
