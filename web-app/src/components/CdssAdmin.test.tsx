import React from 'react';
import { render, screen } from '@testing-library/react';
import { CdssAdmin } from './CdssAdmin';
import { cdssAdminAPI } from '../services/api';

jest.mock('../services/api', () => ({
  cdssAdminAPI: {
    getStatus: jest.fn(),
    getSettings: jest.fn(),
    getMetrics: jest.fn(),
    getAuditLogs: jest.fn(),
    getAdminJobs: jest.fn(),
  },
}));

const mockedCdssAdminApi = cdssAdminAPI as jest.Mocked<typeof cdssAdminAPI>;

describe('CdssAdmin', () => {
  beforeEach(() => {
    localStorage.setItem('cdssAdmin.autoRefresh', 'false');
    mockedCdssAdminApi.getStatus.mockResolvedValue({
      llm: { enabled: true, model: 'llama3.1:latest', api_url: 'http://localhost:11434' },
      rag: { enabled: true, documents: 12, cache_enabled: true },
    });
    mockedCdssAdminApi.getSettings.mockResolvedValue({
      settings: {
        llm_enabled: true,
        llm_api_url: 'http://localhost:11434',
        llm_model_name: 'llama3.1:latest',
        rag_enabled: true,
        cache_ttl_seconds: 300,
        cache_namespace: 'cdss',
      },
    });
    mockedCdssAdminApi.getMetrics.mockResolvedValue({
      metrics: {
        documents: 12,
        cache_keys: 3,
        rag_cache: { hit: 4, miss: 1, hit_rate_percent: 80 },
        llm_cache: { hit: 2, miss: 2, hit_rate_percent: 50 },
      },
      rateLimit: { limit: 60, remaining: 59, reset: 60 },
    });
    mockedCdssAdminApi.getAuditLogs.mockResolvedValue({ logs: [], limit: 20, offset: 0 });
    mockedCdssAdminApi.getAdminJobs.mockResolvedValue({ jobs: [] });
  });

  afterEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('loads and renders admin dashboard data', async () => {
    render(<CdssAdmin />);

    expect(await screen.findByText(/CDSS Administration/i)).toBeTruthy();
    expect(await screen.findByText('Model: llama3.1:latest')).toBeTruthy();
    expect(await screen.findByText('Doc count: 12')).toBeTruthy();
  });
});
