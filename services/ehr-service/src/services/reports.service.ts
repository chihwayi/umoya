import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Patient } from '../entities/patient.entity';
import { AppointmentSimple } from '../entities/appointment-simple.entity';
import { MedicalRecord } from '../entities/medical-record.entity';
import { Prescription, PrescriptionStatus } from '../entities/prescription.entity';
import { LabOrder, LabOrderStatus } from '../entities/lab-order.entity';
import { Bill, BillStatus } from '../entities/billing.entity';

@Injectable()
export class ReportsService {
  
  async getPatientSummary(patientId: string, tenantDb: DataSource) {
    const patientRepo = tenantDb.getRepository(Patient);
    const appointmentRepo = tenantDb.getRepository(AppointmentSimple);
    const recordRepo = tenantDb.getRepository(MedicalRecord);
    const prescriptionRepo = tenantDb.getRepository(Prescription);
    const labRepo = tenantDb.getRepository(LabOrder);

    const patient = await patientRepo.findOne({ where: { id: patientId } });
    const appointments = await appointmentRepo.find({ where: { patientId } });
    const records = await recordRepo.find({ where: { patientId } });
    const prescriptions = await prescriptionRepo.find({ where: { patientId } });
    const labOrders = await labRepo.find({ where: { patientId } });

    return {
      patient,
      summary: {
        totalVisits: appointments.length,
        lastVisit: appointments[0]?.appointmentDate,
        activePrescriptions: prescriptions.filter((p) => p.status === PrescriptionStatus.ACTIVE).length,
        pendingLabResults: labOrders.filter(
          (l) => l.status !== LabOrderStatus.COMPLETED && l.status !== LabOrderStatus.CANCELLED,
        ).length,
        chronicConditions: patient?.medicalHistory?.split(',') || [],
      },
      recentActivity: {
        appointments: appointments.slice(0, 5),
        prescriptions: prescriptions.slice(0, 5),
        labOrders: labOrders.slice(0, 5)
      }
    };
  }

  async getFinancialReport(query: any, tenantDb: DataSource) {
    const billRepo = tenantDb.getRepository(Bill);
    
    let queryBuilder = billRepo.createQueryBuilder('bill');
    
    if (query.startDate && query.endDate) {
      queryBuilder.andWhere('bill.createdAt BETWEEN :startDate AND :endDate', {
        startDate: query.startDate,
        endDate: query.endDate
      });
    }

    const bills = await queryBuilder.getMany();
    
    const totalRevenue = bills.reduce((sum, bill) => sum + Number(bill.totalAmount), 0);
    const paidBills = bills.filter((b) => b.status === BillStatus.PAID);
    const pendingBills = bills.filter((b) => b.status === BillStatus.PENDING);
    
    return {
      period: { startDate: query.startDate, endDate: query.endDate },
      summary: {
        totalRevenue,
        paidAmount: paidBills.reduce((sum, bill) => sum + Number(bill.totalAmount), 0),
        pendingAmount: pendingBills.reduce((sum, bill) => sum + Number(bill.totalAmount), 0),
        totalBills: bills.length,
        paidBills: paidBills.length,
        pendingBills: pendingBills.length
      },
      currency: 'USD', // Support for ZWL/USD
      breakdown: {
        byStatus: {
          paid: paidBills.length,
          pending: pendingBills.length,
          overdue: bills.filter((b) => b.status === BillStatus.OVERDUE).length,
        },
      }
    };
  }

  async getClinicalReport(query: any, tenantDb: DataSource) {
    const appointmentRepo = tenantDb.getRepository(AppointmentSimple);
    const recordRepo = tenantDb.getRepository(MedicalRecord);
    const prescriptionRepo = tenantDb.getRepository(Prescription);
    
    const appointments = await appointmentRepo.find();
    const records = await recordRepo.find();
    const prescriptions = await prescriptionRepo.find();

    // Common diagnoses analysis
    const diagnoses = records.flatMap((record) => record.diagnoses?.map((diagnosis) => diagnosis.description) ?? []);
    const diagnosisCount = diagnoses.reduce<Record<string, number>>((acc, diagnosis) => {
      if (diagnosis) {
        acc[diagnosis] = (acc[diagnosis] || 0) + 1;
      }
      return acc;
    }, {});

    return {
      period: { startDate: query.startDate, endDate: query.endDate },
      summary: {
        totalConsultations: appointments.length,
        completedConsultations: appointments.filter(a => a.status === 'completed').length,
        totalPrescriptions: prescriptions.length,
        activePrescriptions: prescriptions.filter((p) => p.status === PrescriptionStatus.ACTIVE).length,
      },
      topDiagnoses: Object.entries(diagnosisCount)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .slice(0, 10)
        .map(([diagnosis, count]) => ({ diagnosis, count })),
      appointmentTrends: {
        scheduled: appointments.filter(a => a.status === 'scheduled').length,
        completed: appointments.filter(a => a.status === 'completed').length,
        cancelled: appointments.filter(a => a.status === 'cancelled').length,
        noShow: appointments.filter(a => a.status === 'no_show').length
      }
    };
  }

  async getDashboardData(tenantDb: DataSource) {
    const patientRepo = tenantDb.getRepository(Patient);
    const appointmentRepo = tenantDb.getRepository(AppointmentSimple);
    const billRepo = tenantDb.getRepository(Bill);
    const prescriptionRepo = tenantDb.getRepository(Prescription);

    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      totalPatients,
      todayAppointments,
      monthlyRevenue,
      activePrescriptions
    ] = await Promise.all([
      patientRepo.count({ where: { isActive: true } }),
      appointmentRepo.count({
        where: {
          appointmentDate: today
        }
      }),
      billRepo.createQueryBuilder('bill')
        .select('SUM(bill.totalAmount)', 'total')
        .where('bill.createdAt >= :startOfMonth', { startOfMonth })
        .getRawOne(),
      prescriptionRepo.count({ where: { status: PrescriptionStatus.ACTIVE } }),
    ]);

    return {
      overview: {
        totalPatients,
        todayAppointments,
        monthlyRevenue: Number(monthlyRevenue?.total || 0),
        activePrescriptions
      },
      recentActivity: {
        newPatients: 5, // Last 7 days
        completedAppointments: 23, // This week
        pendingLabResults: 8,
        overduePayments: 3
      },
      alerts: [
        { type: 'info', message: 'System backup completed successfully' },
        { type: 'warning', message: '3 patients have overdue appointments' }
      ]
    };
  }

  async getAppointmentsReport(query: any, tenantDb: DataSource) {
    const appointmentRepo = tenantDb.getRepository(AppointmentSimple);
    
    const appointments = await appointmentRepo.find({
      relations: ['patient'],
      order: { appointmentDate: 'DESC' }
    });

    return {
      total: appointments.length,
      byStatus: {
        scheduled: appointments.filter(a => a.status === 'scheduled').length,
        completed: appointments.filter(a => a.status === 'completed').length,
        cancelled: appointments.filter(a => a.status === 'cancelled').length,
        noShow: appointments.filter(a => a.status === 'no_show').length
      },
      appointments: appointments.slice(0, 50) // Limit for performance
    };
  }

  async getPrescriptionsReport(query: any, tenantDb: DataSource) {
    const prescriptionRepo = tenantDb.getRepository(Prescription);
    
    const prescriptions = await prescriptionRepo.find({
      relations: ['patient'],
      order: { createdAt: 'DESC' }
    });

    // Most prescribed medications
    const medicationCount = prescriptions.reduce((acc, prescription) => {
      acc[prescription.medicationName] = (acc[prescription.medicationName] || 0) + 1;
      return acc;
    }, {});

    return {
      total: prescriptions.length,
      byStatus: {
        active: prescriptions.filter((p) => p.status === PrescriptionStatus.ACTIVE).length,
        completed: prescriptions.filter((p) => p.status === PrescriptionStatus.COMPLETED).length,
        cancelled: prescriptions.filter((p) => p.status === PrescriptionStatus.CANCELLED).length,
      },
      topMedications: Object.entries(medicationCount)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .slice(0, 10)
        .map(([medication, count]) => ({ medication, count })),
      prescriptions: prescriptions.slice(0, 50)
    };
  }

  async getLabResultsReport(query: any, tenantDb: DataSource) {
    const labRepo = tenantDb.getRepository(LabOrder);
    
    const labOrders = await labRepo.find({
      relations: ['patient'],
      order: { createdAt: 'DESC' }
    });

    return {
      total: labOrders.length,
      byStatus: {
        pending: labOrders.filter((l) => l.status === LabOrderStatus.ORDERED).length,
        completed: labOrders.filter((l) => l.status === LabOrderStatus.COMPLETED).length,
        cancelled: labOrders.filter((l) => l.status === LabOrderStatus.CANCELLED).length,
      },
      turnaroundTime: {
        average: '2.5 days',
        fastest: '4 hours',
        slowest: '7 days'
      },
      labOrders: labOrders.slice(0, 50)
    };
  }

  async getModuleGeneralReport(moduleKey: string, tenantDb: DataSource, days = 30) {
    const normalizedDays = this.normalizeDays(days);
    const since = this.sinceDate(normalizedDays);
    const module = this.normalizeModuleKey(moduleKey);

    switch (module) {
      case 'mar':
        return this.getMarGeneralReport(tenantDb, since, normalizedDays);
      case 'blood_bank':
        return this.getBloodBankGeneralReport(tenantDb, since, normalizedDays);
      case 'sepsis':
        return this.getSepsisGeneralReport(tenantDb, since, normalizedDays);
      case 'infection_control':
        return this.getInfectionControlGeneralReport(tenantDb, since, normalizedDays);
      case 'cdi':
        return this.getCdiGeneralReport(tenantDb, since, normalizedDays);
      case 'revenue_cycle':
        return this.getRevenueCycleGeneralReport(tenantDb, since, normalizedDays);
      case 'population_health':
        return this.getPopulationHealthGeneralReport(tenantDb, since, normalizedDays);
      case 'hiv':
        return this.getHivGeneralReport(tenantDb, since, normalizedDays);
      default:
        return {
          module,
          available: false,
          periodDays: normalizedDays,
          generatedAt: new Date().toISOString(),
          message: `General report is not configured for module "${moduleKey}".`,
          stats: [],
          highlights: [],
          recommendations: [],
        };
    }
  }

  private normalizeModuleKey(input: string): string {
    const key = String(input || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/-/g, '_');
    const aliases: Record<string, string> = {
      medication_administration_record: 'mar',
      medication_administration_records: 'mar',
      bcma: 'mar',
      blood_bank_dashboard: 'blood_bank',
      infection_control_and_epidemiology: 'infection_control',
      clinical_documentation_improvement: 'cdi',
      revenue_cycle_management: 'revenue_cycle',
      population_health_management: 'population_health',
      hiv_aids: 'hiv',
      hiv_aids_program: 'hiv',
    };
    return aliases[key] || key;
  }

  private normalizeDays(days?: number): number {
    const value = Number(days);
    if (!Number.isFinite(value)) return 30;
    return Math.min(Math.max(Math.round(value), 7), 365);
  }

  private sinceDate(days: number): Date {
    const now = new Date();
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  }

  private toNumber(value: any): number {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  private async tableExists(tenantDb: DataSource, tableName: string): Promise<boolean> {
    try {
      const [row] = await tenantDb.query(
        `SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = $1
        ) AS exists`,
        [tableName],
      );
      return Boolean(row?.exists);
    } catch {
      return false;
    }
  }

  private async getMarGeneralReport(tenantDb: DataSource, since: Date, periodDays: number) {
    const hasMar = await this.tableExists(tenantDb, 'medication_administration_records');
    if (!hasMar) {
      return this.unavailableReport('mar', periodDays);
    }
    const [counts] = await tenantDb.query(
      `
      SELECT
        COUNT(*)::int AS total_rows,
        COUNT(*) FILTER (WHERE administration_status = 'administered')::int AS administered,
        COUNT(*) FILTER (WHERE administration_status = 'held')::int AS held,
        COUNT(*) FILTER (WHERE administration_status = 'refused')::int AS refused,
        COUNT(*) FILTER (WHERE administration_status IN ('pending', 'scheduled') AND scheduled_time < NOW())::int AS overdue
      FROM medication_administration_records
      WHERE created_at >= $1
      `,
      [since],
    );

    let openAlerts = 0;
    if (await this.tableExists(tenantDb, 'medication_alerts')) {
      const [alerts] = await tenantDb.query(
        `
        SELECT COUNT(*)::int AS open_alerts
        FROM medication_alerts
        WHERE acknowledged = false AND created_at >= $1
        `,
        [since],
      );
      openAlerts = this.toNumber(alerts?.open_alerts);
    }

    return {
      module: 'mar',
      available: true,
      periodDays,
      generatedAt: new Date().toISOString(),
      stats: [
        { key: 'total_rows', label: 'Medication rows', value: this.toNumber(counts?.total_rows), tone: 'info' },
        { key: 'administered', label: 'Administered', value: this.toNumber(counts?.administered), tone: 'good' },
        { key: 'held', label: 'Held', value: this.toNumber(counts?.held), tone: 'warning' },
        { key: 'refused', label: 'Refused', value: this.toNumber(counts?.refused), tone: 'warning' },
        { key: 'overdue', label: 'Overdue', value: this.toNumber(counts?.overdue), tone: 'critical' },
        { key: 'open_alerts', label: 'Open safety alerts', value: openAlerts, tone: openAlerts > 0 ? 'critical' : 'good' },
      ],
      highlights: [
        `Track held/refused rows to reduce omission risk and improve adherence follow-up.`,
        `Review overdue administrations and unresolved medication safety alerts in shift handoff.`,
      ],
      recommendations: [
        'Escalate overdue or high-alert administrations before shift close.',
        'Use MAR risk worklist filters daily for proactive nurse-provider interventions.',
      ],
    };
  }

  private async getBloodBankGeneralReport(tenantDb: DataSource, since: Date, periodDays: number) {
    const hasInventory = await this.tableExists(tenantDb, 'blood_inventory');
    const hasTransfusions = await this.tableExists(tenantDb, 'blood_transfusions');
    if (!hasInventory && !hasTransfusions) {
      return this.unavailableReport('blood_bank', periodDays);
    }

    let inventorySummary = { available_units: 0, expiring_soon: 0 };
    if (hasInventory) {
      const [inventory] = await tenantDb.query(
        `
        SELECT
          COUNT(*) FILTER (WHERE status = 'available')::int AS available_units,
          COUNT(*) FILTER (WHERE status = 'available' AND expiry_date <= NOW() + INTERVAL '7 days')::int AS expiring_soon
        FROM blood_inventory
        `,
      );
      inventorySummary = {
        available_units: this.toNumber(inventory?.available_units),
        expiring_soon: this.toNumber(inventory?.expiring_soon),
      };
    }

    let transfusionSummary = { ordered: 0, in_progress: 0, completed: 0, reactions: 0 };
    if (hasTransfusions) {
      const [transfusions] = await tenantDb.query(
        `
        SELECT
          COUNT(*) FILTER (WHERE transfusion_status = 'ordered')::int AS ordered,
          COUNT(*) FILTER (WHERE transfusion_status = 'in_progress')::int AS in_progress,
          COUNT(*) FILTER (WHERE transfusion_status = 'completed')::int AS completed
        FROM blood_transfusions
        WHERE order_date >= $1
        `,
        [since],
      );
      transfusionSummary = {
        ordered: this.toNumber(transfusions?.ordered),
        in_progress: this.toNumber(transfusions?.in_progress),
        completed: this.toNumber(transfusions?.completed),
        reactions: 0,
      };
    }

    if (await this.tableExists(tenantDb, 'transfusion_reactions')) {
      const [reactions] = await tenantDb.query(
        `
        SELECT COUNT(*)::int AS reactions
        FROM transfusion_reactions
        WHERE created_at >= $1
        `,
        [since],
      );
      transfusionSummary.reactions = this.toNumber(reactions?.reactions);
    }

    return {
      module: 'blood_bank',
      available: true,
      periodDays,
      generatedAt: new Date().toISOString(),
      stats: [
        { key: 'available_units', label: 'Available units', value: inventorySummary.available_units, tone: 'info' },
        { key: 'expiring_soon', label: 'Expiring ≤7d', value: inventorySummary.expiring_soon, tone: inventorySummary.expiring_soon > 0 ? 'warning' : 'good' },
        { key: 'ordered', label: 'Transfusions ordered', value: transfusionSummary.ordered, tone: 'info' },
        { key: 'in_progress', label: 'In progress', value: transfusionSummary.in_progress, tone: 'warning' },
        { key: 'completed', label: 'Completed', value: transfusionSummary.completed, tone: 'good' },
        { key: 'reactions', label: 'Reactions logged', value: transfusionSummary.reactions, tone: transfusionSummary.reactions > 0 ? 'critical' : 'good' },
      ],
      highlights: [
        'Monitor expiry pressure and transfusion reaction trends to reduce wastage and safety risk.',
        'Keep crossmatch and consent documentation complete before starting transfusions.',
      ],
      recommendations: [
        'Prioritize units nearing expiry for compatible recipients and planned use.',
        'Review reaction incidents in transfusion safety meetings weekly.',
      ],
    };
  }

  private async getSepsisGeneralReport(tenantDb: DataSource, since: Date, periodDays: number) {
    const hasBundles = await this.tableExists(tenantDb, 'sepsis_bundles');
    if (!hasBundles) {
      return this.unavailableReport('sepsis', periodDays);
    }
    const [bundles] = await tenantDb.query(
      `
      SELECT
        COUNT(*)::int AS total_bundles,
        COUNT(*) FILTER (WHERE three_hour_bundle_complete = true)::int AS three_hour_complete,
        COUNT(*) FILTER (WHERE six_hour_bundle_complete = true)::int AS six_hour_complete,
        COUNT(*) FILTER (WHERE overall_compliance = true)::int AS overall_compliant
      FROM sepsis_bundles
      WHERE bundle_start_time >= $1
      `,
      [since],
    );

    let alerts = 0;
    if (await this.tableExists(tenantDb, 'sepsis_screenings')) {
      const [screenings] = await tenantDb.query(
        `
        SELECT COUNT(*)::int AS active_alerts
        FROM sepsis_screenings
        WHERE screening_datetime >= $1
          AND sepsis_suspected = true
        `,
        [since],
      );
      alerts = this.toNumber(screenings?.active_alerts);
    }

    const totalBundles = this.toNumber(bundles?.total_bundles);
    const overallCompliant = this.toNumber(bundles?.overall_compliant);
    const compliancePct = totalBundles > 0 ? Math.round((overallCompliant / totalBundles) * 100) : 0;

    return {
      module: 'sepsis',
      available: true,
      periodDays,
      generatedAt: new Date().toISOString(),
      stats: [
        { key: 'total_bundles', label: 'Bundles started', value: totalBundles, tone: 'info' },
        { key: 'three_hour_complete', label: '3h complete', value: this.toNumber(bundles?.three_hour_complete), tone: 'good' },
        { key: 'six_hour_complete', label: '6h complete', value: this.toNumber(bundles?.six_hour_complete), tone: 'good' },
        { key: 'overall_compliant', label: 'Overall compliant', value: overallCompliant, tone: 'good' },
        { key: 'overall_compliance_percent', label: 'Compliance %', value: compliancePct, tone: compliancePct < 80 ? 'warning' : 'good' },
        { key: 'active_alerts', label: 'Sepsis suspected alerts', value: alerts, tone: alerts > 0 ? 'critical' : 'info' },
      ],
      highlights: [
        'Bundle completion within 3h/6h windows is the primary quality and mortality leverage point.',
        'Track active sepsis-suspected screenings to minimize alert-to-action delay.',
      ],
      recommendations: [
        'Escalate severe sepsis alerts immediately when bundle actions are incomplete.',
        'Review non-compliant cases in daily multidisciplinary quality huddle.',
      ],
    };
  }

  private async getInfectionControlGeneralReport(tenantDb: DataSource, since: Date, periodDays: number) {
    const hasInfections = await this.tableExists(tenantDb, 'infection_surveillance');
    if (!hasInfections) {
      return this.unavailableReport('infection_control', periodDays);
    }

    const [infectionSummary] = await tenantDb.query(
      `
      SELECT
        COUNT(*)::int AS total_cases,
        COUNT(*) FILTER (WHERE COALESCE(resolved, false) = false)::int AS unresolved,
        COUNT(*) FILTER (WHERE onset_type = 'hospital_acquired')::int AS hospital_acquired,
        COUNT(*) FILTER (WHERE device_associated = true)::int AS device_associated
      FROM infection_surveillance
      WHERE infection_date >= $1
      `,
      [since],
    );

    let activeIsolation = 0;
    if (await this.tableExists(tenantDb, 'isolation_precautions')) {
      const [isolation] = await tenantDb.query(
        `
        SELECT COUNT(*)::int AS active_isolation
        FROM isolation_precautions
        WHERE status = 'active'
        `,
      );
      activeIsolation = this.toNumber(isolation?.active_isolation);
    }

    let stewardshipOpen = 0;
    if (await this.tableExists(tenantDb, 'antimicrobial_stewardship')) {
      const [stewardship] = await tenantDb.query(
        `
        SELECT COUNT(*)::int AS open_stewardship
        FROM antimicrobial_stewardship
        WHERE review_status IN ('pending', 'in_progress')
          AND start_date >= $1
        `,
        [since],
      );
      stewardshipOpen = this.toNumber(stewardship?.open_stewardship);
    }

    return {
      module: 'infection_control',
      available: true,
      periodDays,
      generatedAt: new Date().toISOString(),
      stats: [
        { key: 'total_cases', label: 'Infection cases', value: this.toNumber(infectionSummary?.total_cases), tone: 'info' },
        { key: 'unresolved', label: 'Unresolved', value: this.toNumber(infectionSummary?.unresolved), tone: 'critical' },
        { key: 'hospital_acquired', label: 'Hospital-acquired', value: this.toNumber(infectionSummary?.hospital_acquired), tone: 'warning' },
        { key: 'device_associated', label: 'Device-associated', value: this.toNumber(infectionSummary?.device_associated), tone: 'warning' },
        { key: 'active_isolation', label: 'Active isolation', value: activeIsolation, tone: 'info' },
        { key: 'stewardship_open', label: 'Stewardship open', value: stewardshipOpen, tone: stewardshipOpen > 0 ? 'warning' : 'good' },
      ],
      highlights: [
        'Unresolved hospital-acquired and device-associated infections should drive IPC action queues.',
        'Active stewardship backlog is a leading indicator for antimicrobial optimization risk.',
      ],
      recommendations: [
        'Close unresolved IPC cases with documented containment and follow-up outcomes.',
        'Review high-risk stewardship cases in daily antimicrobial rounds.',
      ],
    };
  }

  private async getCdiGeneralReport(tenantDb: DataSource, since: Date, periodDays: number) {
    const hasQueries = await this.tableExists(tenantDb, 'physician_queries');
    if (!hasQueries) {
      return this.unavailableReport('cdi', periodDays);
    }

    const [summary] = await tenantDb.query(
      `
      SELECT
        COUNT(*)::int AS total_queries,
        COUNT(*) FILTER (WHERE query_status = 'answered')::int AS answered,
        COUNT(*) FILTER (WHERE query_status IN ('sent', 'draft'))::int AS open_queries,
        COUNT(*) FILTER (WHERE priority = 'stat')::int AS stat_queries,
        COUNT(*) FILTER (WHERE priority = 'urgent')::int AS urgent_queries,
        COALESCE(SUM(financial_impact), 0)::numeric AS financial_impact_total
      FROM physician_queries
      WHERE query_date >= $1
      `,
      [since],
    );

    const total = this.toNumber(summary?.total_queries);
    const answered = this.toNumber(summary?.answered);
    const responseRate = total > 0 ? Math.round((answered / total) * 100) : 0;

    return {
      module: 'cdi',
      available: true,
      periodDays,
      generatedAt: new Date().toISOString(),
      stats: [
        { key: 'total_queries', label: 'Total queries', value: total, tone: 'info' },
        { key: 'open_queries', label: 'Open', value: this.toNumber(summary?.open_queries), tone: 'warning' },
        { key: 'answered', label: 'Answered', value: answered, tone: 'good' },
        { key: 'response_rate_percent', label: 'Response %', value: responseRate, tone: responseRate < 75 ? 'warning' : 'good' },
        { key: 'stat_urgent', label: 'Stat + urgent', value: this.toNumber(summary?.stat_queries) + this.toNumber(summary?.urgent_queries), tone: 'critical' },
        { key: 'financial_impact_total', label: 'Financial impact', value: this.toNumber(summary?.financial_impact_total), tone: 'info', format: 'currency' },
      ],
      highlights: [
        'Open high-priority CDI queries are a direct risk for coding quality and reimbursement.',
        'Response-rate trend should be monitored alongside documentation gap rates.',
      ],
      recommendations: [
        'Prioritize stat/urgent physician queries before routine CDI tasks.',
        'Close documentation gaps that block DRG and impact estimation completeness.',
      ],
    };
  }

  private async getRevenueCycleGeneralReport(tenantDb: DataSource, since: Date, periodDays: number) {
    const hasCharges = await this.tableExists(tenantDb, 'patient_charges');
    if (!hasCharges) {
      return this.unavailableReport('revenue_cycle', periodDays);
    }

    const [summary] = await tenantDb.query(
      `
      SELECT
        COUNT(*)::int AS total_charges,
        COUNT(*) FILTER (WHERE charge_status IN ('pending', 'reviewed'))::int AS open_charges,
        COUNT(*) FILTER (WHERE charge_status = 'approved')::int AS approved,
        COUNT(*) FILTER (WHERE charge_status = 'rejected')::int AS rejected,
        COALESCE(SUM(total_charge), 0)::numeric AS total_value,
        COALESCE(SUM(total_charge) FILTER (WHERE charge_status IN ('pending', 'reviewed')), 0)::numeric AS open_value
      FROM patient_charges
      WHERE service_date >= $1
      `,
      [since],
    );

    return {
      module: 'revenue_cycle',
      available: true,
      periodDays,
      generatedAt: new Date().toISOString(),
      stats: [
        { key: 'total_charges', label: 'Charges', value: this.toNumber(summary?.total_charges), tone: 'info' },
        { key: 'open_charges', label: 'Open', value: this.toNumber(summary?.open_charges), tone: 'warning' },
        { key: 'approved', label: 'Approved', value: this.toNumber(summary?.approved), tone: 'good' },
        { key: 'rejected', label: 'Rejected', value: this.toNumber(summary?.rejected), tone: 'critical' },
        { key: 'total_value', label: 'Total value', value: this.toNumber(summary?.total_value), tone: 'info', format: 'currency' },
        { key: 'open_value', label: 'Open value at risk', value: this.toNumber(summary?.open_value), tone: 'warning', format: 'currency' },
      ],
      highlights: [
        'Open reviewed charges and coding defects increase denial and leakage exposure.',
        'Approval velocity is critical to preserving billing cycle timeliness.',
      ],
      recommendations: [
        'Resolve open high-value charges first to reduce leakage risk.',
        'Complete CPT/ICD-10 and source context before final approval handoff.',
      ],
    };
  }

  private async getPopulationHealthGeneralReport(tenantDb: DataSource, since: Date, periodDays: number) {
    const hasRegistry = await this.tableExists(tenantDb, 'chronic_disease_registry');
    if (!hasRegistry) {
      return this.unavailableReport('population_health', periodDays);
    }

    const [registry] = await tenantDb.query(
      `
      SELECT
        COUNT(*)::int AS total_registry,
        COUNT(*) FILTER (WHERE risk_level IN ('high', 'critical'))::int AS high_risk,
        COUNT(*) FILTER (WHERE status = 'uncontrolled')::int AS uncontrolled,
        COUNT(*) FILTER (WHERE next_review_date IS NOT NULL AND next_review_date < CURRENT_DATE)::int AS overdue_reviews
      FROM chronic_disease_registry
      WHERE created_at >= $1 OR updated_at >= $1
      `,
      [since],
    );

    let reminders = { overdue: 0, due: 0 };
    if (await this.tableExists(tenantDb, 'preventive_care_reminders')) {
      const [reminderRow] = await tenantDb.query(
        `
        SELECT
          COUNT(*) FILTER (WHERE status = 'overdue')::int AS overdue,
          COUNT(*) FILTER (WHERE status = 'due')::int AS due
        FROM preventive_care_reminders
        `,
      );
      reminders = {
        overdue: this.toNumber(reminderRow?.overdue),
        due: this.toNumber(reminderRow?.due),
      };
    }

    return {
      module: 'population_health',
      available: true,
      periodDays,
      generatedAt: new Date().toISOString(),
      stats: [
        { key: 'total_registry', label: 'Registry records', value: this.toNumber(registry?.total_registry), tone: 'info' },
        { key: 'high_risk', label: 'High/critical risk', value: this.toNumber(registry?.high_risk), tone: 'critical' },
        { key: 'uncontrolled', label: 'Uncontrolled', value: this.toNumber(registry?.uncontrolled), tone: 'warning' },
        { key: 'overdue_reviews', label: 'Overdue reviews', value: this.toNumber(registry?.overdue_reviews), tone: 'warning' },
        { key: 'care_gaps_overdue', label: 'Care gaps overdue', value: reminders.overdue, tone: 'critical' },
        { key: 'care_gaps_due', label: 'Care gaps due', value: reminders.due, tone: 'info' },
      ],
      highlights: [
        'High-risk and uncontrolled cohorts should drive proactive outreach and review cadence.',
        'Overdue preventive reminders indicate avoidable care gap accumulation.',
      ],
      recommendations: [
        'Prioritize outreach for high-risk uncontrolled patients with overdue reviews.',
        'Close overdue preventive reminders through standing recall workflows.',
      ],
    };
  }

  private async getHivGeneralReport(tenantDb: DataSource, since: Date, periodDays: number) {
    const hasEnrollments = await this.tableExists(tenantDb, 'hiv_care_enrollments');
    if (!hasEnrollments) {
      return this.unavailableReport('hiv', periodDays);
    }

    const [enrollmentSummary] = await tenantDb.query(
      `
      SELECT
        COUNT(*)::int AS total_enrollments,
        COUNT(*) FILTER (WHERE enrollment_status = 'active')::int AS active_enrollments
      FROM hiv_care_enrollments
      WHERE enrollment_date >= $1 OR created_at >= $1
      `,
      [since],
    );

    let visitSummary = { recent_visits: 0, unsuppressed_recent: 0, ltfu_risk: 0 };
    if (await this.tableExists(tenantDb, 'hiv_clinical_visits')) {
      const [visits] = await tenantDb.query(
        `
        SELECT
          COUNT(*)::int AS recent_visits,
          COUNT(*) FILTER (WHERE viral_load IS NOT NULL AND viral_load >= 1000)::int AS unsuppressed_recent
        FROM hiv_clinical_visits
        WHERE visit_date >= $1
        `,
        [since],
      );
      visitSummary.recent_visits = this.toNumber(visits?.recent_visits);
      visitSummary.unsuppressed_recent = this.toNumber(visits?.unsuppressed_recent);

      const [ltfu] = await tenantDb.query(
        `
        SELECT COUNT(*)::int AS ltfu_risk
        FROM hiv_care_enrollments e
        WHERE e.enrollment_status = 'active'
          AND (
            SELECT MAX(v.visit_date)
            FROM hiv_clinical_visits v
            WHERE v.enrollment_id = e.id
          ) < CURRENT_DATE - INTERVAL '90 days'
        `,
      );
      visitSummary.ltfu_risk = this.toNumber(ltfu?.ltfu_risk);
    }

    return {
      module: 'hiv',
      available: true,
      periodDays,
      generatedAt: new Date().toISOString(),
      stats: [
        { key: 'total_enrollments', label: 'Enrollments', value: this.toNumber(enrollmentSummary?.total_enrollments), tone: 'info' },
        { key: 'active_enrollments', label: 'Active on care', value: this.toNumber(enrollmentSummary?.active_enrollments), tone: 'good' },
        { key: 'recent_visits', label: `Visits (${periodDays}d)`, value: visitSummary.recent_visits, tone: 'info' },
        { key: 'unsuppressed_recent', label: 'Unsuppressed recent VL', value: visitSummary.unsuppressed_recent, tone: visitSummary.unsuppressed_recent > 0 ? 'warning' : 'good' },
        { key: 'ltfu_risk', label: 'LTFU risk (90d)', value: visitSummary.ltfu_risk, tone: visitSummary.ltfu_risk > 0 ? 'critical' : 'good' },
      ],
      highlights: [
        'Unsuppressed viral-load and LTFU-risk cohorts require same-day operational attention.',
        'Use DHIS2 aggregate reporting to align HIV program monitoring and external submission.',
      ],
      recommendations: [
        'Prioritize unsuppressed and overdue-visit patients for targeted adherence interventions.',
        'Run monthly DHIS2 aggregate sync and verify successful import counts.',
      ],
    };
  }

  private unavailableReport(module: string, periodDays: number) {
    return {
      module,
      available: false,
      periodDays,
      generatedAt: new Date().toISOString(),
      message: 'No provisioned data source found for this module in the current tenant database.',
      stats: [],
      highlights: [],
      recommendations: [],
    };
  }
}
