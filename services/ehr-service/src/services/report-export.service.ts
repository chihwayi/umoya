import { Injectable } from '@nestjs/common';
import PDFDocument = require('pdfkit');
import * as ExcelJS from 'exceljs';
import { format } from 'date-fns';

export interface ReportDefinition {
  title: string;
  subtitle?: string;
  facility: string;
  district?: string;
  period: string;
  generatedBy: string;
  generatedAt: Date;
  sections: ReportSection[];
  footer?: string;
}

export type ReportSection =
  | SummaryCardsSection
  | TableSection
  | ChartImageSection
  | CascadeFunnelSection
  | NarrativeSection;

export interface SummaryCardsSection {
  type: 'summary_cards';
  title: string;
  cards: { label: string; value: string | number; unit?: string; status?: 'good' | 'warning' | 'critical' }[];
}

export interface TableSection {
  type: 'table';
  title: string;
  columns: { key: string; label: string; width?: number }[];
  rows: Record<string, any>[];
  totals?: Record<string, number>;
  conditionalColour?: {
    column: string;
    thresholds: { max: number; colour: string }[];
  };
}

export interface ChartImageSection {
  type: 'chart_image';
  title: string;
  imageBase64: string;
  caption?: string;
}

export interface CascadeFunnelSection {
  type: 'cascade_funnel';
  title: string;
  steps: { label: string; value: number; percentage: number }[];
}

export interface NarrativeSection {
  type: 'narrative';
  title: string;
  text: string;
}

const TEAL = '#0AA98A';
const DARK = '#0F1F2E';
const MID  = '#3D607F';
const MUTED = '#7A9CBC';
const AMBER = '#F0954A';
const CORAL = '#E8614D';
const ALT_ROW = '#F5F8FA';

@Injectable()
export class ReportExportService {

  async generatePdf(definition: ReportDefinition): Promise<Buffer> {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const buffers: Buffer[] = [];
    doc.on('data', (c) => buffers.push(c));
    const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(buffers))));

    // --- Header band ---
    doc.rect(0, 0, doc.page.width, 50).fill(DARK);
    doc.fontSize(18).fillColor(TEAL).font('Helvetica-Bold').text('UMOYA EHR', 40, 16);
    doc.fontSize(9).fillColor(MUTED).font('Helvetica').text('Confidential programme report', 40, 35);

    // --- Title block ---
    doc.moveDown(2);
    doc.fontSize(20).fillColor(DARK).font('Helvetica-Bold').text(definition.title, 40, 65);
    if (definition.subtitle) {
      doc.fontSize(12).fillColor(MID).font('Helvetica').text(definition.subtitle, { continued: false });
    }
    const location = [definition.facility, definition.district].filter(Boolean).join(' · ');
    doc.fontSize(11).fillColor(MID).font('Helvetica').text(`${location} · ${definition.period}`);
    doc.fontSize(9).fillColor(MUTED).text(
      `Generated: ${format(definition.generatedAt, 'dd MMM yyyy HH:mm')} · By: ${definition.generatedBy}`,
    );

    // Teal rule
    doc.moveDown(0.5);
    doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).strokeColor(TEAL).lineWidth(1.5).stroke();
    doc.moveDown(0.8);

    // --- Sections ---
    for (const section of definition.sections) {
      if (doc.y > doc.page.height - 100) doc.addPage();
      this._renderSection(doc, section);
    }

    // --- Footer ---
    const footerText = definition.footer ?? 'Data source: Umoya EHR. CONFIDENTIAL — For programme review use only.';
    doc.fontSize(8).fillColor(MUTED).text(footerText, 40, doc.page.height - 30, { align: 'center' });

    doc.end();
    return done;
  }

  private _renderSection(doc: PDFKit.PDFDocument, section: ReportSection) {
    switch (section.type) {
      case 'summary_cards': return this._renderCards(doc, section);
      case 'table':         return this._renderTable(doc, section);
      case 'cascade_funnel': return this._renderFunnel(doc, section);
      case 'narrative':     return this._renderNarrative(doc, section);
      case 'chart_image':   return this._renderChart(doc, section);
    }
  }

  private _renderCards(doc: PDFKit.PDFDocument, section: SummaryCardsSection) {
    doc.fontSize(13).fillColor(DARK).font('Helvetica-Bold').text(section.title);
    doc.moveDown(0.4);
    const cols = 4;
    const cardW = (doc.page.width - 80) / cols;
    const cardH = 52;
    const startX = 40;
    const y = doc.y;
    section.cards.forEach((card, i) => {
      const x = startX + (i % cols) * cardW;
      const cy = y + Math.floor(i / cols) * (cardH + 6);
      const color = card.status === 'good' ? TEAL : card.status === 'warning' ? AMBER : card.status === 'critical' ? CORAL : MID;
      doc.rect(x, cy, cardW - 6, cardH).fillAndStroke('#FFFFFF', color);
      doc.fontSize(16).fillColor(color).font('Helvetica-Bold').text(String(card.value), x + 6, cy + 8, { width: cardW - 18, align: 'center' });
      if (card.unit) {
        doc.fontSize(8).fillColor(MID).font('Helvetica').text(card.unit, x + 6, cy + 28, { width: cardW - 18, align: 'center' });
      }
      doc.fontSize(8).fillColor(MID).text(card.label, x + 6, cy + 38, { width: cardW - 18, align: 'center' });
    });
    const rows = Math.ceil(section.cards.length / cols);
    doc.y = y + rows * (cardH + 6) + 12;
    doc.moveDown(0.5);
  }

  private _renderTable(doc: PDFKit.PDFDocument, section: TableSection) {
    doc.fontSize(13).fillColor(DARK).font('Helvetica-Bold').text(section.title);
    doc.moveDown(0.4);
    const usableW = doc.page.width - 80;
    const colW = usableW / section.columns.length;
    const rowH = 18;
    const startX = 40;
    let y = doc.y;

    // Header
    doc.rect(startX, y, usableW, rowH).fill(TEAL);
    doc.fontSize(9).fillColor('#FFFFFF').font('Helvetica-Bold');
    section.columns.forEach((col, i) => {
      doc.text(col.label, startX + i * colW + 3, y + 4, { width: colW - 6, align: 'left' });
    });
    y += rowH;

    // Rows
    section.rows.forEach((row, idx) => {
      if (y + rowH > doc.page.height - 50) { doc.addPage(); y = 40; }
      doc.rect(startX, y, usableW, rowH).fill(idx % 2 === 0 ? '#FFFFFF' : ALT_ROW);
      doc.fontSize(8).font('Helvetica').fillColor(DARK);
      section.columns.forEach((col, i) => {
        let colour = DARK;
        if (section.conditionalColour?.column === col.key) {
          const val = parseFloat(row[col.key]);
          if (!isNaN(val)) {
            const t = section.conditionalColour.thresholds.find((th) => val <= th.max);
            if (t) colour = t.colour;
          }
        }
        doc.fillColor(colour).text(String(row[col.key] ?? ''), startX + i * colW + 3, y + 4, { width: colW - 6 });
      });
      y += rowH;
    });

    if (section.totals) {
      doc.rect(startX, y, usableW, rowH).fill(TEAL);
      doc.fontSize(9).fillColor('#FFFFFF').font('Helvetica-Bold').text('TOTAL', startX + 3, y + 4);
      section.columns.slice(1).forEach((col, i) => {
        const v = section.totals![col.key];
        if (v !== undefined) doc.text(String(v), startX + (i + 1) * colW + 3, y + 4, { width: colW - 6 });
      });
      y += rowH;
    }

    doc.y = y + 12;
    doc.moveDown(0.5);
  }

  private _renderFunnel(doc: PDFKit.PDFDocument, section: CascadeFunnelSection) {
    doc.fontSize(13).fillColor(DARK).font('Helvetica-Bold').text(section.title);
    doc.moveDown(0.4);
    const barMaxW = 320;
    const barH = 16;
    let y = doc.y;
    section.steps.forEach((step) => {
      const pct = Math.min(step.percentage / 100, 1);
      const color = step.percentage >= 85 ? TEAL : step.percentage >= 70 ? AMBER : CORAL;
      doc.rect(40, y, barMaxW, barH).fill('#E8EFF5');
      doc.rect(40, y, barMaxW * pct, barH).fill(color);
      doc.fontSize(9).fillColor(DARK).font('Helvetica').text(
        `${step.label}: ${step.value.toLocaleString()} (${step.percentage.toFixed(1)}%)`,
        370, y + 3,
      );
      y += barH + 4;
    });
    doc.y = y + 12;
    doc.moveDown(0.5);
  }

  private _renderNarrative(doc: PDFKit.PDFDocument, section: NarrativeSection) {
    doc.fontSize(13).fillColor(DARK).font('Helvetica-Bold').text(section.title);
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor(MID).font('Helvetica').text(section.text, { align: 'justify' });
    doc.moveDown(0.8);
  }

  private _renderChart(doc: PDFKit.PDFDocument, section: ChartImageSection) {
    doc.fontSize(13).fillColor(DARK).font('Helvetica-Bold').text(section.title);
    doc.moveDown(0.3);
    try {
      const imgBuf = Buffer.from(section.imageBase64, 'base64');
      const maxW = doc.page.width - 80;
      doc.image(imgBuf, { fit: [maxW, 200], align: 'center' });
    } catch {
      doc.fontSize(9).fillColor(MUTED).text('[Chart image unavailable]');
    }
    if (section.caption) {
      doc.fontSize(8).fillColor(MUTED).text(section.caption, { align: 'center' });
    }
    doc.moveDown(0.8);
  }

  // -------------------------------------------------------------------
  // XLSX
  // -------------------------------------------------------------------

  async generateXlsx(definition: ReportDefinition): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Umoya EHR';
    wb.created = definition.generatedAt;

    const cover = wb.addWorksheet('Cover');
    cover.getCell('A1').value = definition.title;
    cover.getCell('A1').font = { size: 18, bold: true, color: { argb: 'FF0AA98A' } };
    cover.getCell('A2').value = [definition.facility, definition.district].filter(Boolean).join(' · ') + ' · ' + definition.period;
    cover.getCell('A3').value = `Generated: ${format(definition.generatedAt, 'dd MMM yyyy HH:mm')} · By: ${definition.generatedBy}`;
    cover.getCell('A3').font = { size: 9, color: { argb: 'FF7A9CBC' } };
    cover.columns = [{ width: 60 }];

    for (const section of definition.sections) {
      if (section.type !== 'table') continue;
      const ws = wb.addWorksheet(section.title.substring(0, 31));

      const headerRow = ws.addRow(section.columns.map((c) => c.label));
      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0AA98A' } };
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      section.rows.forEach((row, idx) => {
        const dataRow = ws.addRow(section.columns.map((c) => row[c.key] ?? ''));
        if (idx % 2 === 1) {
          dataRow.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F8FA' } };
          });
        }
        if (section.conditionalColour) {
          const ci = section.columns.findIndex((c) => c.key === section.conditionalColour!.column);
          if (ci >= 0) {
            const cell = dataRow.getCell(ci + 1);
            const val = parseFloat(row[section.conditionalColour.column]);
            const t = section.conditionalColour.thresholds.find((th) => val <= th.max);
            if (t) cell.font = { color: { argb: 'FF' + t.colour.replace('#', '') } };
          }
        }
      });

      if (section.totals) {
        const totRow = ws.addRow(section.columns.map((c) => section.totals![c.key] ?? ''));
        totRow.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0AA98A' } };
          cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
        });
      }

      ws.columns = section.columns.map((c) => ({ width: c.width ?? 18 }));
    }

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  // -------------------------------------------------------------------
  // CSV
  // -------------------------------------------------------------------

  generateCsv(rows: Record<string, any>[], columnOrder?: string[]): string {
    if (!rows.length) return '';
    const keys = columnOrder ?? Object.keys(rows[0]);
    const escape = (v: any) => {
      const s = v == null ? '' : String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [keys.join(','), ...rows.map((r) => keys.map((k) => escape(r[k])).join(','))].join('\n');
  }
}
