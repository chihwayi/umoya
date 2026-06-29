import { useState } from 'react';
import { api } from '../services/api';
import { ReportDefinition } from '../types/report-export';

function getDisplayName(): string {
  try {
    const raw = localStorage.getItem('ehr_user');
    if (raw) {
      const u = JSON.parse(raw);
      return u.displayName || u.name || u.email || 'Unknown';
    }
  } catch {}
  return 'Unknown';
}

export function useReportExport() {
  const [exporting, setExporting] = useState(false);

  const exportPdf = async (definition: Omit<ReportDefinition, 'generatedBy' | 'generatedAt'>) => {
    setExporting(true);
    try {
      const res = await api.post(
        '/exports/pdf',
        { ...definition, generatedBy: getDisplayName(), generatedAt: new Date().toISOString() },
        { responseType: 'blob' },
      );
      _download(res.data, `umoya-${definition.title.toLowerCase().replace(/\s+/g, '-')}.pdf`, 'application/pdf');
    } finally {
      setExporting(false);
    }
  };

  const exportXlsx = async (definition: Omit<ReportDefinition, 'generatedBy' | 'generatedAt'>) => {
    setExporting(true);
    try {
      const res = await api.post(
        '/exports/xlsx',
        { ...definition, generatedBy: getDisplayName(), generatedAt: new Date().toISOString() },
        { responseType: 'blob' },
      );
      _download(
        res.data,
        `umoya-${definition.title.toLowerCase().replace(/\s+/g, '-')}.xlsx`,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
    } finally {
      setExporting(false);
    }
  };

  const exportCsv = async (rows: Record<string, any>[], filename: string, columns?: string[]) => {
    setExporting(true);
    try {
      const res = await api.post('/exports/csv', { rows, columns, filename }, { responseType: 'blob' });
      _download(res.data, `${filename}.csv`, 'text/csv');
    } finally {
      setExporting(false);
    }
  };

  return { exportPdf, exportXlsx, exportCsv, exporting };
}

function _download(blob: Blob, filename: string, mime: string) {
  const url = URL.createObjectURL(new Blob([blob], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
