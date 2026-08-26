import { Controller, Get, Post, Param, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { TenantService } from '../services/tenant.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

@Controller('diagnostic')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'super_admin')
export class DiagnosticController {
  constructor(private tenantService: TenantService) {}

  @Post(':tenantId/repair-payments')
  async repairPayments(@Param('tenantId') tenantId: string, @Res() res: Response) {
    try {
      const connection = await this.tenantService.getTenantDatabase(tenantId);
      if (!connection) {
        return res.status(404).json({ message: 'Tenant DB not found' });
      }

      const appointments = await connection.query(`
        SELECT id, patient_id, appointment_date, status, payment_status, fee_amount, finance_transaction_id, created_by 
        FROM appointments 
        WHERE payment_status = 'awaiting_payment'
      `);

      const repaired = [];

      for (const apt of appointments) {
        let needsRepair = false;
        if (!apt.finance_transaction_id) {
            needsRepair = true;
        } else {
            const tx = await connection.query('SELECT id FROM financial_transactions WHERE id = $1', [apt.finance_transaction_id]);
            if (tx.length === 0) needsRepair = true;
        }

        if (needsRepair) {
             const amount = parseFloat(apt.fee_amount || '20');
             const result = await connection.query(`
                INSERT INTO financial_transactions (
                    source_module, source_reference_id, patient_id, amount, balance, currency, 
                    payment_status, notes, payer_type, created_by, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
                RETURNING id
             `, [
                'appointments', 
                apt.id, 
                apt.patient_id, 
                amount, 
                amount,
                'USD', 
                'pending',
                'Repaired transaction for appointment', 
                'self', 
                apt.created_by || null
             ]);
             
             const newTxId = result[0].id;
             
             await connection.query('UPDATE appointments SET finance_transaction_id = $1 WHERE id = $2', [newTxId, apt.id]);
             
             repaired.push({ appointmentId: apt.id, newTransactionId: newTxId });
        }
      }
      
      return res.json({ repairedCount: repaired.length, repaired });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  @Get(':tenantId/payment-mismatch')
  async checkPaymentMismatch(@Param('tenantId') tenantId: string, @Res() res: Response) {
    try {
      const connection = await this.tenantService.getTenantDatabase(tenantId);
      if (!connection) {
        return res.status(404).json({ message: 'Tenant DB not found' });
      }

      const appointments = await connection.query(`
        SELECT id, patient_id, appointment_date, status, payment_status, fee_amount, finance_transaction_id 
        FROM appointments 
        WHERE payment_status = 'awaiting_payment'
      `);

      const transactions = await connection.query(`
        SELECT id, patient_id, amount, payment_status, source_reference_id 
        FROM financial_transactions 
        WHERE payment_status = 'pending'
      `);

      const mismatches = [];
      for (const apt of appointments) {
        if (!apt.finance_transaction_id) {
            const matchingTx = transactions.find(tx => tx.patient_id === apt.patient_id && parseFloat(tx.amount) === parseFloat(apt.fee_amount));
            mismatches.push({
                type: 'missing_transaction_id',
                appointment: apt,
                potentialMatch: matchingTx || null
            });
        } else {
             const tx = transactions.find(t => t.id === apt.finance_transaction_id);
             if (!tx) {
                 const txCheck = await connection.query('SELECT * FROM financial_transactions WHERE id = $1', [apt.finance_transaction_id]);
                 mismatches.push({
                     type: 'transaction_status_mismatch_or_missing',
                     appointment: apt,
                     transaction: txCheck[0] || 'not_found'
                 });
             }
        }
      }

      return res.json({
        appointmentsCount: appointments.length,
        pendingTransactionsCount: transactions.length,
        mismatches
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
}
