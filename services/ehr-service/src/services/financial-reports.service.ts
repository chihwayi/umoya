import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Bill, BillStatus } from '../entities/billing.entity';

export interface RevenueReportFilters {
  startDate?: string;
  endDate?: string;
  period?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  serviceType?: string;
  doctorId?: string;
  groupBy?: 'day' | 'week' | 'month' | 'year' | 'service' | 'doctor';
}

export interface ProfitLossFilters {
  startDate: string;
  endDate: string;
  includeExpenses?: boolean;
}

export interface CashFlowFilters {
  startDate: string;
  endDate: string;
  includeProjected?: boolean;
}

export interface AgingReportFilters {
  asOfDate?: string;
  patientId?: string;
}

@Injectable()
export class FinancialReportsService {
  private readonly logger = new Logger(FinancialReportsService.name);

  /**
   * Get Revenue Report
   * Supports daily, weekly, monthly, yearly revenue with breakdowns
   */
  async getRevenueReport(
    tenantDb: DataSource,
    filters: RevenueReportFilters,
  ): Promise<any> {
    const { startDate, endDate, period = 'monthly', serviceType, doctorId, groupBy = 'month' } = filters;

    // Determine date range based on period
    let dateFrom: Date;
    let dateTo: Date = new Date();

    switch (period) {
      case 'daily':
        dateFrom = new Date();
        dateFrom.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        dateFrom = new Date();
        dateFrom.setDate(dateFrom.getDate() - 7);
        break;
      case 'monthly':
        dateFrom = new Date();
        dateFrom.setMonth(dateFrom.getMonth() - 1);
        break;
      case 'yearly':
        dateFrom = new Date();
        dateFrom.setFullYear(dateFrom.getFullYear() - 1);
        break;
      default:
        dateFrom = new Date();
        dateFrom.setMonth(dateFrom.getMonth() - 1);
    }

    if (startDate) dateFrom = new Date(startDate);
    if (endDate) dateTo = new Date(endDate);

    // Build base query
    let query = `
      SELECT 
        DATE(ft.transaction_date) as date,
        ft.source_module as service_type,
        ft.patient_id,
        ft.amount,
        ft.balance,
        ft.payment_status,
        b.appointment_id,
        a.doctor_id,
        u.first_name as doctor_first_name,
        u.last_name as doctor_last_name
      FROM financial_transactions ft
      LEFT JOIN billing b ON b.id::text = ft.source_reference_id AND ft.source_module = 'billing'
      LEFT JOIN appointments a ON a.id = b.appointment_id
      LEFT JOIN users u ON u.id = a.doctor_id
      WHERE ft.transaction_date >= $1 AND ft.transaction_date <= $2
        AND ft.payment_status = 'paid'
    `;

    const params: any[] = [dateFrom, dateTo];

    if (serviceType) {
      query += ` AND ft.source_module = $${params.length + 1}`;
      params.push(serviceType);
    }

    if (doctorId) {
      query += ` AND a.doctor_id = $${params.length + 1}`;
      params.push(doctorId);
    }

    const transactions = await tenantDb.query(query, params);

    // Group by specified dimension
    const grouped: Record<string, any> = {};

    transactions.forEach((tx: any) => {
      let key: string;

      switch (groupBy) {
        case 'day':
          key = tx.date.toISOString().split('T')[0];
          break;
        case 'week':
          const weekStart = new Date(tx.date);
          weekStart.setDate(weekStart.getDate() - weekStart.getDay());
          key = `Week of ${weekStart.toISOString().split('T')[0]}`;
          break;
        case 'month':
          key = `${tx.date.getFullYear()}-${String(tx.date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'year':
          key = String(tx.date.getFullYear());
          break;
        case 'service':
          key = tx.service_type || 'other';
          break;
        case 'doctor':
          key = tx.doctor_id ? `${tx.doctor_first_name} ${tx.doctor_last_name}` : 'Unknown';
          break;
        default:
          key = `${tx.date.getFullYear()}-${String(tx.date.getMonth() + 1).padStart(2, '0')}`;
      }

      if (!grouped[key]) {
        grouped[key] = {
          period: key,
          revenue: 0,
          transactionCount: 0,
          serviceTypes: {} as Record<string, number>,
          doctors: {} as Record<string, number>,
        };
      }

      grouped[key].revenue += Number(tx.amount || 0);
      grouped[key].transactionCount += 1;

      if (tx.service_type) {
        grouped[key].serviceTypes[tx.service_type] = (grouped[key].serviceTypes[tx.service_type] || 0) + Number(tx.amount || 0);
      }

      if (tx.doctor_id) {
        const doctorName = `${tx.doctor_first_name} ${tx.doctor_last_name}`;
        grouped[key].doctors[doctorName] = (grouped[key].doctors[doctorName] || 0) + Number(tx.amount || 0);
      }
    });

    // Calculate totals and trends
    const totals = {
      totalRevenue: transactions.reduce((sum: number, tx: any) => sum + Number(tx.amount || 0), 0),
      totalTransactions: transactions.length,
      averageTransaction: transactions.length > 0
        ? transactions.reduce((sum: number, tx: any) => sum + Number(tx.amount || 0), 0) / transactions.length
        : 0,
    };

    // Calculate trends (compare with previous period)
    const previousPeriodStart = new Date(dateFrom);
    const previousPeriodEnd = new Date(dateFrom);
    const periodDays = Math.ceil((dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24));
    previousPeriodStart.setDate(previousPeriodStart.getDate() - periodDays);
    previousPeriodEnd.setTime(dateFrom.getTime() - 1);

    const [previousPeriodData] = await tenantDb.query(
      `SELECT COALESCE(SUM(amount), 0) as total_revenue
       FROM financial_transactions
       WHERE transaction_date >= $1 AND transaction_date <= $2
         AND payment_status = 'paid'`,
      [previousPeriodStart, previousPeriodEnd],
    );

    const previousRevenue = Number(previousPeriodData?.total_revenue || 0);
    const currentRevenue = totals.totalRevenue;
    const revenueChange = previousRevenue > 0
      ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
      : 0;

    return {
      period: {
        startDate: dateFrom.toISOString().split('T')[0],
        endDate: dateTo.toISOString().split('T')[0],
      },
      totals,
      trends: {
        revenueChange,
        previousPeriodRevenue: previousRevenue,
        currentPeriodRevenue: currentRevenue,
      },
      breakdown: Object.values(grouped),
      filters: {
        period,
        serviceType,
        doctorId,
        groupBy,
      },
    };
  }

  /**
   * Get Profit & Loss (P&L) Statement
   */
  async getProfitLossStatement(
    tenantDb: DataSource,
    filters: ProfitLossFilters,
  ): Promise<any> {
    const { startDate, endDate, includeExpenses = true } = filters;

    const dateFrom = new Date(startDate);
    const dateTo = new Date(endDate);

    // Get all income (revenue from financial_transactions)
    const [incomeData] = await tenantDb.query(
      `SELECT 
        COALESCE(SUM(amount), 0) as total_income,
        COUNT(*) as transaction_count
       FROM financial_transactions
       WHERE transaction_date >= $1 AND transaction_date <= $2
         AND payment_status = 'paid'
         AND amount > 0`,
      [dateFrom, dateTo],
    );

    // Get income breakdown by source module
    const incomeBreakdown = await tenantDb.query(
      `SELECT 
        source_module,
        COALESCE(SUM(amount), 0) as amount,
        COUNT(*) as count
       FROM financial_transactions
       WHERE transaction_date >= $1 AND transaction_date <= $2
         AND payment_status = 'paid'
         AND amount > 0
       GROUP BY source_module
       ORDER BY amount DESC`,
      [dateFrom, dateTo],
    );

    // Get expenses (if expenses table exists, otherwise use negative transactions)
    let expenses = 0;
    let expenseBreakdown: any[] = [];

    if (includeExpenses) {
      // Check if expenses table exists
      const expenseTableCheck = await tenantDb.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'expenses'
        )
      `);

      if (expenseTableCheck[0]?.exists) {
        const [expenseData] = await tenantDb.query(
          `SELECT 
            COALESCE(SUM(amount), 0) as total_expenses
           FROM expenses
           WHERE expense_date >= $1 AND expense_date <= $2
             AND status = 'approved'`,
          [dateFrom, dateTo],
        );

        expenses = Number(expenseData?.total_expenses || 0);

        expenseBreakdown = await tenantDb.query(
          `SELECT 
            category,
            COALESCE(SUM(amount), 0) as amount,
            COUNT(*) as count
           FROM expenses
           WHERE expense_date >= $1 AND expense_date <= $2
             AND status = 'approved'
           GROUP BY category
           ORDER BY amount DESC`,
          [dateFrom, dateTo],
        );
      } else {
        // Use negative transactions as expenses
        const [expenseData] = await tenantDb.query(
          `SELECT 
            COALESCE(SUM(ABS(amount)), 0) as total_expenses
           FROM financial_transactions
           WHERE transaction_date >= $1 AND transaction_date <= $2
             AND amount < 0`,
          [dateFrom, dateTo],
        );

        expenses = Number(expenseData?.total_expenses || 0);
      }
    }

    const totalIncome = Number(incomeData?.total_income || 0);
    const netProfit = totalIncome - expenses;
    const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

    return {
      period: {
        startDate: startDate,
        endDate: endDate,
      },
      income: {
        total: totalIncome,
        transactionCount: Number(incomeData?.transaction_count || 0),
        breakdown: incomeBreakdown.map((item: any) => ({
          source: item.source_module || 'other',
          amount: Number(item.amount || 0),
          count: Number(item.count || 0),
        })),
      },
      expenses: {
        total: expenses,
        breakdown: expenseBreakdown.map((item: any) => ({
          category: item.category || 'other',
          amount: Number(item.amount || 0),
          count: Number(item.count || 0),
        })),
      },
      profit: {
        netProfit,
        profitMargin: Number(profitMargin.toFixed(2)),
      },
    };
  }

  /**
   * Get Cash Flow Report
   */
  async getCashFlowReport(
    tenantDb: DataSource,
    filters: CashFlowFilters,
  ): Promise<any> {
    const { startDate, endDate, includeProjected = false } = filters;

    const dateFrom = new Date(startDate);
    const dateTo = new Date(endDate);

    // Get cash inflows (payments received)
    const inflows = await tenantDb.query(
      `SELECT 
        DATE(fp.received_at) as date,
        COALESCE(SUM(fp.amount), 0) as amount,
        fp.payment_method,
        COUNT(*) as transaction_count
       FROM financial_payments fp
       WHERE fp.received_at >= $1 AND fp.received_at <= $2
         AND fp.status = 'completed'
       GROUP BY DATE(fp.received_at), fp.payment_method
       ORDER BY date ASC`,
      [dateFrom, dateTo],
    );

    // Get cash outflows (expenses, refunds, etc.)
    let outflows: any[] = [];

    const expenseTableCheck = await tenantDb.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'expenses'
      )
    `);

    if (expenseTableCheck[0]?.exists) {
      outflows = await tenantDb.query(
        `SELECT 
          DATE(expense_date) as date,
          COALESCE(SUM(amount), 0) as amount,
          category as payment_method,
          COUNT(*) as transaction_count
         FROM expenses
         WHERE expense_date >= $1 AND expense_date <= $2
           AND status = 'approved'
         GROUP BY DATE(expense_date), category
         ORDER BY date ASC`,
        [dateFrom, dateTo],
      );
    }

    // Calculate net cash flow by period
    const dailyCashFlow: Record<string, { inflow: number; outflow: number; net: number }> = {};

    inflows.forEach((item: any) => {
      const dateKey = item.date.toISOString().split('T')[0];
      if (!dailyCashFlow[dateKey]) {
        dailyCashFlow[dateKey] = { inflow: 0, outflow: 0, net: 0 };
      }
      dailyCashFlow[dateKey].inflow += Number(item.amount || 0);
    });

    outflows.forEach((item: any) => {
      const dateKey = item.date.toISOString().split('T')[0];
      if (!dailyCashFlow[dateKey]) {
        dailyCashFlow[dateKey] = { inflow: 0, outflow: 0, net: 0 };
      }
      dailyCashFlow[dateKey].outflow += Number(item.amount || 0);
    });

    // Calculate net for each day
    Object.keys(dailyCashFlow).forEach((dateKey) => {
      dailyCashFlow[dateKey].net = dailyCashFlow[dateKey].inflow - dailyCashFlow[dateKey].outflow;
    });

    const totalInflow = inflows.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
    const totalOutflow = outflows.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
    const netCashFlow = totalInflow - totalOutflow;

    // Get projected cash flow (if requested)
    let projectedCashFlow = null;
    if (includeProjected) {
      // Get pending payments (expected inflows)
      const [projectedInflows] = await tenantDb.query(
        `SELECT 
          COALESCE(SUM(balance), 0) as projected_amount
         FROM financial_transactions
         WHERE due_date >= $1 AND due_date <= $2
           AND payment_status != 'paid'
           AND balance > 0`,
        [dateFrom, dateTo],
      );

      projectedCashFlow = {
        projectedInflows: Number(projectedInflows?.projected_amount || 0),
        projectedNetCashFlow: netCashFlow + Number(projectedInflows?.projected_amount || 0),
      };
    }

    return {
      period: {
        startDate: startDate,
        endDate: endDate,
      },
      inflows: {
        total: totalInflow,
        breakdown: inflows.map((item: any) => ({
          date: item.date.toISOString().split('T')[0],
          amount: Number(item.amount || 0),
          paymentMethod: item.payment_method,
          transactionCount: Number(item.transaction_count || 0),
        })),
      },
      outflows: {
        total: totalOutflow,
        breakdown: outflows.map((item: any) => ({
          date: item.date.toISOString().split('T')[0],
          amount: Number(item.amount || 0),
          category: item.payment_method,
          transactionCount: Number(item.transaction_count || 0),
        })),
      },
      netCashFlow,
      dailyCashFlow: Object.entries(dailyCashFlow).map(([date, flow]) => ({
        date,
        ...flow,
      })),
      projected: projectedCashFlow,
    };
  }

  /**
   * Get Accounts Receivable Aging Report
   */
  async getAgingReport(
    tenantDb: DataSource,
    filters: AgingReportFilters,
  ): Promise<any> {
    const asOfDate = filters.asOfDate ? new Date(filters.asOfDate) : new Date();

    let query = `
      SELECT 
        ft.id,
        ft.patient_id,
        ft.amount,
        ft.balance,
        ft.transaction_date,
        ft.due_date,
        ft.source_module,
        ft.source_reference_id,
        p.first_name,
        p.last_name,
        p.patient_number,
        CASE
          WHEN ft.payment_status = 'paid' THEN 0
          WHEN ft.due_date IS NULL OR ft.due_date >= $1 THEN 0
          WHEN ft.due_date < $1 AND ft.due_date >= $1 - INTERVAL '30 days' THEN 
            EXTRACT(DAY FROM ($1 - ft.due_date))::INTEGER
          WHEN ft.due_date < $1 - INTERVAL '30 days' AND ft.due_date >= $1 - INTERVAL '60 days' THEN 
            EXTRACT(DAY FROM ($1 - ft.due_date))::INTEGER
          WHEN ft.due_date < $1 - INTERVAL '60 days' AND ft.due_date >= $1 - INTERVAL '90 days' THEN 
            EXTRACT(DAY FROM ($1 - ft.due_date))::INTEGER
          ELSE EXTRACT(DAY FROM ($1 - ft.due_date))::INTEGER
        END as days_overdue,
        CASE
          WHEN ft.payment_status = 'paid' THEN 'current'
          WHEN ft.due_date IS NULL OR ft.due_date >= $1 THEN 'current'
          WHEN ft.due_date < $1 AND ft.due_date >= $1 - INTERVAL '30 days' THEN '0-30'
          WHEN ft.due_date < $1 - INTERVAL '30 days' AND ft.due_date >= $1 - INTERVAL '60 days' THEN '31-60'
          WHEN ft.due_date < $1 - INTERVAL '60 days' AND ft.due_date >= $1 - INTERVAL '90 days' THEN '61-90'
          ELSE 'over-90'
        END as aging_bucket
      FROM financial_transactions ft
      LEFT JOIN patients p ON p.id = ft.patient_id
      WHERE ft.payment_status != 'paid'
        AND ft.balance > 0
    `;

    const params: any[] = [asOfDate];

    if (filters.patientId) {
      query += ` AND ft.patient_id = $${params.length + 1}`;
      params.push(filters.patientId);
    }

    query += ` ORDER BY ft.due_date ASC NULLS LAST`;

    const transactions = await tenantDb.query(query, params);

    // Group by aging bucket
    const buckets = {
      current: { amount: 0, count: 0, transactions: [] as any[] },
      '0-30': { amount: 0, count: 0, transactions: [] as any[] },
      '31-60': { amount: 0, count: 0, transactions: [] as any[] },
      '61-90': { amount: 0, count: 0, transactions: [] as any[] },
      'over-90': { amount: 0, count: 0, transactions: [] as any[] },
    };

    transactions.forEach((tx: any) => {
      const bucket = tx.aging_bucket as keyof typeof buckets;
      if (buckets[bucket]) {
        buckets[bucket].amount += Number(tx.balance || 0);
        buckets[bucket].count += 1;
        buckets[bucket].transactions.push({
          id: tx.id,
          patientId: tx.patient_id,
          patientName: `${tx.first_name} ${tx.last_name}`,
          patientNumber: tx.patient_number,
          amount: Number(tx.amount || 0),
          balance: Number(tx.balance || 0),
          transactionDate: tx.transaction_date,
          dueDate: tx.due_date,
          daysOverdue: tx.days_overdue,
          sourceModule: tx.source_module,
        });
      }
    });

    const totalOutstanding = Object.values(buckets).reduce(
      (sum, bucket) => sum + bucket.amount,
      0,
    );

    return {
      asOfDate: asOfDate.toISOString().split('T')[0],
      totalOutstanding,
      buckets: Object.entries(buckets).map(([bucket, data]) => ({
        bucket,
        amount: data.amount,
        count: data.count,
        percentage: totalOutstanding > 0 ? (data.amount / totalOutstanding) * 100 : 0,
        transactions: data.transactions,
      })),
      summary: {
        totalAccounts: transactions.length,
        totalOutstanding,
        averageOutstanding: transactions.length > 0 ? totalOutstanding / transactions.length : 0,
      },
    };
  }
}
