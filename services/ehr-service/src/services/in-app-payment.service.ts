import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PaymentsService } from './payments.service';
import { SmsService } from './sms.service';

@Injectable()
export class InAppPaymentService {
  private readonly logger = new Logger(InAppPaymentService.name);

  constructor(
    private readonly payments: PaymentsService,
    private readonly sms: SmsService,
  ) {}

  async getOutstandingInvoices(db: DataSource, patientId: string): Promise<any[]> {
    return db.query(
      `SELECT id, invoice_number, amount_due, currency, due_date, description, payment_status
       FROM invoices
       WHERE patient_id = $1 AND payment_status IN ('unpaid', 'partial')
       ORDER BY due_date ASC`,
      [patientId],
    );
  }

  async initiatePayment(
    db: DataSource,
    patientId: string,
    invoiceId: string,
    method: string,
    mobileNumber?: string,
  ): Promise<{ transactionId: string; instructions?: string }> {
    const [invoice] = await db.query(
      `SELECT id, amount_due, currency, invoice_number, description FROM invoices
       WHERE id = $1 AND patient_id = $2`,
      [invoiceId, patientId],
    );
    if (!invoice) throw new NotFoundException('Invoice not found');

    const [tx] = await db.query(
      `INSERT INTO patient_payment_transactions
         (invoice_id, patient_id, amount, currency, payment_method, mobile_number)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [invoiceId, patientId, invoice.amount_due, invoice.currency ?? 'ZiG', method, mobileNumber ?? null],
    );

    let instructions: string | undefined;

    if (method === 'ecocash' || method === 'onemoney') {
      const result = await this.payments.processMobileMoneyPayment({
        provider: method,
        billId: invoiceId,
        amount: invoice.amount_due,
        phoneNumber: mobileNumber,
        currency: invoice.currency ?? 'ZiG',
      }, db);

      instructions = result?.instructions;

      if (result?.transactionId) {
        await db.query(
          `UPDATE patient_payment_transactions SET gateway_reference = $1 WHERE id = $2`,
          [result.transactionId, tx.id],
        );
      }
    }

    this.logger.log(`Payment initiated: patient=${patientId} invoice=${invoiceId} method=${method} tx=${tx.id}`);
    return { transactionId: tx.id, instructions };
  }

  async confirmPayment(db: DataSource, transactionId: string): Promise<void> {
    const [tx] = await db.query(
      `UPDATE patient_payment_transactions
       SET status = 'confirmed', confirmed_at = now()
       WHERE id = $1
       RETURNING invoice_id, payment_method, patient_id`,
      [transactionId],
    );
    if (!tx) return;

    await db.query(
      `UPDATE invoices SET payment_status = 'paid', paid_at = now(), paid_via = $1 WHERE id = $2`,
      [tx.payment_method, tx.invoice_id],
    );

    const [patient] = await db.query(`SELECT phone, first_name FROM patients WHERE id = $1`, [tx.patient_id]);
    if (patient?.phone) {
      await this.sms.send(
        patient.phone,
        `Hi ${patient.first_name}, your Umoya payment has been confirmed. Thank you.`,
      );
    }

    await db.query(
      `UPDATE patient_payment_transactions SET receipt_sent = TRUE WHERE id = $1`,
      [transactionId],
    );
  }

  async getTransactionStatus(db: DataSource, txId: string, patientId: string): Promise<any> {
    const [tx] = await db.query(
      `SELECT status, confirmed_at, failed_reason, gateway_reference
       FROM patient_payment_transactions
       WHERE id = $1 AND patient_id = $2`,
      [txId, patientId],
    );
    return tx ?? { status: 'not_found' };
  }
}
