import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVideoPlayer } from './useVideoPlayer';
import { saveVideoToLibrary, saveNote } from './data';

// Mock API to prevent network calls
vi.mock('./api', () => ({
  getStreamUrl: (jobId: string) => `/stream/${jobId}`,
  getDownloadUrl: (jobId: string) => `/download/${jobId}`,
  getChapters: () => Promise.resolve(null),
  getJobData: () => Promise.resolve({}),
}));

const testVideo = {
  title: 'Test Paper: A Study',
  authors: ['Alice Smith', 'Bob Jones'],
  venue: 'ICML',
  year: 2024,
  url: 'https://arxiv.org/abs/2024.12345',
  arxivId: '2024.12345',
  duration: 40,
  scenes: [
    { id: 1, type: 'title_card', label: 'Title', duration: 10, narration: 'Intro', sectionId: null },
    { id: 2, type: 'key_point', label: 'Methods', duration: 15, narration: 'Methods', sectionId: null },
    { id: 3, type: 'conclusion', label: 'Conclusion', duration: 15, narration: 'Conclusion', sectionId: null },
  ],
  sections: [],
};

function setupVideo(id = 'test-vid') {
  saveVideoToLibrary(id, testVideo);
  return id;
}

describe('useVideoPlayer', () => {
  describe('time scaling', () => {
    it('segments match scene durations when no real duration is set', () => {
      const id = setupVideo();
      const { result } = renderHook(() => useVideoPlayer(id));

      // totalSceneDuration = 10+15+15 = 40, effectiveDuration = 40, timeScale = 1
      expect(result.current.sceneSegments).toHaveLength(3);
      expect(result.current.sceneSegments[0].startTime).toBe(0);
      expect(result.current.sceneSegments[0].endTime).toBe(10);
      expect(result.current.sceneSegments[1].startTime).toBe(10);
      expect(result.current.sceneSegments[1].endTime).toBe(25);
      expect(result.current.sceneSegments[2].startTime).toBe(25);
      expect(result.current.sceneSegments[2].endTime).toBe(40);
    });

    it('scales segment times to match real video duration', () => {
      const id = setupVideo();
      const { result } = renderHook(() => useVideoPlayer(id));

      // Simulate video metadata loading: real video is 400s, scenes total 40s → 10x scale
      act(() => {
        result.current.setRealDuration(400);
      });

      expect(result.current.effectiveDuration).toBe(400);
      expect(result.current.sceneSegments[0].startTime).toBe(0);
      expect(result.current.sceneSegments[0].endTime).toBe(100);
      expect(result.current.sceneSegments[1].startTime).toBe(100);
      expect(result.current.sceneSegments[1].endTime).toBe(250);
      expect(result.current.sceneSegments[2].startTime).toBe(250);
      expect(result.current.sceneSegments[2].endTime).toBe(400);
    });

    it('preserves segment width percentages regardless of scaling', () => {
      const id = setupVideo();
      const { result } = renderHook(() => useVideoPlayer(id));

      act(() => {
        result.current.setRealDuration(400);
      });

      expect(result.current.sceneSegments[0].widthPercent).toBe(25);
      expect(result.current.sceneSegments[1].widthPercent).toBe(37.5);
      expect(result.current.sceneSegments[2].widthPercent).toBe(37.5);
    });
  });

  describe('formatTime', () => {
    it('formats seconds into m:ss', () => {
      const id = setupVideo();
      const { result } = renderHook(() => useVideoPlayer(id));

      expect(result.current.formatTime(0)).toBe('0:00');
      expect(result.current.formatTime(65)).toBe('1:05');
      expect(result.current.formatTime(420)).toBe('7:00');
      expect(result.current.formatTime(3661)).toBe('61:01');
    });
  });

  describe('export reminder', () => {
    it('is hidden when there are no notes', () => {
      const id = setupVideo();
      const { result } = renderHook(() => useVideoPlayer(id));

      act(() => {
        result.current.setCurrentTime(39);
      });

      expect(result.current.showExportReminder).toBe(false);
    });

    it('shows when notes exist and playback reaches 90%', () => {
      const id = setupVideo();
      saveNote(id, { timestamp: 5, text: 'A note' });

      const { result } = renderHook(() => useVideoPlayer(id));

      expect(result.current.showExportReminder).toBe(false);

      act(() => {
        result.current.setCurrentTime(36); // 36/40 = 90%
      });

      expect(result.current.showExportReminder).toBe(true);
    });

    it('stays hidden after dismissal', () => {
      const id = setupVideo();
      saveNote(id, { timestamp: 5, text: 'A note' });

      const { result } = renderHook(() => useVideoPlayer(id));

      act(() => {
        result.current.setCurrentTime(38);
      });
      expect(result.current.showExportReminder).toBe(true);

      act(() => {
        result.current.setExportReminderDismissed(true);
      });
      expect(result.current.showExportReminder).toBe(false);
    });
  });

  describe('handleExportNotes', () => {
    let capturedBlob: Blob | null = null;

    beforeEach(() => {
      capturedBlob = null;
      globalThis.URL.createObjectURL = vi.fn((blob: Blob) => {
        capturedBlob = blob;
        return 'blob:mock';
      });
      globalThis.URL.revokeObjectURL = vi.fn();
    });

    it('does nothing when there are no notes', () => {
      const id = setupVideo();
      const { result } = renderHook(() => useVideoPlayer(id));

      act(() => {
        result.current.handleExportNotes();
      });

      expect(URL.createObjectURL).not.toHaveBeenCalled();
    });

    it('generates markdown with frontmatter and sorted notes', async () => {
      const id = setupVideo();
      saveNote(id, { timestamp: 120, text: 'Key insight about methods' });
      saveNote(id, { timestamp: 30, text: 'Introduction point' });

      const { result } = renderHook(() => useVideoPlayer(id));

      act(() => {
        result.current.handleExportNotes();
      });

      expect(capturedBlob).not.toBeNull();
      const text = await capturedBlob!.text();

      // Frontmatter
      expect(text).toContain('title: "Test Paper: A Study"');
      expect(text).toContain('  - "Alice Smith"');
      expect(text).toContain('  - "Bob Jones"');
      expect(text).toContain('venue: "ICML"');
      expect(text).toContain('year: 2024');
      expect(text).toContain('arxiv_id: "2024.12345"');
      expect(text).toContain('exported_at:');

      // Notes heading
      expect(text).toContain('# Notes: Test Paper: A Study');

      // Timestamps formatted correctly
      expect(text).toContain('### 0:30');
      expect(text).toContain('### 2:00');

      // Notes sorted by timestamp (30s before 120s)
      const introIdx = text.indexOf('Introduction point');
      const methodsIdx = text.indexOf('Key insight about methods');
      expect(introIdx).toBeLessThan(methodsIdx);
    });
  });

  describe('hover time', () => {
    it('defaults to null', () => {
      const id = setupVideo();
      const { result } = renderHook(() => useVideoPlayer(id));
      expect(result.current.hoverTime).toBeNull();
    });

    it('can be set and cleared', () => {
      const id = setupVideo();
      const { result } = renderHook(() => useVideoPlayer(id));

      act(() => {
        result.current.setHoverTime(15.5);
      });
      expect(result.current.hoverTime).toBe(15.5);

      act(() => {
        result.current.setHoverTime(null);
      });
      expect(result.current.hoverTime).toBeNull();
    });
  });
});
