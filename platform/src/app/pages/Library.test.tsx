import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Library from './Library';
import { saveVideoToLibrary } from '../lib/data';

// Mock auth — guest by default
vi.mock('../lib/useAuth', () => ({
  useAuth: () => ({ user: null, loading: false, signInWithGoogle: vi.fn(), signOut: vi.fn() }),
}));

// Mock Supabase video functions
vi.mock('../lib/supabaseVideos', () => ({
  getLibraryFromSupabase: () => Promise.resolve([]),
  syncLocalLibraryToSupabase: () => Promise.resolve(0),
}));

function renderLibrary() {
  return render(
    <MemoryRouter>
      <Library />
    </MemoryRouter>
  );
}

describe('Library page', () => {
  it('shows sample items seeded on first visit', () => {
    localStorage.clear();
    renderLibrary();
    // Sample items are seeded, so empty state should not show
    expect(screen.queryByText(/Your video library is empty/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/Attention Is All You Need/i).length).toBeGreaterThanOrEqual(1);
  });

  it('renders video cards when the library is populated', () => {
    saveVideoToLibrary('lib-v1', {
      title: 'My Research Video',
      authors: ['Dr. Smith'],
      duration: 120,
      venue: 'ICML',
      year: 2024,
    });
    saveVideoToLibrary('lib-v2', {
      title: 'Another Paper Video',
      authors: ['Dr. Jones'],
      duration: 90,
      venue: 'NeurIPS',
      year: 2023,
    });

    renderLibrary();

    expect(screen.queryByText(/Your video library is empty/i)).not.toBeInTheDocument();
    // Each video title appears in both the thumbnail and the card heading
    expect(screen.getAllByText('My Research Video').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Another Paper Video').length).toBeGreaterThanOrEqual(1);
  });
});
