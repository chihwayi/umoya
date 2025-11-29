import { Injectable } from '@nestjs/common';
import PDFDocument = require('pdfkit');
let ExcelJS: any;
try {
  ExcelJS = require('exceljs');
} catch (e) {
  // ExcelJS not available, will handle gracefully
}

@Injectable()
export class ReportExportService {
  /**
   * Export report data to PDF
   */
  async exportToPdf(data: any[], columns: string[], title: string, metadata?: Record<string, any>): Promise<Buffer> {
    const doc = new PDFDocument({
      margin: 50,
      size: 'A4',
    });

    const buffers: Buffer[] = [];
    doc.on('data', (chunk) => buffers.push(chunk));

    const ready = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
    });

    // Header
    doc
      .fontSize(20)
      .fillColor('#1F2937')
      .font('Helvetica-Bold')
      .text(title, { align: 'center' })
      .moveDown(0.5);

    if (metadata) {
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#6B7280')
        .text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' })
        .moveDown(0.3);
    }

    doc.moveDown(1);

    // Table header
    const startY = doc.y;
    const rowHeight = 20;
    const colWidth = (doc.page.width - 100) / columns.length;
    let currentY = startY;

    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor('#FFFFFF')
      .rect(50, currentY, doc.page.width - 100, rowHeight)
      .fill('#3B82F6');

    columns.forEach((col, idx) => {
      doc.text(col, 55 + idx * colWidth, currentY + 5, {
        width: colWidth - 10,
        align: 'left',
      });
    });

    currentY += rowHeight;

    // Table rows
    doc.font('Helvetica').fillColor('#1F2937').fontSize(9);

    data.forEach((row, rowIdx) => {
      // Check if we need a new page
      if (currentY + rowHeight > doc.page.height - 50) {
        doc.addPage();
        currentY = 50;
      }

      const fillColor = rowIdx % 2 === 0 ? '#F9FAFB' : '#FFFFFF';
      doc.rect(50, currentY, doc.page.width - 100, rowHeight).fill(fillColor);

      columns.forEach((col, colIdx) => {
        const value = row[col] !== undefined && row[col] !== null ? String(row[col]) : '';
        doc.text(value, 55 + colIdx * colWidth, currentY + 5, {
          width: colWidth - 10,
          align: 'left',
        });
      });

      currentY += rowHeight;
    });

    // Footer
    doc
      .fontSize(8)
      .fillColor('#9CA3AF')
      .text(`Total Records: ${data.length}`, 50, doc.page.height - 30, {
        align: 'left',
      });

    doc.end();
    return ready;
  }

  /**
   * Export report data to Excel
   */
  async exportToExcel(
    data: any[],
    columns: string[],
    title: string,
    metadata?: Record<string, any>,
  ): Promise<Buffer> {
    if (!ExcelJS) {
      throw new Error('ExcelJS is not installed. Please run: npm install exceljs');
    }
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(title || 'Report');

    // Set column headers
    worksheet.columns = columns.map((col) => ({
      header: col,
      key: col,
      width: 20,
    }));

    // Add metadata row
    if (metadata) {
      worksheet.insertRow(1, ['Generated:', new Date().toLocaleString()]);
      worksheet.mergeCells(1, 1, 1, columns.length);
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).alignment = { horizontal: 'center' };
    }

    // Add data rows
    data.forEach((row) => {
      const rowData = columns.map((col) => row[col] ?? '');
      worksheet.addRow(rowData);
    });

    // Style header row
    const headerRow = worksheet.getRow(metadata ? 3 : 1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF3B82F6' },
    };
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

    // Auto-fit columns
    worksheet.columns.forEach((column) => {
      if (column.header) {
        column.width = Math.max(column.header.length + 2, 15);
      }
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Export report data to CSV
   */
  async exportToCsv(data: any[], columns: string[], title: string): Promise<string> {
    // Create CSV content
    const headers = columns.join(',');
    const rows = data.map((row) =>
      columns
        .map((col) => {
          const value = row[col] !== undefined && row[col] !== null ? String(row[col]) : '';
          // Escape commas and quotes
          if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        })
        .join(','),
    );

    return [headers, ...rows].join('\n');
  }

  /**
   * Export report data to JSON
   */
  async exportToJson(data: any[], metadata?: Record<string, any>): Promise<string> {
    return JSON.stringify(
      {
        metadata: {
          generatedAt: new Date().toISOString(),
          recordCount: data.length,
          ...metadata,
        },
        data,
      },
      null,
      2,
    );
  }
}

