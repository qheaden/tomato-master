import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NoteManager, NoteStorage } from '../../src/noteManager';

function makeStorage(initial: Record<string, string> = {}): NoteStorage {
  const store: Record<string, string> = { ...initial };
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
  };
}

const STORAGE_KEY = 'tomato-master:note';

describe('NoteManager - storage persistence', () => {
  let onNoteSet: ReturnType<typeof vi.fn>;
  let onNoteRequested: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onNoteSet = vi.fn();
    onNoteRequested = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('saving to storage', () => {
    it('should save note to storage when saveNote is called', () => {
      const storage = makeStorage();
      const manager = new NoteManager({ onNoteSet, onNoteRequested, storage });
      manager.saveNote('Working on auth');
      const raw = storage.getItem(STORAGE_KEY);
      expect(raw).not.toBeNull();
      const note = JSON.parse(raw!);
      expect(note.text).toBe('Working on auth');
    });

    it('should clear storage when saveNote is called with empty text', () => {
      const storage = makeStorage();
      const manager = new NoteManager({ onNoteSet, onNoteRequested, storage });
      manager.saveNote('Some note');
      manager.saveNote('');
      const raw = storage.getItem(STORAGE_KEY);
      expect(raw).toBe('');
    });

    it('should clear storage when clearNote is called', () => {
      const storage = makeStorage();
      const manager = new NoteManager({ onNoteSet, onNoteRequested, storage });
      manager.saveNote('Some note');
      manager.clearNote();
      const raw = storage.getItem(STORAGE_KEY);
      expect(raw).toBe('');
    });
  });

  describe('loading from storage', () => {
    it('should restore note from storage on construction', () => {
      const storage = makeStorage();
      const manager1 = new NoteManager({ onNoteSet, onNoteRequested, storage });
      manager1.saveNote('Persisted context');

      const manager2 = new NoteManager({ onNoteSet: vi.fn(), onNoteRequested: vi.fn(), storage });
      const note = manager2.getCurrentNote();
      expect(note).not.toBeNull();
      expect(note!.text).toBe('Persisted context');
    });

    it('should report hasNote() true when loaded from storage', () => {
      const storage = makeStorage();
      const manager1 = new NoteManager({ onNoteSet, onNoteRequested, storage });
      manager1.saveNote('Context note');

      const manager2 = new NoteManager({ onNoteSet: vi.fn(), onNoteRequested: vi.fn(), storage });
      expect(manager2.hasNote()).toBe(true);
    });

    it('should start with no note when storage is empty', () => {
      const storage = makeStorage();
      const manager = new NoteManager({ onNoteSet, onNoteRequested, storage });
      expect(manager.getCurrentNote()).toBeNull();
    });

    it('should handle corrupt storage data gracefully', () => {
      const storage = makeStorage({ [STORAGE_KEY]: 'bad data{{{' });
      const manager = new NoteManager({ onNoteSet, onNoteRequested, storage });
      expect(manager.getCurrentNote()).toBeNull();
    });

    it('should handle empty string storage value gracefully', () => {
      const storage = makeStorage({ [STORAGE_KEY]: '' });
      const manager = new NoteManager({ onNoteSet, onNoteRequested, storage });
      expect(manager.getCurrentNote()).toBeNull();
    });
  });

  describe('no storage provided', () => {
    it('should work normally without storage', () => {
      const manager = new NoteManager({ onNoteSet, onNoteRequested });
      manager.saveNote('Test note');
      expect(manager.getCurrentNote()!.text).toBe('Test note');
    });
  });
});
