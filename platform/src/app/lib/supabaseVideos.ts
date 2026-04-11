// Supabase CRUD for the `videos` table

import { supabase } from './supabase';

interface VideoInsert {
  title: string;
  authors?: string[];
  venue?: string;
  year?: number;
  url?: string;
  arxiv_id?: string;
  abstract?: string;
  sections?: any[];
  scenes?: any[];
  duration?: number;
  blob_url?: string | null;
  is_sample?: boolean;
  generated_at?: string;
}

/** Upsert a video for the given user. */
export async function saveVideoToSupabase(
  userId: string,
  jobId: string,
  data: VideoInsert
): Promise<void> {
  const { error } = await supabase.from('videos').upsert(
    {
      user_id: userId,
      job_id: jobId,
      title: data.title,
      authors: data.authors ?? [],
      venue: data.venue ?? null,
      year: data.year ?? null,
      url: data.url ?? null,
      arxiv_id: data.arxiv_id ?? null,
      abstract: data.abstract ?? null,
      sections: data.sections ?? [],
      scenes: data.scenes ?? [],
      duration: data.duration ?? 0,
      blob_url: data.blob_url ?? null,
      is_sample: data.is_sample ?? false,
      generated_at: data.generated_at ?? new Date().toISOString(),
    },
    { onConflict: 'user_id,job_id' }
  );
  if (error) {
    console.error('Failed to save video to Supabase:', error);
    throw error;
  }
}

/** Map a Supabase row to the camelCase shape the frontend expects. */
function mapRow(row: any) {
  return {
    id: row.job_id,
    title: row.title,
    authors: row.authors ?? [],
    venue: row.venue,
    year: row.year,
    url: row.url,
    arxivId: row.arxiv_id,
    abstract: row.abstract,
    sections: row.sections ?? [],
    scenes: row.scenes ?? [],
    duration: row.duration ?? 0,
    blobUrl: row.blob_url,
    isSample: row.is_sample,
    realJobId: row.job_id,
    generatedAt: row.generated_at,
    views: 0,
  };
}

/** Load all videos for a user, newest first. */
export async function getLibraryFromSupabase(userId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .eq('user_id', userId)
    .order('generated_at', { ascending: false });

  if (error) {
    console.error('Failed to load library from Supabase:', error);
    return [];
  }
  return (data ?? []).map(mapRow);
}

/** Get a single video by job_id. */
export async function getVideoFromSupabase(
  userId: string,
  jobId: string
): Promise<any | null> {
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .eq('user_id', userId)
    .eq('job_id', jobId)
    .maybeSingle();

  if (error || !data) return null;
  return mapRow(data);
}

/** Sync localStorage videos to Supabase (handles migration + logged-out-then-in). */
export async function syncLocalLibraryToSupabase(
  userId: string,
  localLibrary: any[]
): Promise<number> {
  // Only sync real videos (not samples) that have a realJobId
  const candidates = localLibrary.filter(
    (v: any) => v.realJobId && !v.isSample
  );
  if (candidates.length === 0) return 0;

  let synced = 0;
  for (const v of candidates) {
    try {
      await saveVideoToSupabase(userId, v.realJobId, {
        title: v.title ?? 'Untitled',
        authors: v.authors,
        venue: v.venue,
        year: v.year,
        url: v.url,
        arxiv_id: v.arxivId,
        abstract: v.abstract,
        sections: v.sections,
        scenes: v.scenes,
        duration: v.duration,
        blob_url: v.blobUrl ?? null,
        generated_at: v.generatedAt,
      });
      synced++;
    } catch {
      // Skip individual failures (likely duplicates)
    }
  }
  return synced;
}

/** Get a single video by arxiv ID. */
export async function getVideoByArxivIdFromSupabase(
  userId: string,
  arxivId: string
): Promise<any | null> {
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .eq('user_id', userId)
    .eq('arxiv_id', arxivId)
    .maybeSingle();

  if (error || !data) return null;
  return mapRow(data);
}
