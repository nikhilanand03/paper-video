import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  statusToStageIndex,
  getStreamUrl,
  getDownloadUrl,
  uploadPdf,
  checkBackend,
} from './api';

describe('statusToStageIndex', () => {
  it('maps "queued" to 0', () => {
    expect(statusToStageIndex('queued')).toBe(0);
  });

  it('maps "extracting" to 0', () => {
    expect(statusToStageIndex('extracting')).toBe(0);
  });

  it('maps "planning" to 1', () => {
    expect(statusToStageIndex('planning')).toBe(1);
  });

  it('maps "rendering" to 2', () => {
    expect(statusToStageIndex('rendering')).toBe(2);
  });

  it('maps "synthesizing_tts" to 3', () => {
    expect(statusToStageIndex('synthesizing_tts')).toBe(3);
  });

  it('maps "assembling" to 4', () => {
    expect(statusToStageIndex('assembling')).toBe(4);
  });

  it('maps "done" to 5', () => {
    expect(statusToStageIndex('done')).toBe(5);
  });

  it('maps "failed" to -1', () => {
    expect(statusToStageIndex('failed')).toBe(-1);
  });
});

describe('getStreamUrl', () => {
  it('returns the correct streaming path', () => {
    expect(getStreamUrl('abc123')).toContain('/stream/abc123');
  });
});

describe('getDownloadUrl', () => {
  it('returns the correct download path', () => {
    expect(getDownloadUrl('abc123')).toContain('/download/abc123');
  });
});

describe('uploadPdf', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uploads a file and returns the job_id on success', async () => {
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve({ job_id: 'job-42' }),
    };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const file = new File(['dummy pdf'], 'paper.pdf', { type: 'application/pdf' });
    const jobId = await uploadPdf(file);

    expect(jobId).toBe('job-42');
    expect(fetch).toHaveBeenCalledTimes(1);

    const [url, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain('/upload');
    expect(options.method).toBe('POST');
    expect(options.body).toBeInstanceOf(FormData);
  });

  it('throws on a 400 response', async () => {
    const mockResponse = {
      ok: false,
      statusText: 'Bad Request',
      json: () => Promise.resolve({ detail: 'Invalid PDF' }),
    };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const file = new File(['bad'], 'bad.pdf', { type: 'application/pdf' });
    await expect(uploadPdf(file)).rejects.toThrow('Invalid PDF');
  });
});

describe('checkBackend', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns true when the backend is reachable', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
    const result = await checkBackend();
    expect(result).toBe(true);
  });

  it('returns false when the backend is unreachable', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));
    const result = await checkBackend();
    expect(result).toBe(false);
  });
});
