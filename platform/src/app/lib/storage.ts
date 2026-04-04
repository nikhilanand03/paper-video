// localStorage CRUD for videos, notes, and sample seeding

import { examplePapers, mockPaperData } from "./samples";

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function extractArxivId(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/arxiv\.org\/(?:abs|pdf)\/(\d+\.\d+)/);
  return match ? match[1] : null;
}

export function getOrCreateVideoId(paperId: string): string {
  const videos = JSON.parse(localStorage.getItem("videos") || "{}");
  if (videos[paperId]) return videos[paperId];
  const videoId = generateId();
  videos[paperId] = videoId;
  localStorage.setItem("videos", JSON.stringify(videos));
  return videoId;
}

export function getLibrary() {
  return JSON.parse(localStorage.getItem("library") || "[]");
}

export function getVideoById(videoId: string) {
  return getLibrary().find((v: any) => v.id === videoId);
}

export function getVideoByArxivId(arxivId: string) {
  return getLibrary().find((v: any) => v.arxivId === arxivId);
}

export function saveVideoToLibrary(videoId: string, paperData: any) {
  const library = getLibrary();
  const existingIndex = library.findIndex((v: any) => v.id === videoId);
  const arxivId = paperData.arxivId || extractArxivId(paperData.url);

  const videoEntry = {
    id: videoId,
    ...paperData,
    ...(arxivId && { arxivId }),
    generatedAt: new Date().toISOString(),
    views: existingIndex >= 0 ? library[existingIndex].views : 0,
  };

  if (existingIndex >= 0) {
    library[existingIndex] = videoEntry;
  } else {
    library.unshift(videoEntry);
  }
  localStorage.setItem("library", JSON.stringify(library));
}

export function incrementViewCount(videoId: string) {
  const library = getLibrary();
  const video = library.find((v: any) => v.id === videoId);
  if (video) {
    video.views = (video.views || 0) + 1;
    localStorage.setItem("library", JSON.stringify(library));
  }
}

export function getNotes(videoId: string) {
  return JSON.parse(localStorage.getItem(`notes_${videoId}`) || "[]");
}

export function saveNote(videoId: string, note: { timestamp: number; text: string }) {
  const notes = getNotes(videoId);
  notes.push({ id: generateId(), ...note, createdAt: new Date().toISOString() });
  localStorage.setItem(`notes_${videoId}`, JSON.stringify(notes));
}

export function deleteNote(videoId: string, noteId: string) {
  const notes = getNotes(videoId).filter((n: any) => n.id !== noteId);
  localStorage.setItem(`notes_${videoId}`, JSON.stringify(notes));
}

export function seedSampleItems() {
  const library = getLibrary();
  const SEED_KEY = "samples_seeded_v11";
  if (localStorage.getItem(SEED_KEY)) return;

  for (const paper of examplePapers) {
    const data = mockPaperData[paper.id];
    if (!data) continue;

    const existingIdx = library.findIndex(
      (v: any) => v.arxivId === paper.arxivId || v.title === data.title
    );

    const entry = {
      id: existingIdx >= 0 ? library[existingIdx].id : generateId(),
      title: data.title,
      authors: data.authors,
      venue: data.venue,
      year: data.year,
      url: data.url,
      abstract: data.abstract,
      sections: data.sections,
      scenes: data.scenes,
      duration: paper.duration || data.duration,
      arxivId: paper.arxivId,
      realJobId: paper.realJobId || undefined,
      blobUrl: paper.blobUrl || undefined,
      generatedAt: new Date().toISOString(),
      views: existingIdx >= 0 ? library[existingIdx].views : 0,
      isSample: true,
    };

    if (existingIdx >= 0) {
      library[existingIdx] = entry;
    } else {
      library.unshift(entry);
    }
  }

  localStorage.setItem("library", JSON.stringify(library));
  localStorage.setItem(SEED_KEY, "1");
}
