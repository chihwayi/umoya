import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import PDFDocument = require('pdfkit');
import { InvoiceTemplateService } from './invoice-template.service';

@Injectable()
export class InvoicePdfService {
  constructor(
    private readonly invoiceTemplateService: InvoiceTemplateService,
  ) {}

  async generateFinanceTransactionInvoice(
    tenantDb: DataSource,
    detail: any,
    templateId?: string,
  ) {
    if (!detail?.transaction) {
      throw new NotFoundException(`Transaction detail not found`);
    }

    const template = await this.invoiceTemplateService.resolveTemplateForPdf(tenantDb, templateId);
    const buffer = await this.buildInvoiceDocument(detail, template);
    const transactionNumber =
      detail.transaction.transaction_number ||
      detail.transaction.reference ||
      detail.transaction.id;

    return {
      buffer,
      fileName: `invoice-${transactionNumber}.pdf`,
    };
  }

  private async buildInvoiceDocument(detail: any, template?: any): Promise<Buffer> {
    const transaction = detail.transaction;
    const patientName = transaction.first_name
      ? `${transaction.first_name} ${transaction.last_name}`
      : 'Walk-in Patient';
    const content = template?.template_content || {};
    const brandColor = content.brandColor || '#0ea5e9';
    const headerTitle = content.headerTitle || 'Umoya Health';
    const headerSubtitle = content.headerSubtitle || 'Excellence in Care';
    const addressLines: string[] = Array.isArray(content.addressLines) ? content.addressLines : [];
    const footerNotes: string[] = Array.isArray(content.footerNotes)
      ? content.footerNotes
      : [
          'Thank you for choosing Umoya Health.',
          'Please contact Accounts if you have any questions about this invoice.',
        ];
    const contactEmail = content.contactEmail;
    const contactPhone = content.contactPhone;

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
      .fontSize(24)
      .fillColor(brandColor)
      .font('Helvetica-Bold')
      .text(headerTitle, { align: 'left' })
      .moveDown(0.1);

    if (headerSubtitle) {
      doc
        .fontSize(11)
        .font('Helvetica')
        .fillColor('#4B5563')
        .text(headerSubtitle, { align: 'left' });
    }

    if (addressLines.length) {
      doc
        .fontSize(9)
        .fillColor('#6B7280')
        .text(addressLines.join(' • '), { align: 'left' });
    }

    doc.moveDown(1);

    doc
      .fontSize(16)
      .fillColor('#1F2937')
      .font('Helvetica-Bold')
      .text('Invoice', { align: 'right' });

    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#4B5563')
      .text(`Invoice #: ${transaction.transaction_number || transaction.id}`, { align: 'right' })
      .text(`Date: ${new Date(transaction.created_at).toLocaleDateString()}`, { align: 'right' })
      .text(
        `Due Date: ${
          transaction.due_date
            ? new Date(transaction.due_date).toLocaleDateString()
            : 'Upon receipt'
        }`,
        { align: 'right' },
      )
      .moveDown(1.5);

    // Patient & Billing Info
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .fillColor('#111827')
      .text('Bill To', { continued: false })
      .moveDown(0.2);

    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#1F2937')
      .text(patientName)
      .text(transaction.patient_number ? `MRN: ${transaction.patient_number}` : '')
      .text(transaction.phone ? `Phone: ${transaction.phone}` : '')
      .moveDown(0.5);

    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .text('Transaction Details', { continued: false })
      .moveDown(0.2);

    doc
      .font('Helvetica')
      .fontSize(10)
      .text(`Module: ${transaction.source_module || 'General'}`)
      .text(`Payment Status: ${transaction.payment_status || 'pending'}`)
      .text(
        `Payer Type: ${
          transaction.payer_type
            ? transaction.payer_type.replace('_', ' ').toUpperCase()
            : 'SELF'
        }`,
      )
      .moveDown(1);

    // Line Items Table
    const tableTop = doc.y;
    const columnWidths = [240, 60, 90, 90];

    const drawRow = (
      rowY: number,
      cols: Array<{ text: string; options?: PDFKit.Mixins.TextOptions }>,
      isHeader = false,
    ) => {
      cols.forEach((col, index) => {
        doc
          .font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(10)
          .fillColor(isHeader ? '#111827' : '#1F2937')
          .text(col.text, 50 + columnWidths.slice(0, index).reduce((a, b) => a + b, 0), rowY, {
            width: columnWidths[index],
            align: col.options?.align || (index === 0 ? 'left' : 'right'),
          });
      });
    };

    drawRow(tableTop, [
      { text: 'Description', options: { align: 'left' } },
      { text: 'Qty' },
      { text: 'Unit Price' },
      { text: 'Line Total' },
    ], true);

    doc
      .moveTo(50, tableTop + 15)
      .lineTo(50 + columnWidths.reduce((a, b) => a + b, 0), tableTop + 15)
      .strokeColor('#E5E7EB')
      .stroke();

    let currentY = tableTop + 25;
    const lineItems = detail.lineItems?.length ? detail.lineItems : [];

    if (lineItems.length === 0) {
      drawRow(currentY, [{ text: 'No line items recorded for this transaction.', options: { align: 'left' } }]);
      currentY += 18;
    } else {
      lineItems.forEach((item: any) => {
        drawRow(currentY, [
          {
            text: item.description || 'Service',
            options: { align: 'left' },
          },
          { text: String(item.quantity || 1) },
          {
            text: `$${Number(item.unit_price || 0).toFixed(2)}`,
          },
          {
            text: `$${Number(item.total || 0).toFixed(2)}`,
          },
        ]);
        currentY += 18;
      });
    }

    doc.moveDown(2);

    // Totals
    const amount = Number(transaction.amount || 0);
    const balance = Number(transaction.balance || 0);
    const paymentsTotal =
      detail.payments?.reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0) || 0;

    const totalsStartX = 50 + columnWidths.reduce((a, b) => a + b, 0) - 180;

    const addTotalRow = (label: string, value: string, isBold = false) => {
      doc
        .font(isBold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(10)
        .fillColor('#111827')
        .text(label, totalsStartX, doc.y, { width: 90 });
      doc
        .text(value, totalsStartX + 90, doc.y - 12, { width: 90, align: 'right' })
        .moveDown(0.4);
    };

    addTotalRow('Subtotal', `$${amount.toFixed(2)}`);
    addTotalRow('Payments', `$${paymentsTotal.toFixed(2)}`);
    addTotalRow('Balance Due', `$${balance.toFixed(2)}`, true);

    doc.moveDown(1.5);

    // Payments Table
    if (detail.payments?.length) {
      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .fillColor('#111827')
        .text('Payments', 50)
        .moveDown(0.5);

      detail.payments.forEach((payment: any) => {
        doc
          .font('Helvetica')
          .fontSize(10)
          .fillColor('#1F2937')
          .text(
            `${new Date(payment.received_at).toLocaleDateString()} • ${
              payment.payment_method?.replace('_', ' ') || 'Payment'
            }`,
          )
          .text(
            `Reference: ${payment.payment_reference || 'N/A'}      Amount: $${Number(
              payment.amount || 0,
            ).toFixed(2)}`,
          )
          .moveDown(0.2);
      });

      doc.moveDown(1);
    }

    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#6B7280');

    footerNotes.forEach((note: string) => {
      doc.text(note, { align: 'center' });
    });

    if (contactEmail || contactPhone) {
      doc
        .moveDown(0.2)
        .text(
          `${contactEmail ? `Email: ${contactEmail}` : ''}${
            contactEmail && contactPhone ? ' • ' : ''
          }${contactPhone ? `Phone: ${contactPhone}` : ''}`,
          { align: 'center' },
        );
    }

    doc.end();

    return ready;
  }
}

