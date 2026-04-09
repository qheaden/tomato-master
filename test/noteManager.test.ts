import { expect } from 'chai';
import sinon from 'sinon';
import { NoteManager, Note } from '../src/noteManager';

describe('NoteManager', () => {
  let onNoteSet: sinon.SinonSpy;
  let onNoteRequested: sinon.SinonSpy;
  let noteManager: NoteManager;

  beforeEach(() => {
    onNoteSet = sinon.spy();
    onNoteRequested = sinon.spy();
    noteManager = new NoteManager({ onNoteSet, onNoteRequested });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('initial state', () => {
    it('should have no current note initially', () => {
      expect(noteManager.getCurrentNote()).to.be.null;
    });

    it('should report hasNote() as false initially', () => {
      expect(noteManager.hasNote()).to.be.false;
    });
  });

  describe('requestNote()', () => {
    it('should invoke onNoteRequested callback', () => {
      noteManager.requestNote();
      expect(onNoteRequested.calledOnce).to.be.true;
    });

    it('should not change the current note', () => {
      noteManager.requestNote();
      expect(noteManager.getCurrentNote()).to.be.null;
    });
  });

  describe('saveNote()', () => {
    it('should save a note with the given text', () => {
      noteManager.saveNote('Working on auth');
      const note = noteManager.getCurrentNote();
      expect(note).to.not.be.null;
      expect(note!.text).to.equal('Working on auth');
    });

    it('should trim whitespace from note text', () => {
      noteManager.saveNote('  trimmed  ');
      expect(noteManager.getCurrentNote()!.text).to.equal('trimmed');
    });

    it('should call onNoteSet with the note', () => {
      noteManager.saveNote('Test note');
      expect(onNoteSet.calledOnce).to.be.true;
      const note = onNoteSet.firstCall.args[0] as Note;
      expect(note.text).to.equal('Test note');
    });

    it('should include a timestamp when saving', () => {
      const before = Date.now();
      noteManager.saveNote('Time check');
      const after = Date.now();
      const note = noteManager.getCurrentNote()!;
      expect(note.timestamp).to.be.at.least(before);
      expect(note.timestamp).to.be.at.most(after);
    });

    it('should save null when text is empty string', () => {
      noteManager.saveNote('some note');
      noteManager.saveNote('');
      expect(noteManager.getCurrentNote()).to.be.null;
      expect(onNoteSet.lastCall.args[0]).to.be.null;
    });

    it('should save null when text is whitespace only', () => {
      noteManager.saveNote('   ');
      expect(noteManager.getCurrentNote()).to.be.null;
    });

    it('should overwrite a previous note', () => {
      noteManager.saveNote('First note');
      noteManager.saveNote('Second note');
      expect(noteManager.getCurrentNote()!.text).to.equal('Second note');
    });

    it('should call onNoteSet twice when saving twice', () => {
      noteManager.saveNote('First');
      noteManager.saveNote('Second');
      expect(onNoteSet.calledTwice).to.be.true;
    });
  });

  describe('clearNote()', () => {
    it('should remove the current note', () => {
      noteManager.saveNote('Some note');
      noteManager.clearNote();
      expect(noteManager.getCurrentNote()).to.be.null;
    });

    it('should call onNoteSet with null', () => {
      noteManager.saveNote('Note');
      onNoteSet.resetHistory();
      noteManager.clearNote();
      expect(onNoteSet.calledOnce).to.be.true;
      expect(onNoteSet.firstCall.args[0]).to.be.null;
    });

    it('should be a no-op if there is no note (still calls onNoteSet)', () => {
      noteManager.clearNote();
      expect(onNoteSet.calledWith(null)).to.be.true;
    });
  });

  describe('hasNote()', () => {
    it('should return false when no note saved', () => {
      expect(noteManager.hasNote()).to.be.false;
    });

    it('should return true after a non-empty note is saved', () => {
      noteManager.saveNote('Context note');
      expect(noteManager.hasNote()).to.be.true;
    });

    it('should return false after note is cleared', () => {
      noteManager.saveNote('Note');
      noteManager.clearNote();
      expect(noteManager.hasNote()).to.be.false;
    });

    it('should return false after saving empty text', () => {
      noteManager.saveNote('Note');
      noteManager.saveNote('');
      expect(noteManager.hasNote()).to.be.false;
    });
  });

  describe('getCurrentNote()', () => {
    it('should return the latest note after multiple saves', () => {
      noteManager.saveNote('First');
      noteManager.saveNote('Second');
      noteManager.saveNote('Third');
      expect(noteManager.getCurrentNote()!.text).to.equal('Third');
    });

    it('should return null after clearNote', () => {
      noteManager.saveNote('Note');
      noteManager.clearNote();
      expect(noteManager.getCurrentNote()).to.be.null;
    });
  });
});
