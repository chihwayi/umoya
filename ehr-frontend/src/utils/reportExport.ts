import jsPDF from 'jspdf';
import 'jspdf-autotable';

export type ReportColumn = { key: string; label: string };

/**
 * Build CSV from rows and columns; trigger download.
 */
export function exportReportToCSV(
  title: string,
  rows: Record<string, unknown>[],
  columns: ReportColumn[],
  filename?: string,
): void {
  const headers = columns.map((c) => c.label);
  const escape = (v: unknown): string => {
    const s = v == null ? '' : String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const line = (row: Record<string, unknown>) => columns.map((c) => escape(row[c.key])).join(',');
  const csv = [headers.join(','), ...rows.map(line)].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `${title.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
}

/**
 * Generate a PDF with title, optional subtitle, and table; trigger download.
 */
export function exportReportToPDF(
  title: string,
  subtitle: string | undefined,
  rows: Record<string, unknown>[],
  columns: ReportColumn[],
  filename?: string,
): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, pageWidth / 2, y, { align: 'center' });
  y += 10;

  if (subtitle) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitle, pageWidth / 2, y, { align: 'center' });
    y += 8;
  }

  const headers = columns.map((c) => c.label);
  const body = rows.map((row) => columns.map((c) => String(row[c.key] ?? '')));

  (doc as any).autoTable({
    head: [headers],
    body,
    startY: y,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [66, 66, 66] },
  });

  const finalY = (doc as any).lastAutoTable.finalY || y;
  if (finalY > doc.internal.pageSize.getHeight() - 20) {
    doc.addPage();
    (doc as any).autoTable({
      head: [headers],
      body,
      startY: 15,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 66, 66] },
    });
  }

  doc.save(filename || `${title.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
