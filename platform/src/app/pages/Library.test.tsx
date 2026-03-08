import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Library from './Library';
import { saveVideoToLibrary } from '../lib/data';

function renderLibrary() {
  return render(
    <MemoryRouter>
      <Library />
    </MemoryRouter>
  );
}

describe('Library page', () => {
  it('shows the empty state message when library is empty', () => {
    renderLibrary();
    expect(screen.getByText(/Your video library is empty/i)).toBeInTheDocument();
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
