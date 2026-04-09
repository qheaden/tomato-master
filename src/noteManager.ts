export interface Note {
  text: string;
  timestamp: number;
}

export interface NoteManagerConfig {
  onNoteSet: (note: Note | null) => void;
  onNoteRequested: () => void;
}

export class NoteManager {
  private currentNote: Note | null = null;
  private config: NoteManagerConfig;

  constructor(config: NoteManagerConfig) {
    this.config = config;
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
    this.config.onNoteSet(this.currentNote);
  }

  clearNote(): void {
    this.currentNote = null;
    this.config.onNoteSet(null);
  }

  getCurrentNote(): Note | null {
    return this.currentNote;
  }

  hasNote(): boolean {
    return this.currentNote !== null;
  }
}
