import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NoteManager, Note } from '../../src/noteManager';

describe('NoteManager', () => {
  let onNoteSet: ReturnType<typeof vi.fn>;
  let onNoteRequested: ReturnType<typeof vi.fn>;
  let noteManager: NoteManager;

  beforeEach(() => {
    onNoteSet = vi.fn();
    onNoteRequested = vi.fn();
    noteManager = new NoteManager({ onNoteSet, onNoteRequested });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('should have no current note initially', () => {
      expect(noteManager.getCurrentNote()).toBeNull();
    });

    it('should report hasNote() as false initially', () => {
      expect(noteManager.hasNote()).toBe(false);
    });
  });

  describe('requestNote()', () => {
    it('should invoke onNoteRequested callback', () => {
      noteManager.requestNote();
      expect(onNoteRequested).toHaveBeenCalledTimes(1);
    });

    it('should not change the current note', () => {
      noteManager.requestNote();
      expect(noteManager.getCurrentNote()).toBeNull();
    });
  });

  describe('saveNote()', () => {
    it('should save a note with the given text', () => {
      noteManager.saveNote('Working on auth');
      const note = noteManager.getCurrentNote();
      expect(note).not.toBeNull();
      expect(note!.text).toBe('Working on auth');
    });

    it('should trim whitespace from note text', () => {
      noteManager.saveNote('  trimmed  ');
      expect(noteManager.getCurrentNote()!.text).toBe('trimmed');
    });

    it('should call onNoteSet with the note', () => {
      noteManager.saveNote('Test note');
      expect(onNoteSet).toHaveBeenCalledTimes(1);
      const note = onNoteSet.mock.calls[0][0] as Note;
      expect(note.text).toBe('Test note');
    });

    it('should include a timestamp when saving', () => {
      const before = Date.now();
      noteManager.saveNote('Time check');
      const after = Date.now();
      const note = noteManager.getCurrentNote()!;
      expect(note.timestamp).toBeGreaterThanOrEqual(before);
      expect(note.timestamp).toBeLessThanOrEqual(after);
    });

    it('should save null when text is empty string', () => {
      noteManager.saveNote('some note');
      noteManager.saveNote('');
      expect(noteManager.getCurrentNote()).toBeNull();
      expect(onNoteSet.mock.calls.at(-1)?.[0]).toBeNull();
    });

    it('should save null when text is whitespace only', () => {
      noteManager.saveNote('   ');
      expect(noteManager.getCurrentNote()).toBeNull();
    });

    it('should overwrite a previous note', () => {
      noteManager.saveNote('First note');
      noteManager.saveNote('Second note');
      expect(noteManager.getCurrentNote()!.text).toBe('Second note');
    });

    it('should call onNoteSet twice when saving twice', () => {
      noteManager.saveNote('First');
      noteManager.saveNote('Second');
      expect(onNoteSet).toHaveBeenCalledTimes(2);
    });
  });

  describe('clearNote()', () => {
    it('should remove the current note', () => {
      noteManager.saveNote('Some note');
      noteManager.clearNote();
      expect(noteManager.getCurrentNote()).toBeNull();
    });

    it('should call onNoteSet with null', () => {
      noteManager.saveNote('Note');
      onNoteSet.mockClear();
      noteManager.clearNote();
      expect(onNoteSet).toHaveBeenCalledTimes(1);
      expect(onNoteSet.mock.calls[0][0]).toBeNull();
    });

    it('should be a no-op if there is no note (still calls onNoteSet)', () => {
      noteManager.clearNote();
      expect(onNoteSet).toHaveBeenCalledWith(null);
    });
  });

  describe('hasNote()', () => {
    it('should return false when no note saved', () => {
      expect(noteManager.hasNote()).toBe(false);
    });

    it('should return true after a non-empty note is saved', () => {
      noteManager.saveNote('Context note');
      expect(noteManager.hasNote()).toBe(true);
    });

    it('should return false after note is cleared', () => {
      noteManager.saveNote('Note');
      noteManager.clearNote();
      expect(noteManager.hasNote()).toBe(false);
    });

    it('should return false after saving empty text', () => {
      noteManager.saveNote('Note');
      noteManager.saveNote('');
      expect(noteManager.hasNote()).toBe(false);
    });
  });

  describe('getCurrentNote()', () => {
    it('should return the latest note after multiple saves', () => {
      noteManager.saveNote('First');
      noteManager.saveNote('Second');
      noteManager.saveNote('Third');
      expect(noteManager.getCurrentNote()!.text).toBe('Third');
    });

    it('should return null after clearNote', () => {
      noteManager.saveNote('Note');
      noteManager.clearNote();
      expect(noteManager.getCurrentNote()).toBeNull();
    });
  });
});
