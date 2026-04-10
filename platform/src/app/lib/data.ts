// Barrel re-export — all existing `from '../lib/data'` imports still work.
// Actual implementations live in samples.ts, templates.ts, and storage.ts.

export { examplePapers, mockPaperData } from "./samples";
export { templateTypes, templateInfo, processingStages } from "./templates";
export type { TemplateType } from "./templates";
export {
  extractArxivId,
  getOrCreateVideoId,
  saveVideoToLibrary,
  getLibrary,
  getVideoById,
  getVideoByArxivId,
  incrementViewCount,
  getNotes,
  saveNote,
  deleteNote,
  seedSampleItems,
} from "./storage";
export {
  saveVideoToSupabase,
  getLibraryFromSupabase,
  getVideoFromSupabase,
  getVideoByArxivIdFromSupabase,
  syncLocalLibraryToSupabase,
} from "./supabaseVideos";
