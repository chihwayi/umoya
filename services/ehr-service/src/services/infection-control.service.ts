import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InfectionSurveillance } from '../entities/infection-surveillance.entity';
import { IsolationPrecaution } from '../entities/isolation-precaution.entity';
import { AntimicrobialStewardship } from '../entities/antimicrobial-stewardship.entity';
import { CdssService } from './cdss.service';

@Injectable()
export class InfectionControlService {
  private readonly logger = new Logger(InfectionControlService.name);

  constructor(private readonly cdssService: CdssService) {}

  // ==================== INFECTION SURVEILLANCE ====================

  async reportInfection(
    infectionData: any,
    userId: string,
    tenantDb: DataSource,
  ): Promise<InfectionSurveillance & { cdssGuidance?: any }> {
    const repository = tenantDb.getRepository(InfectionSurveillance);

    const infection = repository.create({
      ...infectionData,
      detectedById: userId,
      detectedDate: new Date(),
    });

    const saved = await repository.save(infection) as unknown as InfectionSurveillance;

    // CDSS: isolation category + antimicrobial guidance for this infection type
    const infectionTerm = String(infectionData.infectionType ?? infectionData.organism ?? 'infection').toLowerCase();
    const cdssGuidance = await this.cdssService
      .getGuidelines(infectionTerm, {
        age: undefined,
        gender: undefined,
        comorbidities: infectionData.deviceAssociated ? ['device-associated'] : [],
        specialty: 'infectious_disease',
        module: 'infection_control',
      })
      .catch((e: any) => {
        this.logger.warn(`CDSS infection guidance failed: ${e?.message || e}`);
        return this.localIsolationGuidance(infectionTerm, infectionData.organism);
      });

    return { ...saved, cdssGuidance };
  }

  /**
   * Local isolation category map — used when CDSS is unavailable.
   * Based on CDC/WHO isolation precaution categories.
   */
  private localIsolationGuidance(infectionType: string, organism?: string): Record<string, any> {
    const t = String(infectionType || '').toLowerCase();
    const o = String(organism || '').toLowerCase();

    const ISOLATION_MAP: Array<{ match: string[]; category: string; precautions: string[]; notifiable: boolean }> = [
      { match: ['mrsa', 'methicillin-resistant'], category: 'Contact', precautions: ['Gloves', 'Gown', 'Private room or cohort', 'Dedicated equipment'], notifiable: false },
      { match: ['vre', 'vancomycin-resistant enterococcus'], category: 'Contact', precautions: ['Gloves', 'Gown', 'Private room or cohort'], notifiable: false },
      { match: ['cre', 'carbapenem-resistant', 'klebsiella', 'acinetobacter'], category: 'Contact + Enhanced', precautions: ['Gloves', 'Gown', 'Private room', 'Dedicated equipment', 'Enhanced environmental cleaning'], notifiable: true },
      { match: ['c. diff', 'cdiff', 'clostridium difficile', 'clostridioides'], category: 'Contact (spore)', precautions: ['Gloves', 'Gown', 'Private room', 'Soap and water only (not alcohol gel)'], notifiable: false },
      { match: ['tuberculosis', 'tb', 'mtb', 'pulmonary tb', 'acid fast'], category: 'Airborne', precautions: ['N95 respirator', 'Negative pressure room', 'Door closed at all times', 'Patient wears surgical mask when transported'], notifiable: true },
      { match: ['measles', 'rubeola', 'varicella', 'chickenpox', 'disseminated zoster'], category: 'Airborne', precautions: ['N95 respirator', 'Negative pressure room', 'Immune staff only'], notifiable: true },
      { match: ['influenza', 'flu', 'covid', 'sars', 'respiratory syncytial', 'rsv', 'pertussis'], category: 'Droplet', precautions: ['Surgical mask', 'Eye protection', 'Private room or 1m spacing', 'Door closed'], notifiable: false },
      { match: ['meningitis', 'meningococcal', 'neisseria meningitidis'], category: 'Droplet', precautions: ['Surgical mask for 24h after antibiotics started', 'Notify public health'], notifiable: true },
      { match: ['cholera', 'vibrio cholerae'], category: 'Contact + Enteric', precautions: ['Gloves', 'Gown', 'Private bathroom or commode', 'Strict hand hygiene'], notifiable: true },
      { match: ['ebola', 'viral haemorrhagic fever', 'marburg', 'lassa'], category: 'Airborne + Contact + Droplet (PPE)', precautions: ['Full PPE', 'Isolated unit', 'Specialist IPC team immediately'], notifiable: true },
    ];

    const combined = `${t} ${o}`;
    for (const entry of ISOLATION_MAP) {
      if (entry.match.some(keyword => combined.includes(keyword))) {
        return {
          isolationCategory: entry.category,
          precautions: entry.precautions,
          notifiableDisease: entry.notifiable,
          source: 'local_ipc_guidelines',
          cdss_unavailable: true,
        };
      }
    }

    return {
      isolationCategory: 'Standard',
      precautions: ['Hand hygiene', 'Gloves if contact with body fluids', 'Eye protection if splash risk'],
      notifiableDisease: false,
      source: 'local_ipc_guidelines',
      cdss_unavailable: true,
    };
  }

  async getInfectionsByDateRange(
    startDate: Date,
    endDate: Date,
    tenantDb: DataSource,
  ): Promise<InfectionSurveillance[]> {
    const repository = tenantDb.getRepository(InfectionSurveillance);

    return await repository
      .createQueryBuilder('infection')
      .where('infection.infectionDate >= :startDate', { startDate })
      .andWhere('infection.infectionDate <= :endDate', { endDate })
      .leftJoinAndSelect('infection.patient', 'patient')
      .leftJoinAndSelect('infection.detectedBy', 'detectedBy')
      .orderBy('infection.infectionDate', 'DESC')
      .getMany();
  }

  async getHAIMetrics(
    startDate: Date,
    endDate: Date,
    tenantDb: DataSource,
  ): Promise<any> {
    const repository = tenantDb.getRepository(InfectionSurveillance);

    const haiCases = await repository
      .createQueryBuilder('infection')
      .where('infection.infectionDate >= :startDate', { startDate })
      .andWhere('infection.infectionDate <= :endDate', { endDate })
      .andWhere('infection.onsetType = :onsetType', { onsetType: 'hospital_acquired' })
      .getMany();

    const byType = haiCases.reduce((acc: any, infection) => {
      acc[infection.infectionType] = (acc[infection.infectionType] || 0) + 1;
      return acc;
    }, {});

    return {
      totalHAI: haiCases.length,
      byType,
      deviceAssociated: haiCases.filter(i => i.deviceAssociated).length,
    };
  }

  async getOutbreakSignals(
    startDate: Date,
    endDate: Date,
    tenantDb: DataSource,
    limit = 8,
  ): Promise<any> {
    const rows = await tenantDb.query(
      `
      SELECT
        infection_type,
        COALESCE(NULLIF(TRIM(organism), ''), 'Unknown organism') AS organism,
        COUNT(*)::int AS case_count,
        COUNT(*) FILTER (WHERE COALESCE(resolved, false) = false)::int AS active_count,
        COUNT(DISTINCT patient_id)::int AS distinct_patients,
        MIN(infection_date) AS first_case_date,
        MAX(infection_date) AS latest_case_date
      FROM infection_surveillance
      WHERE infection_date >= $1
        AND infection_date <= $2
      GROUP BY infection_type, COALESCE(NULLIF(TRIM(organism), ''), 'Unknown organism')
      HAVING COUNT(*) >= 2
      ORDER BY active_count DESC, case_count DESC, latest_case_date DESC
      LIMIT $3
      `,
      [startDate, endDate, limit],
    );

    // Temporal trend analysis — weekly case counts + rolling baseline
    // Lookback window: 8 weeks before startDate for baseline
    const baselineStart = new Date(startDate);
    baselineStart.setDate(baselineStart.getDate() - 56);

    const weeklyRows = await tenantDb.query(
      `
      SELECT
        infection_type,
        COALESCE(NULLIF(TRIM(organism), ''), 'Unknown organism') AS organism,
        DATE_TRUNC('week', infection_date)::date AS week_start,
        COUNT(*)::int AS weekly_count
      FROM infection_surveillance
      WHERE infection_date >= $1
        AND infection_date <= $2
      GROUP BY infection_type, COALESCE(NULLIF(TRIM(organism), ''), 'Unknown organism'), DATE_TRUNC('week', infection_date)
      ORDER BY week_start ASC
      `,
      [baselineStart, endDate],
    ).catch(() => []);

    // Build week-by-week map keyed by "type|organism"
    const weeklyMap: Record<string, Array<{ week: string; count: number }>> = {};
    for (const r of weeklyRows) {
      const key = `${r.infection_type}|${r.organism}`;
      if (!weeklyMap[key]) weeklyMap[key] = [];
      weeklyMap[key].push({ week: r.week_start, count: Number(r.weekly_count) });
    }

    const periodStartMs = startDate.getTime();

    const items = (rows || []).map((row: any) => {
      const activeCount = Number(row?.active_count || 0);
      const caseCount = Number(row?.case_count || 0);

      // Temporal analysis for this infection/organism pair
      const key = `${row.infection_type}|${row.organism}`;
      const weekSeries = weeklyMap[key] ?? [];
      const baselineWeeks = weekSeries.filter(w => new Date(w.week).getTime() < periodStartMs);
      const periodWeeks = weekSeries.filter(w => new Date(w.week).getTime() >= periodStartMs);

      const baselineAvg = baselineWeeks.length > 0
        ? baselineWeeks.reduce((s, w) => s + w.count, 0) / baselineWeeks.length
        : 0;
      const periodAvg = periodWeeks.length > 0
        ? periodWeeks.reduce((s, w) => s + w.count, 0) / periodWeeks.length
        : caseCount;

      // Epidemic signal: current average > 2× historical baseline (WHO threshold)
      const epidemicThresholdExceeded = baselineAvg > 0 && periodAvg >= baselineAvg * 2;

      // Trend: compare last 2 weeks
      let trend: 'rising' | 'falling' | 'stable' | 'exponential' = 'stable';
      let doublingTimeDays: number | null = null;
      if (periodWeeks.length >= 2) {
        const last = periodWeeks[periodWeeks.length - 1].count;
        const prev = periodWeeks[periodWeeks.length - 2].count;
        const ratio = prev > 0 ? last / prev : 1;
        if (ratio >= 2) {
          trend = 'exponential';
          doublingTimeDays = 7; // one week doubling time
        } else if (ratio > 1.2) {
          trend = 'rising';
          if (prev > 0 && ratio > 1) {
            doublingTimeDays = Math.round(7 * Math.log(2) / Math.log(ratio));
          }
        } else if (ratio < 0.8) {
          trend = 'falling';
        }
      }

      const riskLevel =
        epidemicThresholdExceeded || trend === 'exponential' ? 'outbreak_confirmed'
        : activeCount >= 3 || caseCount >= 4 || (trend === 'rising' && epidemicThresholdExceeded) ? 'high'
        : activeCount >= 2 || caseCount >= 3 ? 'moderate'
        : 'low';

      const recommendedActions: string[] = [
        'Validate source control and environmental cleaning bundle compliance.',
      ];
      if (riskLevel === 'outbreak_confirmed') {
        recommendedActions.unshift('OUTBREAK CONFIRMED: Activate outbreak response team. Notify infection control lead and public health authority.');
        recommendedActions.push('Implement enhanced surveillance with daily case counts and contact tracing.');
      }
      if (activeCount >= 2) {
        recommendedActions.push('Escalate to IPC huddle and review transmission pathways.');
      }
      if (String(row?.organism || '').toLowerCase() !== 'unknown organism') {
        recommendedActions.push('Confirm culture sensitivities and isolate affected contacts as indicated.');
      }
      if (trend === 'rising' || trend === 'exponential') {
        recommendedActions.push('Cases are increasing — intensify active case finding and implement contact precautions.');
      }

      return {
        ...row,
        case_count: caseCount,
        active_count: activeCount,
        distinct_patients: Number(row?.distinct_patients || 0),
        risk_level: riskLevel,
        trend,
        baseline_avg_weekly: Number(baselineAvg.toFixed(2)),
        period_avg_weekly: Number(periodAvg.toFixed(2)),
        epidemic_threshold_exceeded: epidemicThresholdExceeded,
        doubling_time_days: doublingTimeDays,
        recommended_actions: recommendedActions,
      };
    });

    return {
      summary: {
        totalClusters: items.length,
        outbreakConfirmed: items.filter((item: any) => item.risk_level === 'outbreak_confirmed').length,
        highRisk: items.filter((item: any) => item.risk_level === 'high').length,
        moderateRisk: items.filter((item: any) => item.risk_level === 'moderate').length,
        activeClusters: items.filter((item: any) => Number(item.active_count || 0) > 0).length,
        risingTrend: items.filter((item: any) => item.trend === 'rising' || item.trend === 'exponential').length,
      },
      items,
    };
  }

  async getClinicalWorklist(
    startDate: Date,
    endDate: Date,
    tenantDb: DataSource,
    limit = 25,
  ): Promise<any> {
    const rows = await tenantDb.query(
      `
      SELECT
        i.id,
        i.patient_id,
        i.admission_id,
        i.infection_type,
        i.infection_site,
        i.infection_icd10,
        i.infection_date,
        i.onset_type,
        i.days_since_admission,
        i.organism,
        i.culture_source,
        i.culture_date,
        i.device_associated,
        i.device_type,
        i.severity,
        i.resolved,
        i.investigated,
        i.root_cause,
        i.reported_to_cdc,
        p.first_name,
        p.last_name,
        p.patient_number,
        iso.id AS active_isolation_id,
        iso.isolation_type AS active_isolation_type,
        iso.start_date AS active_isolation_start_date
      FROM infection_surveillance i
      INNER JOIN patients p ON p.id = i.patient_id
      LEFT JOIN LATERAL (
        SELECT id, isolation_type, start_date
        FROM isolation_precautions
        WHERE patient_id = i.patient_id
          AND status = 'active'
        ORDER BY start_date DESC
        LIMIT 1
      ) iso ON true
      WHERE i.infection_date >= $1
        AND i.infection_date <= $2
      ORDER BY COALESCE(i.resolved, false) ASC, i.infection_date DESC, i.updated_at DESC
      LIMIT $3
      `,
      [startDate, endDate, limit],
    );

    const items = (rows || []).map((row: any) => {
      const resolved = Boolean(row?.resolved);
      const severity = String(row?.severity || '').toLowerCase();
      const onsetType = String(row?.onset_type || '').toLowerCase();
      const organism = String(row?.organism || '').toLowerCase();
      const hasIsolation = Boolean(row?.active_isolation_id);
      const daysSinceInfection = this.calculateDaysSince(row?.infection_date);

      const mdroSignal =
        organism.includes('mrsa') ||
        organism.includes('vre') ||
        organism.includes('cre') ||
        organism.includes('c. diff') ||
        organism.includes('cdiff') ||
        organism.includes('acinetobacter');
      const severeSignal =
        severity.includes('septic') ||
        severity.includes('severe') ||
        severity.includes('shock');
      const hospitalAcquiredSignal = onsetType === 'hospital_acquired';
      const deviceSignal = Boolean(row?.device_associated);

      let riskScore = 0;
      if (!resolved && severeSignal) riskScore += 3;
      if (!resolved && hospitalAcquiredSignal) riskScore += 2;
      if (!resolved && deviceSignal) riskScore += 2;
      if (!resolved && mdroSignal) riskScore += 2;
      if (!resolved && daysSinceInfection >= 3) riskScore += 1;
      if (!resolved && !hasIsolation && (mdroSignal || hospitalAcquiredSignal || deviceSignal)) riskScore += 1;

      const riskLevel = resolved ? 'low' : riskScore >= 6 ? 'high' : riskScore >= 3 ? 'moderate' : 'low';
      const overdueReview = !resolved && daysSinceInfection >= 4;

      const recommendedActions: string[] = [];
      if (!resolved && !hasIsolation && (mdroSignal || hospitalAcquiredSignal || deviceSignal)) {
        recommendedActions.push('Order or verify active isolation precautions for transmission risk.');
      }
      if (!resolved && deviceSignal) {
        recommendedActions.push('Review device necessity and remove invasive devices when clinically safe.');
      }
      if (!resolved && hospitalAcquiredSignal) {
        recommendedActions.push('Complete root-cause and prevention bundle review for HAI event.');
      }
      if (!resolved && !Boolean(row?.investigated)) {
        recommendedActions.push('Document clinical investigation and IPC actions taken.');
      }
      if (!resolved && !Boolean(row?.culture_source)) {
        recommendedActions.push('Ensure diagnostic culture source and microbiology context are captured.');
      }
      if (!resolved && overdueReview) {
        recommendedActions.push('Escalate unresolved infection in multidisciplinary safety huddle.');
      }
      if (recommendedActions.length === 0) {
        recommendedActions.push('Continue IPC surveillance and monitor for transmission control completion.');
      }

      return {
        ...row,
        days_since_infection: daysSinceInfection,
        risk_score: riskScore,
        risk_level: riskLevel,
        mdro_signal: mdroSignal,
        severe_signal: severeSignal,
        overdue_review: overdueReview,
        unresolved: !resolved,
        recommended_actions: recommendedActions,
      };
    });

    return {
      summary: {
        total: items.length,
        unresolved: items.filter((item: any) => Boolean(item.unresolved)).length,
        highRisk: items.filter((item: any) => item.risk_level === 'high').length,
        moderateRisk: items.filter((item: any) => item.risk_level === 'moderate').length,
        withoutIsolation: items.filter(
          (item: any) => Boolean(item.unresolved) && !item.active_isolation_id && (item.mdro_signal || item.device_associated),
        ).length,
        mdroSignals: items.filter((item: any) => Boolean(item.mdro_signal) && Boolean(item.unresolved)).length,
        overdueReview: items.filter((item: any) => Boolean(item.overdue_review)).length,
      },
      items,
    };
  }

  async getOperationalBrief(
    startDate: Date,
    endDate: Date,
    tenantDb: DataSource,
    options?: {
      includeResolved?: boolean;
      limit?: number;
    },
  ): Promise<any> {
    const includeResolved = Boolean(options?.includeResolved);
    const limit = Number.isFinite(Number(options?.limit))
      ? Math.min(Math.max(Number(options?.limit), 1), 200)
      : 120;

    const [
      infectionWorklist,
      stewardshipWorklist,
      outbreakSignals,
      haiMetrics,
      hhCompliance,
      deviceRates,
    ] = await Promise.all([
      this.getClinicalWorklist(startDate, endDate, tenantDb, limit).catch(() => ({ summary: {}, items: [] })),
      this.getStewardshipWorklist(startDate, endDate, tenantDb, limit).catch(() => ({ summary: {}, items: [] })),
      this.getOutbreakSignals(startDate, endDate, tenantDb, 10).catch(() => ({ summary: {}, items: [] })),
      this.getHAIMetrics(startDate, endDate, tenantDb).catch(() => ({ totalHAI: 0, deviceAssociated: 0 })),
      this.getHandHygieneCompliance(startDate, endDate, null, tenantDb).catch(() => null),
      this.getDeviceDayRates(startDate, endDate, tenantDb).catch(() => null),
    ]);

    const infectionItemsRaw = Array.isArray(infectionWorklist?.items) ? infectionWorklist.items : [];
    const stewardshipItemsRaw = Array.isArray(stewardshipWorklist?.items) ? stewardshipWorklist.items : [];
    const outbreakItems = Array.isArray(outbreakSignals?.items) ? outbreakSignals.items : [];

    const infectionItems = includeResolved
      ? infectionItemsRaw
      : infectionItemsRaw.filter((item: any) => Boolean(item?.unresolved));
    const stewardshipItems = includeResolved
      ? stewardshipItemsRaw
      : stewardshipItemsRaw.filter((item: any) => Boolean(item?.review_pending) || Boolean(item?.overdue_review));

    const countInfectionChecklistItems = (item: any): number => {
      const checks = [
        Boolean(item?.infection_type),
        Boolean(item?.severity),
        Boolean(item?.onset_type),
        Boolean(item?.culture_source),
        Boolean(item?.organism),
        Boolean(item?.infection_icd10),
      ];
      return checks.filter(Boolean).length;
    };

    const countStewardshipChecklistItems = (item: any): number => {
      const checks = [
        Boolean(item?.antibiotic_name),
        Boolean(item?.indication),
        Boolean(item?.indication_icd10),
        item?.culture_sent !== null && item?.culture_sent !== undefined,
        Boolean(item?.empiric_or_targeted),
        Boolean(item?.planned_duration_days),
      ];
      return checks.filter(Boolean).length;
    };

    const queueFromInfections = infectionItems.map((item: any) => {
      const missingCulture = !Boolean(item?.culture_source);
      const missingOrganism = !Boolean(item?.organism);
      const missingInfectionCoding = !Boolean(item?.infection_icd10);
      const missingRootCause = Boolean(item?.investigated) && !Boolean(item?.root_cause);
      const missingIsolationWhenIndicated =
        !Boolean(item?.active_isolation_id) &&
        (Boolean(item?.mdro_signal) || Boolean(item?.device_associated) || Boolean(item?.severe_signal));

      const cdssFlags: string[] = [];
      if (missingCulture) cdssFlags.push('Culture source missing');
      if (missingOrganism) cdssFlags.push('Organism not documented');
      if (missingInfectionCoding) cdssFlags.push('Infection ICD-10 missing');
      if (missingRootCause) cdssFlags.push('Root-cause documentation incomplete');
      if (missingIsolationWhenIndicated) cdssFlags.push('Isolation not active despite transmission risk');

      return {
        id: item.id,
        source: 'infection',
        patientId: item.patient_id,
        patientName: `${item.first_name || ''} ${item.last_name || ''}`.trim() || 'Unknown patient',
        patientNumber: item.patient_number || null,
        riskLevel: item.risk_level || 'low',
        status: item.unresolved ? 'active' : 'resolved',
        focusLabel: item.infection_type || 'Infection case',
        severeSignal: Boolean(item.severe_signal),
        overdueReview: Boolean(item.overdue_review),
        diagnosticGap: missingCulture || missingOrganism || missingInfectionCoding || missingRootCause,
        missingCulture,
        missingOrganism,
        missingInfectionCoding,
        missingRootCause,
        missingIsolationWhenIndicated,
        checklistCompleteCount: countInfectionChecklistItems(item),
        checklistTotalCount: 6,
        cdssFlags,
        recommendedActions: Array.isArray(item.recommended_actions) ? item.recommended_actions.slice(0, 3) : [],
      };
    });

    const queueFromStewardship = stewardshipItems.map((item: any) => {
      const empiricProlonged =
        String(item?.empiric_or_targeted || '').toLowerCase() === 'empiric' &&
        Number(item?.therapy_day || 0) >= 4;
      const noCultureEvidence = !Boolean(item?.culture_sent);
      const missingIndicationCoding = !Boolean(item?.indication_icd10);
      const pendingRecommendation =
        Boolean(item?.review_pending) && !Boolean(String(item?.stewardship_recommendation || '').trim());

      const cdssFlags: string[] = [];
      if (empiricProlonged) cdssFlags.push('Prolonged empiric therapy');
      if (noCultureEvidence) cdssFlags.push('No culture evidence documented');
      if (missingIndicationCoding) cdssFlags.push('Indication ICD-10 missing');
      if (pendingRecommendation) cdssFlags.push('Stewardship recommendation pending');

      return {
        id: item.id,
        source: 'stewardship',
        patientId: item.patient_id,
        patientName: `${item.first_name || ''} ${item.last_name || ''}`.trim() || 'Unknown patient',
        patientNumber: item.patient_number || null,
        riskLevel: item.risk_level || 'low',
        status: item.review_pending ? 'review-pending' : 'reviewed',
        focusLabel: item.antibiotic_name || 'Antimicrobial therapy',
        severeSignal: Boolean(item.duration_exceeded) || Boolean(item.guideline_variance),
        overdueReview: Boolean(item.overdue_review),
        empiricProlonged,
        noCultureEvidence,
        missingIndicationCoding,
        pendingRecommendation,
        checklistCompleteCount: countStewardshipChecklistItems(item),
        checklistTotalCount: 6,
        cdssFlags,
        recommendedActions: Array.isArray(item.recommended_actions) ? item.recommended_actions.slice(0, 3) : [],
      };
    });

    const riskRank = { high: 0, moderate: 1, low: 2 } as const;
    const highPriorityQueue = [...queueFromInfections, ...queueFromStewardship]
      .sort((a: any, b: any) => {
        const aRisk = riskRank[String(a?.riskLevel || 'low').toLowerCase() as keyof typeof riskRank] ?? 3;
        const bRisk = riskRank[String(b?.riskLevel || 'low').toLowerCase() as keyof typeof riskRank] ?? 3;
        if (aRisk !== bRisk) return aRisk - bRisk;
        if (Boolean(a?.overdueReview) !== Boolean(b?.overdueReview)) {
          return Boolean(b?.overdueReview) ? 1 : -1;
        }
        return String(a?.source || '').localeCompare(String(b?.source || ''));
      })
      .slice(0, 10);

    const diagnosticWorkupGaps = queueFromInfections.filter(
      (item: any) => Boolean(item.missingCulture) || Boolean(item.missingOrganism),
    ).length;
    const infectionCodingGaps = queueFromInfections.filter((item: any) => Boolean(item.missingInfectionCoding)).length;
    const rootCauseGaps = queueFromInfections.filter((item: any) => Boolean(item.missingRootCause)).length;
    const prolongedEmpiricWithoutCulture = queueFromStewardship.filter(
      (item: any) => Boolean(item.empiricProlonged) && Boolean(item.noCultureEvidence),
    ).length;
    const stewardshipCodingGaps = queueFromStewardship.filter((item: any) => Boolean(item.missingIndicationCoding)).length;
    const pendingStewardshipRecommendations = queueFromStewardship.filter(
      (item: any) => Boolean(item.pendingRecommendation),
    ).length;

    const checklistTotal = [...queueFromInfections, ...queueFromStewardship].reduce(
      (sum: number, item: any) => sum + Number(item?.checklistTotalCount || 0),
      0,
    );
    const checklistComplete = [...queueFromInfections, ...queueFromStewardship].reduce(
      (sum: number, item: any) => sum + Number(item?.checklistCompleteCount || 0),
      0,
    );
    const cdssCoveragePercent =
      checklistTotal > 0 ? Number(((checklistComplete / checklistTotal) * 100).toFixed(1)) : 0;

    const recommendations = new Set<string>();
    if (Number(infectionWorklist?.summary?.withoutIsolation || 0) > 0) {
      recommendations.add('Close isolation precaution gaps immediately for unresolved transmission-risk cases.');
    }
    if (Number(infectionWorklist?.summary?.overdueReview || 0) > 0) {
      recommendations.add('Escalate overdue infection-case reviews to the daily IPC multidisciplinary huddle.');
    }
    if (Number(stewardshipWorklist?.summary?.overdueReview || 0) > 0) {
      recommendations.add('Complete 48-72 hour antimicrobial timeouts for overdue stewardship reviews.');
    }
    if (Number(stewardshipWorklist?.summary?.highRisk || 0) > 0) {
      recommendations.add('Prioritize high-risk antimicrobial plans with guideline variance or duration excess.');
    }
    if (diagnosticWorkupGaps > 0) {
      recommendations.add('Close diagnostic workup gaps: ensure culture source and organism capture for unresolved infections.');
    }
    if (infectionCodingGaps > 0 || stewardshipCodingGaps > 0) {
      recommendations.add('Complete ICD-10 coding for infection and antimicrobial indication records to improve analytics fidelity.');
    }
    if (prolongedEmpiricWithoutCulture > 0) {
      recommendations.add('Escalate prolonged empiric therapy without culture evidence for urgent stewardship review.');
    }
    if (pendingStewardshipRecommendations > 0) {
      recommendations.add('Document explicit stewardship recommendations for all pending antimicrobial reviews.');
    }
    if (cdssCoveragePercent < 80) {
      recommendations.add('Increase structured infection and stewardship documentation to improve CDSS coverage.');
    }
    if (
      hhCompliance &&
      Number.isFinite(Number(hhCompliance?.overallRate)) &&
      Number(hhCompliance?.overallRate) < 85
    ) {
      recommendations.add('Reinforce WHO 5 Moments hand-hygiene coaching in low-compliance departments.');
    }
    if (outbreakItems.some((item: any) => String(item?.risk_level || '').toLowerCase() === 'high')) {
      recommendations.add('Run focused outbreak containment review for high-risk clusters and contact tracing.');
    }
    for (const item of highPriorityQueue) {
      for (const action of item.recommendedActions || []) {
        if (String(action || '').trim()) {
          recommendations.add(String(action).trim());
        }
      }
      if (recommendations.size >= 8) break;
    }
    if (!recommendations.size) {
      recommendations.add('Maintain active IPC surveillance cadence and timely stewardship review completion.');
    }

    return {
      generatedAt: new Date().toISOString(),
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      summary: {
        totalHAI: Number(haiMetrics?.totalHAI || 0),
        deviceAssociated: Number(haiMetrics?.deviceAssociated || 0),
        unresolvedInfections: Number(infectionWorklist?.summary?.unresolved || 0),
        highRiskInfections: Number(infectionWorklist?.summary?.highRisk || 0),
        mdroSignals: Number(infectionWorklist?.summary?.mdroSignals || 0),
        isolationGaps: Number(infectionWorklist?.summary?.withoutIsolation || 0),
        overdueInfectionReviews: Number(infectionWorklist?.summary?.overdueReview || 0),
        diagnosticWorkupGaps,
        infectionCodingGaps,
        rootCauseGaps,
        stewardshipReviewPending: Number(stewardshipWorklist?.summary?.reviewPending || 0),
        stewardshipOverdue: Number(stewardshipWorklist?.summary?.overdueReview || 0),
        stewardshipHighRisk: Number(stewardshipWorklist?.summary?.highRisk || 0),
        prolongedEmpiricWithoutCulture,
        stewardshipCodingGaps,
        pendingStewardshipRecommendations,
        cdssCoveragePercent,
        outbreakHighRiskClusters: outbreakItems.filter((item: any) => String(item?.risk_level || '').toLowerCase() === 'high').length,
        handHygieneOverallRate:
          hhCompliance && Number.isFinite(Number(hhCompliance?.overallRate))
            ? Number(hhCompliance.overallRate)
            : null,
        cautiRate: deviceRates && Number.isFinite(Number(deviceRates?.cautiRate)) ? Number(deviceRates.cautiRate) : null,
        clabsiRate: deviceRates && Number.isFinite(Number(deviceRates?.clabsiRate)) ? Number(deviceRates.clabsiRate) : null,
        vapRate: deviceRates && Number.isFinite(Number(deviceRates?.vapRate)) ? Number(deviceRates.vapRate) : null,
      },
      highPriorityQueue,
      recommendations: Array.from(recommendations).slice(0, 8),
    };
  }

  async reviewInfection(
    id: string,
    reviewData: any,
    userId: string,
    tenantDb: DataSource,
  ): Promise<any> {
    const [existing] = await tenantDb.query(
      `SELECT id, investigation_notes FROM infection_surveillance WHERE id = $1 LIMIT 1`,
      [id],
    );
    if (!existing) {
      throw new NotFoundException('Infection case not found');
    }

    const noteText = String(reviewData?.investigationNotes || '').trim();
    const entry = `${new Date().toISOString()} by ${userId}: ${noteText || 'Clinical IPC review completed.'}`;
    const mergedNotes = existing.investigation_notes
      ? `${existing.investigation_notes}\n${entry}`
      : entry;

    const [updated] = await tenantDb.query(
      `
      UPDATE infection_surveillance
      SET
        investigated = true,
        investigation_notes = $1,
        root_cause = CASE
          WHEN $2::text IS NOT NULL AND LENGTH(TRIM($2::text)) > 0 THEN $2::text
          ELSE root_cause
        END,
        reported_to_cdc = CASE
          WHEN $3::boolean IS NULL THEN reported_to_cdc
          ELSE $3::boolean
        END,
        reported_date = CASE
          WHEN COALESCE($3::boolean, reported_to_cdc) = true AND reported_date IS NULL THEN CURRENT_DATE
          ELSE reported_date
        END,
        resolved = CASE WHEN $4::boolean = true THEN true ELSE resolved END,
        resolution_date = CASE
          WHEN $4::boolean = true AND resolution_date IS NULL THEN CURRENT_DATE
          ELSE resolution_date
        END,
        outcome = CASE
          WHEN $5::text IS NOT NULL AND LENGTH(TRIM($5::text)) > 0 THEN $5::text
          ELSE outcome
        END,
        updated_at = NOW()
      WHERE id = $6
      RETURNING *
      `,
      [
        mergedNotes,
        reviewData?.rootCause ?? null,
        reviewData?.reportedToCdc ?? null,
        Boolean(reviewData?.markResolved),
        reviewData?.outcome ?? null,
        id,
      ],
    );

    return updated;
  }

  // ==================== ISOLATION PRECAUTIONS ====================

  async orderIsolation(
    isolationData: any,
    userId: string,
    tenantDb: DataSource,
  ): Promise<IsolationPrecaution> {
    const repository = tenantDb.getRepository(IsolationPrecaution);

    const isolation = repository.create({
      ...isolationData,
      orderedById: userId,
      startDate: new Date(),
      status: 'active',
    });

    return await repository.save(isolation) as unknown as IsolationPrecaution;
  }

  async getActiveIsolations(
    tenantDb: DataSource,
  ): Promise<IsolationPrecaution[]> {
    const repository = tenantDb.getRepository(IsolationPrecaution);

    return await repository.find({
      where: { status: 'active' },
      relations: ['patient', 'orderedBy'],
      order: { startDate: 'DESC' },
    });
  }

  async discontinueIsolation(
    id: string,
    reason: string,
    userId: string,
    tenantDb: DataSource,
  ): Promise<IsolationPrecaution> {
    const repository = tenantDb.getRepository(IsolationPrecaution);

    const isolation = await repository.findOne({ where: { id } });
    if (!isolation) {
      throw new NotFoundException('Isolation precaution not found');
    }

    isolation.status = 'discontinued';
    isolation.endDate = new Date();
    isolation.discontinuedById = userId;
    isolation.discontinuationReason = reason;

    return await repository.save(isolation);
  }

  // ==================== ANTIMICROBIAL STEWARDSHIP ====================

  async trackAntibiotic(
    stewardshipData: any,
    tenantDb: DataSource,
  ): Promise<AntimicrobialStewardship & { cdssGuidance?: any }> {
    const repository = tenantDb.getRepository(AntimicrobialStewardship);

    const stewardship = repository.create(stewardshipData);
    const saved = await repository.save(stewardship) as unknown as AntimicrobialStewardship;

    // CDSS: empiric guideline check for the indication
    const indication = String(stewardshipData.indication ?? stewardshipData.infectionType ?? '');
    const cdssGuidance = indication
      ? await this.cdssService
          .getGuidelines(indication, {
            age: undefined,
            gender: undefined,
            comorbidities: [],
            specialty: 'pharmacy',
            module: 'medication_safety',
          })
          .catch((e: any) => {
            this.logger.warn(`CDSS stewardship guidance failed: ${e?.message || e}`);
            return null;
          })
      : null;

    return { ...saved, cdssGuidance };
  }

  async getAntibioticUsageReport(
    startDate: Date,
    endDate: Date,
    tenantDb: DataSource,
  ): Promise<any> {
    const repository = tenantDb.getRepository(AntimicrobialStewardship);

    const usage = await repository
      .createQueryBuilder('stewardship')
      .where('stewardship.startDate >= :startDate', { startDate })
      .andWhere('stewardship.startDate <= :endDate', { endDate })
      .getMany();

    const byAntibiotic = usage.reduce((acc: any, item) => {
      acc[item.antibioticName] = (acc[item.antibioticName] || 0) + 1;
      return acc;
    }, {});

    return {
      totalPrescriptions: usage.length,
      byAntibiotic,
      empiric: usage.filter(u => u.empiricOrTargeted === 'empiric').length,
      targeted: usage.filter(u => u.empiricOrTargeted === 'targeted').length,
      reviewRequiredCount: usage.filter((u) => Boolean(u.reviewRequired)).length,
      pendingReviewCount: usage.filter((u) => Boolean(u.reviewRequired) && !u.reviewDate).length,
      deEscalationOpportunities: usage.filter((u) => Boolean(u.deEscalationOpportunity)).length,
      guidelineVarianceCount: usage.filter(
        (u) =>
          u.appropriateIndication === false ||
          u.appropriateDose === false ||
          u.appropriateDuration === false,
      ).length,
    };
  }

  async getStewardshipWorklist(
    startDate: Date,
    endDate: Date,
    tenantDb: DataSource,
    limit = 25,
  ): Promise<any> {
    const rows = await tenantDb.query(
      `
      SELECT
        a.id,
        a.patient_id,
        a.antibiotic_name,
        a.antibiotic_class,
        a.dose,
        a.route,
        a.frequency,
        a.indication,
        a.indication_icd10,
        a.empiric_or_targeted,
        a.culture_sent,
        a.culture_result,
        a.organism_identified,
        a.start_date,
        a.planned_duration_days,
        a.review_required,
        a.review_date,
        a.stewardship_recommendation,
        a.recommendation_followed,
        a.appropriate_indication,
        a.appropriate_dose,
        a.appropriate_duration,
        a.de_escalation_opportunity,
        a.de_escalation_notes,
        p.first_name,
        p.last_name,
        p.patient_number
      FROM antimicrobial_stewardship a
      INNER JOIN patients p ON p.id = a.patient_id
      WHERE a.start_date <= $2
        AND (a.actual_stop_date IS NULL OR a.actual_stop_date >= $1)
      ORDER BY
        CASE WHEN COALESCE(a.review_required, false) = true AND a.review_date IS NULL THEN 0 ELSE 1 END,
        a.start_date ASC,
        a.created_at DESC
      LIMIT $3
      `,
      [startDate, endDate, limit],
    );

    const worklist = (rows || []).map((row: any) => {
      const therapyDay = this.calculateTherapyDay(row?.start_date);
      const plannedDurationDays = Number(row?.planned_duration_days || 0) || null;
      const reviewRequired = Boolean(row?.review_required);
      const reviewDone = Boolean(row?.review_date);
      const overdueReview = reviewRequired && !reviewDone && therapyDay >= 3;
      const durationExceeded = Boolean(plannedDurationDays && therapyDay > plannedDurationDays);
      const hasGuidelineVariance =
        row?.appropriate_indication === false ||
        row?.appropriate_dose === false ||
        row?.appropriate_duration === false;

      const recommendedActions: string[] = [];
      if (overdueReview) {
        recommendedActions.push('Complete 48-72h antimicrobial review and document stewardship recommendation.');
      }
      if (!Boolean(row?.culture_sent)) {
        recommendedActions.push('Ensure cultures are sent to support targeted antimicrobial therapy.');
      }
      if (Boolean(row?.de_escalation_opportunity) && !row?.stewardship_recommendation) {
        recommendedActions.push('Document de-escalation plan based on clinical response and microbiology.');
      }
      if (durationExceeded) {
        recommendedActions.push('Reconcile planned duration versus actual therapy exposure.');
      }
      if (hasGuidelineVariance) {
        recommendedActions.push('Resolve indication/dose/duration variance against antimicrobial guidance.');
      }
      if (recommendedActions.length === 0) {
        recommendedActions.push('Continue daily antimicrobial timeout and monitor for de-escalation opportunities.');
      }

      let riskLevel: 'high' | 'moderate' | 'low' = 'low';
      if (overdueReview || durationExceeded || hasGuidelineVariance) {
        riskLevel = 'high';
      } else if (!Boolean(row?.culture_sent) || Boolean(row?.de_escalation_opportunity)) {
        riskLevel = 'moderate';
      }

      return {
        ...row,
        therapy_day: therapyDay,
        planned_duration_days: plannedDurationDays,
        review_pending: reviewRequired && !reviewDone,
        overdue_review: overdueReview,
        duration_exceeded: durationExceeded,
        guideline_variance: hasGuidelineVariance,
        risk_level: riskLevel,
        recommended_actions: recommendedActions,
      };
    });

    const summary = {
      total: worklist.length,
      highRisk: worklist.filter((item: any) => item.risk_level === 'high').length,
      moderateRisk: worklist.filter((item: any) => item.risk_level === 'moderate').length,
      reviewPending: worklist.filter((item: any) => Boolean(item.review_pending)).length,
      overdueReview: worklist.filter((item: any) => Boolean(item.overdue_review)).length,
      deEscalationOpportunities: worklist.filter((item: any) => Boolean(item.de_escalation_opportunity)).length,
    };

    return { summary, items: worklist };
  }

  async reviewAntibiotic(
    id: string,
    reviewData: any,
    userId: string,
    tenantDb: DataSource,
  ): Promise<AntimicrobialStewardship> {
    const repository = tenantDb.getRepository(AntimicrobialStewardship);

    const stewardship = await repository.findOne({ where: { id } });
    if (!stewardship) {
      throw new NotFoundException('Antibiotic record not found');
    }

    stewardship.reviewDate = new Date();
    stewardship.reviewedById = userId;
    stewardship.stewardshipRecommendation = reviewData.recommendation;
    stewardship.appropriateIndication = reviewData.appropriateIndication;
    stewardship.appropriateDose = reviewData.appropriateDose;
    stewardship.appropriateDuration = reviewData.appropriateDuration;
    stewardship.deEscalationOpportunity = reviewData.deEscalationOpportunity;
    stewardship.deEscalationNotes = reviewData.deEscalationNotes;

    return await repository.save(stewardship);
  }

  // ==================== HAND HYGIENE ====================

  async recordHandHygiene(data: any, userId: string, tenantDb: DataSource): Promise<any> {
    const [row] = await tenantDb.query(
      `INSERT INTO hand_hygiene_observations (observer_id, observed_staff_id, department, opportunity_type, hand_hygiene_performed, method, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        userId,
        data.observedStaffId ?? null,
        data.department ?? null,
        data.opportunityType,
        data.handHygienePerformed ?? false,
        data.method ?? null,
        data.notes ?? null,
      ],
    );
    return row;
  }

  async getHandHygieneCompliance(startDate: Date, endDate: Date, department: string | null, tenantDb: DataSource): Promise<any> {
    let query = `
      SELECT department, opportunity_type,
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE hand_hygiene_performed)::int as performed
      FROM hand_hygiene_observations
      WHERE observation_date >= $1 AND observation_date <= $2
    `;
    const params: any[] = [startDate, endDate];
    if (department) {
      query += ` AND department = $3`;
      params.push(department);
    }
    query += ` GROUP BY department, opportunity_type`;
    const rows = await tenantDb.query(query, params);
    const normalized = (rows || []).map((r: any) => ({
      department: r.department || 'Unspecified',
      opportunityType: r.opportunity_type,
      total: Number(r.total || 0),
      performed: Number(r.performed || 0),
      complianceRate: Number(r.total || 0) > 0 ? Number(((Number(r.performed || 0) / Number(r.total || 0)) * 100).toFixed(1)) : 0,
    }));

    const totals = normalized.reduce(
      (acc: { total: number; performed: number }, row: any) => {
        acc.total += row.total;
        acc.performed += row.performed;
        return acc;
      },
      { total: 0, performed: 0 },
    );

    const byDepartmentMap = new Map<string, { total: number; performed: number }>();
    const byOpportunityMap = new Map<string, { total: number; performed: number }>();

    for (const row of normalized) {
      const dept = row.department || 'Unspecified';
      const deptEntry = byDepartmentMap.get(dept) || { total: 0, performed: 0 };
      deptEntry.total += row.total;
      deptEntry.performed += row.performed;
      byDepartmentMap.set(dept, deptEntry);

      const opportunity = row.opportunityType || 'unspecified';
      const oppEntry = byOpportunityMap.get(opportunity) || { total: 0, performed: 0 };
      oppEntry.total += row.total;
      oppEntry.performed += row.performed;
      byOpportunityMap.set(opportunity, oppEntry);
    }

    const byDepartment = Array.from(byDepartmentMap.entries())
      .map(([name, value]) => ({
        department: name,
        total: value.total,
        performed: value.performed,
        complianceRate: value.total > 0 ? Number(((value.performed / value.total) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    const byOpportunity = Array.from(byOpportunityMap.entries())
      .map(([name, value]) => ({
        opportunityType: name,
        total: value.total,
        performed: value.performed,
        complianceRate: value.total > 0 ? Number(((value.performed / value.total) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    const missedCount = Math.max(0, totals.total - totals.performed);

    return {
      overallRate: totals.total > 0 ? Number(((totals.performed / totals.total) * 100).toFixed(1)) : 0,
      totalObservations: totals.total,
      performedCount: totals.performed,
      missedCount,
      byDepartment,
      byOpportunity,
      observations: normalized,
    };
  }

  // ==================== DEVICE DAYS ====================

  async trackDeviceDay(data: any, userId: string, tenantDb: DataSource): Promise<any> {
    const [row] = await tenantDb.query(
      `INSERT INTO device_day_tracking (patient_id, admission_id, device_type, inserted_date, inserted_by, location, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        data.patientId,
        data.admissionId ?? null,
        data.deviceType,
        data.insertedDate || new Date().toISOString().split('T')[0],
        userId,
        data.location ?? null,
        data.notes ?? null,
      ],
    );
    return row;
  }

  async removeDeviceDay(id: string, tenantDb: DataSource): Promise<any> {
    const [row] = await tenantDb.query(
      `UPDATE device_day_tracking SET removed_date = CURRENT_DATE WHERE id = $1 RETURNING *`,
      [id],
    );
    if (!row) throw new NotFoundException('Device day record not found');
    return row;
  }

  async getDeviceDayRates(startDate: Date, endDate: Date, tenantDb: DataSource): Promise<any> {
    const deviceDays = await tenantDb.query(
      `SELECT device_type,
        SUM(
          GREATEST(
            0,
            LEAST(COALESCE(removed_date, $2::date), $2::date) - GREATEST(inserted_date, $1::date) + 1
          )
        )::int as device_days
       FROM device_day_tracking
       WHERE inserted_date <= $2 AND (removed_date IS NULL OR removed_date >= $1)
       GROUP BY device_type`,
      [startDate, endDate],
    );
    const infections = await tenantDb.query(
      `SELECT device_type, infection_type, COUNT(*)::int as cnt FROM infection_surveillance
       WHERE infection_date >= $1 AND infection_date <= $2 AND device_associated = true
       GROUP BY device_type, infection_type`,
      [startDate, endDate],
    );
    const rates: any = {
      central_line: { deviceDays: 0, infections: 0, rate: 0 },
      urinary_catheter: { deviceDays: 0, infections: 0, rate: 0 },
      ventilator: { deviceDays: 0, infections: 0, rate: 0 },
    };
    for (const row of deviceDays) {
      const key = this.normalizeDeviceType(row.device_type);
      if (rates[key]) rates[key].deviceDays = Number(row.device_days);
    }
    for (const row of infections) {
      const key = this.normalizeDeviceType(row.device_type, row.infection_type);
      if (rates[key]) rates[key].infections = Number(row.cnt);
    }
    for (const key of Object.keys(rates)) {
      const d = rates[key].deviceDays || 1;
      rates[key].rate = Number(((rates[key].infections / d) * 1000).toFixed(2));
    }
    return {
      centralLineDays: rates.central_line.deviceDays,
      centralLineInfections: rates.central_line.infections,
      clabsiRate: rates.central_line.rate,
      urinaryCatheterDays: rates.urinary_catheter.deviceDays,
      urinaryCatheterInfections: rates.urinary_catheter.infections,
      cautiRate: rates.urinary_catheter.rate,
      ventilatorDays: rates.ventilator.deviceDays,
      ventilatorInfections: rates.ventilator.infections,
      vapRate: rates.ventilator.rate,
      byDevice: rates,
    };
  }

  private normalizeDeviceType(deviceTypeRaw: string | null, infectionTypeRaw?: string | null): 'central_line' | 'urinary_catheter' | 'ventilator' {
    const deviceType = String(deviceTypeRaw || '').toLowerCase();
    const infectionType = String(infectionTypeRaw || '').toLowerCase();

    if (
      deviceType.includes('catheter') ||
      deviceType.includes('urinary') ||
      infectionType.includes('cauti')
    ) {
      return 'urinary_catheter';
    }
    if (
      deviceType.includes('vent') ||
      infectionType.includes('vap') ||
      infectionType.includes('ventilator')
    ) {
      return 'ventilator';
    }
    return 'central_line';
  }

  private calculateTherapyDay(startDate: string | Date | null): number {
    if (!startDate) return 0;
    const started = new Date(startDate);
    if (Number.isNaN(started.getTime())) return 0;
    const elapsedDays = Math.floor((Date.now() - started.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, elapsedDays + 1);
  }

  private calculateDaysSince(dateValue: string | Date | null): number {
    if (!dateValue) return 0;
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return 0;
    return Math.max(0, Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)));
  }
}
