import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { CommandPalette } from './CommandPalette';
import { cdssApi, clinicianNetworkApi, ehrApi } from '../services/api';

// Bare jest.fn()s here: CRA runs jest with resetMocks:true, which wipes
// factory-provided implementations before each test — so every behavior is
// (re)configured in beforeEach, the same pattern as LandingPage.test.tsx.
jest.mock('../services/api', () => ({
  cdssApi: { searchGuidelines: jest.fn() },
  clinicianNetworkApi: { searchNetworkTopics: jest.fn() },
  ehrApi: { searchPatients: jest.fn() },
}));

const mockedCdssApi = cdssApi as jest.Mocked<typeof cdssApi>;
const mockedNetworkApi = clinicianNetworkApi as jest.Mocked<typeof clinicianNetworkApi>;
const mockedEhrApi = ehrApi as jest.Mocked<typeof ehrApi>;

const LocationProbe: React.FC = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
};

// S289 — the palette's related-discussion result renders distinctly from the
// CDSS citations and navigates to the topic thread on click.
describe('CommandPalette related Clinician Network discussion', () => {
  beforeEach(() => {
    localStorage.setItem('ehr_token', 'test-token');
    mockedCdssApi.searchGuidelines.mockResolvedValue({
      data: {
        citations: [{ source: 'IMCI Chart Booklet (p.12)', confidence: 0.92, metadata: {} }],
        analysis: 'Assess for malaria with RDT.',
        count: 1,
      },
    } as any);
    mockedNetworkApi.searchNetworkTopics.mockResolvedValue({
      data: [
        {
          id: 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1',
          title: 'Fever workup in school-age child',
          panelId: '55555555-5555-5555-5555-555555555555',
          panelName: 'General Practice',
          similarity: 0.94,
        },
      ],
    } as any);
    mockedEhrApi.searchPatients.mockResolvedValue({ data: [] } as any);
  });

  it('shows a distinct related-discussion result that opens the thread', async () => {
    render(
      <MemoryRouter initialEntries={['/ehr/s289clinic/home']}>
        <CommandPalette tenantSlug="s289clinic" />
        <LocationProbe />
      </MemoryRouter>,
    );

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const input = await screen.findByPlaceholderText('Search commands...');
    fireEvent.change(input, { target: { value: 'persistent fever and cough in a school-age child' } });

    // CDSS citation still renders unchanged…
    await waitFor(() => {
      expect(screen.getByText(/Clinical guideline search/)).toBeInTheDocument();
    });
    // …and the network discussion appears as its own distinct result. (The
    // eyebrow line mixes text nodes — panel name, match % — so match on the
    // stable leading phrase rather than the whole line.)
    expect(await screen.findByText(/Related Clinician Network discussion/)).toBeInTheDocument();
    expect(screen.getByText('Fever workup in school-age child')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Fever workup in school-age child'));
    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/ehr/s289clinic/clinician-network/topics/a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1',
      );
    });
  }, 15000);
});
