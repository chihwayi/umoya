import React, { useState, useRef, useEffect } from 'react';
import { Download, FileText, Table, FileSpreadsheet, ChevronDown, Loader } from 'lucide-react';
import { useReportExport } from '../hooks/useReportExport';
import { ReportDefinition } from '../types/report-export';

interface Props {
  buildDefinition: () => Omit<ReportDefinition, 'generatedBy' | 'generatedAt'>;
  csvData?: { rows: Record<string, any>[]; columns?: string[] };
  filename?: string;
  className?: string;
}

export function ExportMenu({ buildDefinition, csvData, filename, className = '' }: Props) {
  const { exportPdf, exportXlsx, exportCsv, exporting } = useReportExport();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handlePdf = () => {
    setOpen(false);
    exportPdf(buildDefinition());
  };

  const handleXlsx = () => {
    setOpen(false);
    exportXlsx(buildDefinition());
  };

  const handleCsv = () => {
    if (!csvData) return;
    setOpen(false);
    exportCsv(csvData.rows, filename ?? 'umoya-export', csvData.columns);
  };

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={exporting}
        className="flex items-center gap-2 px-4 py-2 bg-[#111E35] border border-[#162440] rounded-[10px] text-[#E2EDF8] text-sm hover:border-[#0AA98A] transition-colors disabled:opacity-60"
      >
        {exporting ? <Loader size={15} className="animate-spin text-[#0AA98A]" /> : <Download size={15} className="text-[#0AA98A]" />}
        Export
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-48 bg-[#111E35] border border-[#162440] rounded-[10px] shadow-2xl overflow-hidden">
          <button
            onClick={handlePdf}
            className="w-full text-left px-4 py-3 text-sm text-[#E2EDF8] hover:bg-[#162440] flex items-center gap-3 transition-colors"
          >
            <FileText size={14} className="text-[#0AA98A]" />
            PDF Report
          </button>
          <button
            onClick={handleXlsx}
            className="w-full text-left px-4 py-3 text-sm text-[#E2EDF8] hover:bg-[#162440] flex items-center gap-3 transition-colors"
          >
            <Table size={14} className="text-[#0AA98A]" />
            Excel (XLSX)
          </button>
          {csvData && (
            <button
              onClick={handleCsv}
              className="w-full text-left px-4 py-3 text-sm text-[#E2EDF8] hover:bg-[#162440] flex items-center gap-3 transition-colors"
            >
              <FileSpreadsheet size={14} className="text-[#0AA98A]" />
              CSV Data
            </button>
          )}
        </div>
      )}
    </div>
  );
}
