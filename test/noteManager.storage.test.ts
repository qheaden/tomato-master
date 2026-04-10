import { expect } from 'chai';
import sinon from 'sinon';
import { NoteManager, NoteStorage } from '../src/noteManager';

function makeStorage(initial: Record<string, string> = {}): NoteStorage {
  const store: Record<string, string> = { ...initial };
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
  };
}

const STORAGE_KEY = 'tomato-master:note';

describe('NoteManager - storage persistence', () => {
  let onNoteSet: sinon.SinonSpy;
  let onNoteRequested: sinon.SinonSpy;

  beforeEach(() => {
    onNoteSet = sinon.spy();
    onNoteRequested = sinon.spy();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('saving to storage', () => {
    it('should save note to storage when saveNote is called', () => {
      const storage = makeStorage();
      const manager = new NoteManager({ onNoteSet, onNoteRequested, storage });
      manager.saveNote('Working on auth');
      const raw = storage.getItem(STORAGE_KEY);
      expect(raw).to.not.be.null;
      const note = JSON.parse(raw!);
      expect(note.text).to.equal('Working on auth');
    });

    it('should clear storage when saveNote is called with empty text', () => {
      const storage = makeStorage();
      const manager = new NoteManager({ onNoteSet, onNoteRequested, storage });
      manager.saveNote('Some note');
      manager.saveNote('');
      const raw = storage.getItem(STORAGE_KEY);
      expect(raw).to.equal('');
    });

    it('should clear storage when clearNote is called', () => {
      const storage = makeStorage();
      const manager = new NoteManager({ onNoteSet, onNoteRequested, storage });
      manager.saveNote('Some note');
      manager.clearNote();
      const raw = storage.getItem(STORAGE_KEY);
      expect(raw).to.equal('');
    });
  });

  describe('loading from storage', () => {
    it('should restore note from storage on construction', () => {
      const storage = makeStorage();
      const manager1 = new NoteManager({ onNoteSet, onNoteRequested, storage });
      manager1.saveNote('Persisted context');

      const manager2 = new NoteManager({ onNoteSet: sinon.spy(), onNoteRequested: sinon.spy(), storage });
      const note = manager2.getCurrentNote();
      expect(note).to.not.be.null;
      expect(note!.text).to.equal('Persisted context');
    });

    it('should report hasNote() true when loaded from storage', () => {
      const storage = makeStorage();
      const manager1 = new NoteManager({ onNoteSet, onNoteRequested, storage });
      manager1.saveNote('Context note');

      const manager2 = new NoteManager({ onNoteSet: sinon.spy(), onNoteRequested: sinon.spy(), storage });
      expect(manager2.hasNote()).to.be.true;
    });

    it('should start with no note when storage is empty', () => {
      const storage = makeStorage();
      const manager = new NoteManager({ onNoteSet, onNoteRequested, storage });
      expect(manager.getCurrentNote()).to.be.null;
    });

    it('should handle corrupt storage data gracefully', () => {
      const storage = makeStorage({ [STORAGE_KEY]: 'bad data{{{' });
      const manager = new NoteManager({ onNoteSet, onNoteRequested, storage });
      expect(manager.getCurrentNote()).to.be.null;
    });

    it('should handle empty string storage value gracefully', () => {
      const storage = makeStorage({ [STORAGE_KEY]: '' });
      const manager = new NoteManager({ onNoteSet, onNoteRequested, storage });
      expect(manager.getCurrentNote()).to.be.null;
    });
  });

  describe('no storage provided', () => {
    it('should work normally without storage', () => {
      const manager = new NoteManager({ onNoteSet, onNoteRequested });
      manager.saveNote('Test note');
      expect(manager.getCurrentNote()!.text).to.equal('Test note');
    });
  });
});
