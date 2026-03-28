import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface TaxConfiguration {
  taxType: 'VAT' | 'PAYE' | 'CUSTOM';
  rate: number;
  isInclusive: boolean;
  effectiveFrom: Date;
  effectiveTo?: Date;
  exemptions?: string[];
  description?: string;
}

export interface VATCalculationInput {
  amount: number;
  isInclusive: boolean;
  taxRate?: number; // Override default rate if provided
  exemptItems?: string[];
}

export interface VATCalculationResult {
  originalAmount: number;
  taxRate: number;
  taxAmount: number;
  amountExcludingTax: number;
  amountIncludingTax: number;
  isInclusive: boolean;
}

export interface PAYECalculationInput {
  grossSalary: number;
  employeeId?: string;
  taxPeriod?: string; // YYYY-MM format
  deductions?: {
    pension?: number;
    medical?: number;
    other?: number;
  };
}

export interface PAYECalculationResult {
  grossSalary: number;
  deductions: {
    pension: number;
    medical: number;
    other: number;
    total: number;
  };
  taxableIncome: number;
  taxBrackets: Array<{
    bracket: string;
    amount: number;
    rate: number;
    tax: number;
  }>;
  totalTax: number;
  netSalary: number;
  effectiveRate: number;
}

@Injectable()
export class TaxManagementService {
  private readonly logger = new Logger(TaxManagementService.name);

  /**
   * Get or create tax configuration
   */
  async getTaxConfiguration(
    tenantDb: DataSource,
    taxType: 'VAT' | 'PAYE' | 'CUSTOM',
  ): Promise<any> {
    const config = await tenantDb.query(
      `SELECT * FROM tax_configurations 
       WHERE tax_type = $1 
         AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
         AND effective_from <= CURRENT_DATE
       ORDER BY effective_from DESC
       LIMIT 1`,
      [taxType],
    );

    if (config.length === 0) {
      // Return default configuration
      return {
        taxType,
        rate: taxType === 'VAT' ? 15.0 : taxType === 'PAYE' ? 0 : 0,
        isInclusive: false,
        effectiveFrom: new Date(),
        exemptions: [],
      };
    }

    return {
      ...config[0],
      rate: Number(config[0].rate || 0),
      isInclusive: config[0].is_inclusive || false,
      effectiveFrom: config[0].effective_from,
      effectiveTo: config[0].effective_to,
      exemptions: config[0].exemptions || [],
    };
  }

  /**
   * Save tax configuration
   */
  async saveTaxConfiguration(
    tenantDb: DataSource,
    config: TaxConfiguration,
  ): Promise<any> {
    // Check if table exists
    const tableExists = await tenantDb.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'tax_configurations'
      )
    `);

    if (!tableExists[0]?.exists) {
      // Create table if it doesn't exist
      await tenantDb.query(`
        CREATE TABLE IF NOT EXISTS tax_configurations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tax_type VARCHAR(50) NOT NULL CHECK (tax_type IN ('VAT', 'PAYE', 'CUSTOM')),
          rate DECIMAL(5,2) NOT NULL,
          is_inclusive BOOLEAN DEFAULT false,
          effective_from DATE NOT NULL,
          effective_to DATE,
          exemptions JSONB DEFAULT '[]'::jsonb,
          description TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
    }

    const result = await tenantDb.query(
      `INSERT INTO tax_configurations (
        tax_type, rate, is_inclusive, effective_from, effective_to, exemptions, description
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        config.taxType,
        config.rate,
        config.isInclusive,
        config.effectiveFrom,
        config.effectiveTo || null,
        JSON.stringify(config.exemptions || []),
        config.description || null,
      ],
    );

    return {
      ...result[0],
      rate: Number(result[0].rate || 0),
      isInclusive: result[0].is_inclusive || false,
      effectiveFrom: result[0].effective_from,
      effectiveTo: result[0].effective_to,
      exemptions: result[0].exemptions || [],
    };
  }

  /**
   * Calculate VAT
   */
  async calculateVAT(
    tenantDb: DataSource,
    input: VATCalculationInput,
  ): Promise<VATCalculationResult> {
    // Get VAT configuration
    const vatConfig = await this.getTaxConfiguration(tenantDb, 'VAT');
    const taxRate = input.taxRate !== undefined ? input.taxRate : vatConfig.rate;
    const isInclusive = input.isInclusive !== undefined ? input.isInclusive : vatConfig.isInclusive;

    if (taxRate < 0 || taxRate > 100) {
      throw new BadRequestException('Tax rate must be between 0 and 100');
    }

    let originalAmount = input.amount;
    let taxAmount: number;
    let amountExcludingTax: number;
    let amountIncludingTax: number;

    if (isInclusive) {
      // Amount includes tax
      amountIncludingTax = originalAmount;
      amountExcludingTax = originalAmount / (1 + taxRate / 100);
      taxAmount = amountIncludingTax - amountExcludingTax;
    } else {
      // Amount excludes tax
      amountExcludingTax = originalAmount;
      taxAmount = originalAmount * (taxRate / 100);
      amountIncludingTax = amountExcludingTax + taxAmount;
    }

    return {
      originalAmount,
      taxRate,
      taxAmount: Number(taxAmount.toFixed(2)),
      amountExcludingTax: Number(amountExcludingTax.toFixed(2)),
      amountIncludingTax: Number(amountIncludingTax.toFixed(2)),
      isInclusive,
    };
  }

  /**
   * Calculate PAYE (Pay As You Earn) tax
   * Using Zimbabwe tax brackets (2024 rates as example)
   */
  async calculatePAYE(
    tenantDb: DataSource,
    input: PAYECalculationInput,
  ): Promise<PAYECalculationResult> {
    // Get PAYE configuration
    const payeConfig = await this.getTaxConfiguration(tenantDb, 'PAYE');

    // Zimbabwe PAYE tax brackets (2024 - these should be configurable)
    // Note: These are example brackets, actual rates should be in tax_configurations
    const taxBrackets = [
      { min: 0, max: 300, rate: 0 },
      { min: 300, max: 1000, rate: 20 },
      { min: 1000, max: 5000, rate: 25 },
      { min: 5000, max: Infinity, rate: 30 },
    ];

    const grossSalary = input.grossSalary;
    const deductions = {
      pension: input.deductions?.pension || 0,
      medical: input.deductions?.medical || 0,
      other: input.deductions?.other || 0,
    };

    const totalDeductions = deductions.pension + deductions.medical + deductions.other;
    const taxableIncome = Math.max(0, grossSalary - totalDeductions);

    // Calculate tax by bracket
    let remainingIncome = taxableIncome;
    let totalTax = 0;
    const bracketCalculations: Array<{
      bracket: string;
      amount: number;
      rate: number;
      tax: number;
    }> = [];

    for (const bracket of taxBrackets) {
      if (remainingIncome <= 0) break;

      const bracketMin = bracket.min;
      const bracketMax = bracket.max === Infinity ? remainingIncome : bracket.max;
      const taxableInBracket = Math.min(remainingIncome, bracketMax - bracketMin);

      if (taxableInBracket > 0) {
        const taxInBracket = taxableInBracket * (bracket.rate / 100);
        totalTax += taxInBracket;

        bracketCalculations.push({
          bracket: bracket.max === Infinity
            ? `$${bracketMin}+`
            : `$${bracketMin} - $${bracketMax}`,
          amount: taxableInBracket,
          rate: bracket.rate,
          tax: Number(taxInBracket.toFixed(2)),
        });

        remainingIncome -= taxableInBracket;
      }
    }

    const netSalary = grossSalary - totalTax - totalDeductions;
    const effectiveRate = grossSalary > 0 ? (totalTax / grossSalary) * 100 : 0;

    return {
      grossSalary,
      deductions: {
        ...deductions,
        total: totalDeductions,
      },
      taxableIncome: Number(taxableIncome.toFixed(2)),
      taxBrackets: bracketCalculations,
      totalTax: Number(totalTax.toFixed(2)),
      netSalary: Number(netSalary.toFixed(2)),
      effectiveRate: Number(effectiveRate.toFixed(2)),
    };
  }

  /**
   * Get VAT report
   */
  async getVATReport(
    tenantDb: DataSource,
    startDate: string,
    endDate: string,
  ): Promise<any> {
    const dateFrom = new Date(startDate);
    const dateTo = new Date(endDate);

    // Get all transactions with VAT
    const transactions = await tenantDb.query(
      `SELECT 
        ft.id,
        ft.transaction_date,
        ft.amount,
        ft.tax_amount,
        ft.source_module,
        b.bill_number,
        p.first_name,
        p.last_name,
        p.patient_number
       FROM financial_transactions ft
       LEFT JOIN billing b ON b.id::text = ft.source_reference_id
       LEFT JOIN patients p ON p.id = ft.patient_id
       WHERE ft.transaction_date >= $1 AND ft.transaction_date <= $2
         AND ft.tax_amount > 0
       ORDER BY ft.transaction_date ASC`,
      [dateFrom, dateTo],
    );

    const totalVAT = transactions.reduce(
      (sum: number, tx: any) => sum + Number(tx.tax_amount || 0),
      0,
    );

    const totalAmount = transactions.reduce(
      (sum: number, tx: any) => sum + Number(tx.amount || 0),
      0,
    );

    return {
      period: {
        startDate,
        endDate,
      },
      summary: {
        totalTransactions: transactions.length,
        totalAmount: Number(totalAmount.toFixed(2)),
        totalVAT: Number(totalVAT.toFixed(2)),
        amountExcludingVAT: Number((totalAmount - totalVAT).toFixed(2)),
      },
      transactions: transactions.map((tx: any) => ({
        id: tx.id,
        date: tx.transaction_date,
        amount: Number(tx.amount || 0),
        taxAmount: Number(tx.tax_amount || 0),
        sourceModule: tx.source_module,
        billNumber: tx.bill_number,
        patientName: `${tx.first_name || ''} ${tx.last_name || ''}`.trim(),
        patientNumber: tx.patient_number,
      })),
    };
  }

  /**
   * Get PAYE report
   */
  async getPAYEReport(
    tenantDb: DataSource,
    taxPeriod: string, // YYYY-MM format
  ): Promise<any> {
    // Check if payroll table exists
    const payrollTableExists = await tenantDb.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'payroll'
      )
    `);

    if (!payrollTableExists[0]?.exists) {
      return {
        period: taxPeriod,
        summary: {
          totalEmployees: 0,
          totalGrossSalary: 0,
          totalPAYE: 0,
          totalNetSalary: 0,
        },
        employees: [],
        message: 'Payroll table does not exist',
      };
    }

    const [year, month] = taxPeriod.split('-');
    const periodStart = new Date(parseInt(year), parseInt(month) - 1, 1);
    const periodEnd = new Date(parseInt(year), parseInt(month), 0);

    const payrollData = await tenantDb.query(
      `SELECT 
        p.*,
        u.first_name,
        u.last_name,
        u.email
       FROM payroll p
       LEFT JOIN users u ON u.id = p.employee_id
       WHERE p.pay_period = $1
       ORDER BY u.last_name, u.first_name`,
      [taxPeriod],
    );

    const totalGrossSalary = payrollData.reduce(
      (sum: number, p: any) => sum + Number(p.gross_salary || 0),
      0,
    );

    const totalPAYE = payrollData.reduce(
      (sum: number, p: any) => sum + Number(p.paye_tax || 0),
      0,
    );

    const totalNetSalary = payrollData.reduce(
      (sum: number, p: any) => sum + Number(p.net_salary || 0),
      0,
    );

    return {
      period: taxPeriod,
      summary: {
        totalEmployees: payrollData.length,
        totalGrossSalary: Number(totalGrossSalary.toFixed(2)),
        totalPAYE: Number(totalPAYE.toFixed(2)),
        totalNetSalary: Number(totalNetSalary.toFixed(2)),
      },
      employees: payrollData.map((p: any) => ({
        employeeId: p.employee_id,
        employeeName: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
        email: p.email,
        grossSalary: Number(p.gross_salary || 0),
        payeTax: Number(p.paye_tax || 0),
        netSalary: Number(p.net_salary || 0),
      })),
    };
  }

  /**
   * Combined tax report for a period (VAT + optional PAYE).
   * Use for Zimbabwe tax filing: taxable revenue, VAT, withholding by period.
   */
  async getTaxReport(
    tenantDb: DataSource,
    startDate: string,
    endDate: string,
    payeTaxPeriod?: string, // YYYY-MM, optional
  ): Promise<any> {
    const vatReport = await this.getVATReport(tenantDb, startDate, endDate);
    const result: any = {
      generatedAt: new Date().toISOString(),
      period: { startDate, endDate },
      taxableRevenue: vatReport.summary?.amountExcludingVAT ?? 0,
      vatAmount: vatReport.summary?.totalVAT ?? 0,
      vatSummary: vatReport.summary,
      vatTransactionCount: vatReport.summary?.totalTransactions ?? 0,
      payeAmount: null as number | null,
      payeSummary: null as any,
    };
    if (payeTaxPeriod) {
      const payeReport = await this.getPAYEReport(tenantDb, payeTaxPeriod);
      result.payeAmount = payeReport.summary?.totalPAYE ?? 0;
      result.payeSummary = payeReport.summary;
      result.payePeriod = payeTaxPeriod;
    }
    return result;
  }
}



