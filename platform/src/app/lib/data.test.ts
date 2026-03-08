import { describe, it, expect } from 'vitest';
import {
  getOrCreateVideoId,
  saveVideoToLibrary,
  getLibrary,
  getVideoById,
  incrementViewCount,
  saveNote,
  getNotes,
  deleteNote,
  examplePapers,
  templateInfo,
  templateTypes,
} from './data';

describe('getOrCreateVideoId', () => {
  it('returns a consistent ID for the same paperId', () => {
    const id1 = getOrCreateVideoId('paper-a');
    const id2 = getOrCreateVideoId('paper-a');
    expect(id1).toBe(id2);
  });

  it('returns different IDs for different paperIds', () => {
    const id1 = getOrCreateVideoId('paper-x');
    const id2 = getOrCreateVideoId('paper-y');
    expect(id1).not.toBe(id2);
  });
});

describe('saveVideoToLibrary + getLibrary round-trip', () => {
  it('saves a video and retrieves it from the library', () => {
    const paperData = {
      title: 'Test Paper',
      authors: ['Alice', 'Bob'],
      duration: 60,
    };

    saveVideoToLibrary('vid-1', paperData);
    const library = getLibrary();

    expect(library).toHaveLength(1);
    expect(library[0].id).toBe('vid-1');
    expect(library[0].title).toBe('Test Paper');
    expect(library[0].authors).toEqual(['Alice', 'Bob']);
    expect(library[0].views).toBe(0);
    expect(library[0].generatedAt).toBeDefined();
  });

  it('updates an existing entry rather than duplicating', () => {
    saveVideoToLibrary('vid-2', { title: 'First', authors: [] });
    saveVideoToLibrary('vid-2', { title: 'Updated', authors: [] });

    const library = getLibrary();
    const matches = library.filter((v: any) => v.id === 'vid-2');
    expect(matches).toHaveLength(1);
    expect(matches[0].title).toBe('Updated');
  });
});

describe('incrementViewCount', () => {
  it('increments the view count of a saved video', () => {
    saveVideoToLibrary('vid-views', { title: 'Views Paper', authors: [] });

    incrementViewCount('vid-views');
    incrementViewCount('vid-views');

    const video = getVideoById('vid-views');
    expect(video.views).toBe(2);
  });

  it('does nothing for a non-existent video', () => {
    // Should not throw
    incrementViewCount('nonexistent');
    expect(getLibrary()).toHaveLength(0);
  });
});

describe('saveNote + getNotes + deleteNote cycle', () => {
  it('saves, retrieves, and deletes notes', () => {
    const videoId = 'vid-notes';

    // Initially empty
    expect(getNotes(videoId)).toHaveLength(0);

    // Save two notes
    saveNote(videoId, { timestamp: 10, text: 'First note' });
    saveNote(videoId, { timestamp: 25, text: 'Second note' });

    const notes = getNotes(videoId);
    expect(notes).toHaveLength(2);
    expect(notes[0].text).toBe('First note');
    expect(notes[0].timestamp).toBe(10);
    expect(notes[1].text).toBe('Second note');

    // Delete the first note
    deleteNote(videoId, notes[0].id);
    const remaining = getNotes(videoId);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].text).toBe('Second note');
  });
});

describe('getVideoById', () => {
  it('returns the video with the matching ID', () => {
    saveVideoToLibrary('find-me', { title: 'Findable', authors: ['X'] });
    const video = getVideoById('find-me');
    expect(video).toBeDefined();
    expect(video.title).toBe('Findable');
  });

  it('returns undefined for a missing ID', () => {
    expect(getVideoById('does-not-exist')).toBeUndefined();
  });
});

describe('examplePapers', () => {
  it('has at least 3 entries', () => {
    expect(examplePapers.length).toBeGreaterThanOrEqual(3);
  });

  it('contains the Attention paper', () => {
    const attention = examplePapers.find((p) => p.id === 'attention');
    expect(attention).toBeDefined();
    expect(attention!.title).toMatch(/Attention/i);
  });

  it('contains the BERT paper', () => {
    const bert = examplePapers.find((p) => p.id === 'bert');
    expect(bert).toBeDefined();
  });

  it('contains the AlphaFold paper', () => {
    const af = examplePapers.find((p) => p.id === 'alphafold');
    expect(af).toBeDefined();
  });
});

describe('templateInfo', () => {
  it('has an entry for every templateType', () => {
    for (const t of templateTypes) {
      expect(templateInfo[t]).toBeDefined();
      expect(templateInfo[t].label).toBeTruthy();
      expect(templateInfo[t].category).toMatch(/^(layout|chart)$/);
    }
  });
});
