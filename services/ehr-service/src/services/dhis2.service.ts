import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import axios, { AxiosInstance } from 'axios';
import { env } from '@umoya/config';
import { Patient } from '../entities/patient.entity';
import { TenantDhis2Config, TenantService } from './tenant.service';

interface Dhis2RuntimeConfig {
  baseUrl: string;
  apiVersion: string;
  authType: 'pat' | 'basic';
  pat?: string;
  username?: string;
  password?: string;
  orgUnitId?: string;
  trackedEntityTypeId?: string;
  dataSetId?: string;
}

interface Dhis2Context {
  enabled: boolean;
  useMock: boolean;
  reason?: string;
  config?: Dhis2RuntimeConfig;
  client?: AxiosInstance;
}

interface Dhis2PatientMappingRow {
  patient_id: string;
  dhis2_tei_id: string;
}

interface Dhis2EnrollmentRow {
  enrollment: string;
  status?: string;
}

interface Dhis2SyncStatsRow {
  last_sync?: string | null;
  patient_success_count?: number | string | null;
  event_success_count?: number | string | null;
  data_value_success_count?: number | string | null;
  total_error_count?: number | string | null;
}

export interface Dhis2SyncLogRow {
  id: string;
  entity_type: string;
  entity_id?: string | null;
  dhis2_id?: string | null;
  action: string;
  status: string;
  error_message?: string | null;
  payload?: Record<string, any> | null;
  synced_at?: string | null;
}

interface PatientAttributeIdMap {
  patientNumber?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: string;
  nationalId?: string;
  phone?: string;
}

type AggregateProfileKey =
  | 'service_delivery'
  | 'maternal_newborn'
  | 'hiv_monthly'
  | 'immunization_monthly'
  | 'pharmacy_stock'
  | 'ntd_regional'
  | 'pmtct_monthly'
  | 'tb_quarterly'
  | 'malaria_monthly'
  | 'ncd_monthly'
  | 'outpatient_morbidity'
  | 'laboratory_monthly'
  | 'mental_health_monthly'
  | 'nutrition_monthly'
  | 'icu_monthly'
  | 'hai_monthly'
  | 'surgical_monthly'
  | 'cervical_cancer_monthly'
  | 'neonatal_monthly';

interface AggregateProfileDefinition {
  dataSetCode: string;
  metricCodes: Record<string, string>;
}

@Injectable()
export class Dhis2Service {
  private readonly logger = new Logger(Dhis2Service.name);

  private readonly envBaseUrl = String(process.env.DHIS2_URL || env.DHIS2_URL || '').trim();
  private readonly envUsername = process.env.DHIS2_USERNAME;
  private readonly envPassword = process.env.DHIS2_PASSWORD;
  private readonly envPat = process.env.DHIS2_PAT;
  private readonly envApiVersion = process.env.DHIS2_API_VERSION || '38';
  private readonly envOrgUnit = process.env.DHIS2_ORG_UNIT;
  private readonly envTrackedEntityType = process.env.DHIS2_TRACKED_ENTITY_TYPE;
  private readonly envDataSetId = process.env.DHIS2_DATASET_ID;
  private readonly envAttrPatientNumber = process.env.DHIS2_ATTR_PATIENT_NUMBER;
  private readonly envAttrFirstName = process.env.DHIS2_ATTR_FIRST_NAME;
  private readonly envAttrLastName = process.env.DHIS2_ATTR_LAST_NAME;
  private readonly envAttrDob = process.env.DHIS2_ATTR_DOB;
  private readonly envAttrGender = process.env.DHIS2_ATTR_GENDER;
  private readonly envAttrNationalId = process.env.DHIS2_ATTR_NATIONAL_ID;
  private readonly envAttrPhone = process.env.DHIS2_ATTR_PHONE;
  private readonly forceMockMode = process.env.DHIS2_USE_MOCK === 'true';
  private readonly legacyAttributeFallbacks: PatientAttributeIdMap = {
    firstName: 'w75KJ2mc4zz',
    lastName: 'zDhUuAYrxNC',
    dateOfBirth: 'FO4GPuUTfQU',
    gender: 'cejWyOfXge6',
    nationalId: 'AuPLng5hLbE',
  };
  private readonly aggregateProfileDefinitions: Record<AggregateProfileKey, AggregateProfileDefinition> = {
    service_delivery: {
      dataSetCode: 'MC_DS_SERVICE_DELIVERY_MONTHLY',
      metricCodes: {
        totalConsultations: 'MC_DE_TOTAL_CONSULTATIONS',
        completedConsultations: 'MC_DE_COMPLETED_CONSULTATIONS',
        totalAdmissions: 'MC_DE_TOTAL_ADMISSIONS',
        totalDischarges: 'MC_DE_TOTAL_DISCHARGES',
        totalEdVisits: 'MC_DE_TOTAL_ED_VISITS',
      },
    },
    maternal_newborn: {
      dataSetCode: 'MC_DS_MATERNAL_NEWBORN_MONTHLY',
      metricCodes: {
        anc1Plus: 'MC_DE_MATERNAL_ANC1_PLUS',
        anc4Plus: 'MC_DE_MATERNAL_ANC4_PLUS',
        anc8Plus: 'MC_DE_MATERNAL_ANC8_PLUS',
        totalDeliveries: 'MC_DE_MATERNAL_TOTAL_DELIVERIES',
        caesareanDeliveries: 'MC_DE_MATERNAL_CSECTION_TOTAL',
        liveBirths: 'MC_DE_MATERNAL_LIVE_BIRTHS',
        stillBirths: 'MC_DE_MATERNAL_STILLBIRTHS',
        lowBirthWeightCount: 'MC_DE_MATERNAL_LOW_BIRTH_WEIGHT_COUNT',
      },
    },
    hiv_monthly: {
      dataSetCode: 'MC_DS_HIV_MONTHLY_RETURN',
      metricCodes: {
        plhivActiveInCare: 'MC_DE_HIV_PLHIV_ACTIVE_IN_CARE',
        artCoverageCount: 'MC_DE_HIV_ART_COVERAGE_COUNT',
        viralLoadSuppressed: 'MC_DE_HIV_VL_SUPPRESSED_LT1000',
        viralLoadUndetectable: 'MC_DE_HIV_VL_UNDETECTABLE_LT50',
        lossToFollowUpCount: 'MC_DE_HIV_LOST_TO_FOLLOWUP',
        treatmentFailureCount: 'MC_DE_HIV_TREATMENT_FAILURE_GT1000',
        tbScreenedCount: 'MC_DE_HIV_TB_SCREENED',
      },
    },
    immunization_monthly: {
      dataSetCode: 'MC_DS_IMMUNIZATION_MONTHLY',
      metricCodes: {
        dtp1Administered: 'MC_DE_IMMUNIZATION_DTP1',
        dtp3Administered: 'MC_DE_IMMUNIZATION_DTP3',
        measlesDose1Administered: 'MC_DE_IMMUNIZATION_MCV1',
        fullyImmunizedProxy: 'MC_DE_IMMUNIZATION_FULLY_IMMUNIZED_PROXY',
        aefiReports: 'MC_DE_IMMUNIZATION_AEFI_REPORTS',
      },
    },
    pharmacy_stock: {
      dataSetCode: 'MC_DS_PHARMACY_STOCK_MONTHLY',
      metricCodes: {
        stockOnHandTotal: 'MC_DE_PHARMACY_STOCK_ON_HAND_TOTAL',
        stockOutItemCount: 'MC_DE_PHARMACY_STOCKOUT_ITEMS',
        dispensedUnits: 'MC_DE_PHARMACY_DISPENSED_UNITS',
        dispensingTransactions: 'MC_DE_PHARMACY_DISPENSING_TRANSACTIONS',
      },
    },
    ntd_regional: {
      dataSetCode: 'MC_DS_NTD_REGIONAL_MONTHLY',
      metricCodes: {
        choleraNew: 'MC_DE_NTD_CHOLERA_NEW',
        choleraDeaths: 'MC_DE_NTD_CHOLERA_DEATHS',
        typhoidNew: 'MC_DE_NTD_TYPHOID_NEW',
        schistosomiasisNew: 'MC_DE_NTD_SCHISTOSOMIASIS_NEW',
        ntdOtherNew: 'MC_DE_NTD_OTHER_NEW',
      },
    },
    pmtct_monthly: {
      dataSetCode: 'MC_DS_PMTCT_MONTHLY',
      metricCodes: {
        pmtctEnrolled: 'MC_DE_PMTCT_ENROLLED',
        hivPositiveAtBooking: 'MC_DE_PMTCT_HIV_POSITIVE_BOOKING',
        artStartedInPregnancy: 'MC_DE_PMTCT_ART_STARTED',
        infantsTestedAt6Weeks: 'MC_DE_PMTCT_INFANT_TESTED_6W',
        infantsHivPositive: 'MC_DE_PMTCT_INFANT_HIV_POSITIVE',
      },
    },
    tb_quarterly: {
      dataSetCode: 'MC_DS_TB_QUARTERLY',
      metricCodes: {
        tbNewPulmonaryBacteriologicallyConfirmed: 'MC_DE_TB_NEW_PULM_BACT',
        tbNewPulmonaryClinicallyDiagnosed: 'MC_DE_TB_NEW_PULM_CLIN',
        tbNewExtrapulmonary: 'MC_DE_TB_NEW_EPTB',
        tbRelapse: 'MC_DE_TB_RELAPSE',
        tbMdrConfirmed: 'MC_DE_TB_MDR_CONFIRMED',
        tbXdrConfirmed: 'MC_DE_TB_XDR_CONFIRMED',
        tbHivCoinfected: 'MC_DE_TB_HIV_COINFECTED',
        tbOnArt: 'MC_DE_TB_HIV_ON_ART',
        tbOutcomeCured: 'MC_DE_TB_OUTCOME_CURED',
        tbOutcomeCompleted: 'MC_DE_TB_OUTCOME_COMPLETED',
        tbOutcomeFailed: 'MC_DE_TB_OUTCOME_FAILED',
        tbOutcomeDied: 'MC_DE_TB_OUTCOME_DIED',
        tbOutcomeLtfu: 'MC_DE_TB_OUTCOME_LTFU',
        tbContactsInvestigated: 'MC_DE_TB_CONTACTS_INVESTIGATED',
        tbContactsLtbi: 'MC_DE_TB_CONTACTS_LTBI_STARTED',
      },
    },
    malaria_monthly: {
      dataSetCode: 'MC_DS_MALARIA_MONTHLY',
      metricCodes: {
        malariaTested: 'MC_DE_MALARIA_TESTED',
        malariaRdtPositive: 'MC_DE_MALARIA_RDT_POSITIVE',
        malariaMicroscopyPositive: 'MC_DE_MALARIA_MICRO_POSITIVE',
        malariaConfirmedTreated: 'MC_DE_MALARIA_CONFIRMED_TREATED',
        malariaUncomplicated: 'MC_DE_MALARIA_UNCOMPLICATED',
        malariaSevere: 'MC_DE_MALARIA_SEVERE',
        malariaDeath: 'MC_DE_MALARIA_DEATH',
        malariaPlasmodiumFalciparum: 'MC_DE_MALARIA_PF',
        malariaPlasmodiumVivax: 'MC_DE_MALARIA_PV',
        malariaTreatmentFailure: 'MC_DE_MALARIA_TREATMENT_FAILURE',
        malariaPregnantWomenTested: 'MC_DE_MALARIA_PREGNANT_TESTED',
        malariaPregnantWomenPositive: 'MC_DE_MALARIA_PREGNANT_POSITIVE',
      },
    },
    ncd_monthly: {
      dataSetCode: 'MC_DS_NCD_MONTHLY',
      metricCodes: {
        hypertensionNewlyDiagnosed: 'MC_DE_HTN_NEW',
        hypertensionActiveInCare: 'MC_DE_HTN_ACTIVE',
        hypertensionBpControlled: 'MC_DE_HTN_BP_CONTROLLED',
        hypertensionOnTreatment: 'MC_DE_HTN_ON_TREATMENT',
        diabetesNewlyDiagnosed: 'MC_DE_DM_NEW',
        diabetesActiveInCare: 'MC_DE_DM_ACTIVE',
        diabetesHba1cControlled: 'MC_DE_DM_HBA1C_CONTROLLED',
        diabetesOnInsulin: 'MC_DE_DM_ON_INSULIN',
        ckdStage3to5: 'MC_DE_CKD_STAGE3_5',
        ckdOnRasBlockade: 'MC_DE_CKD_RAS_BLOCKADE',
        asthmaPatientsActive: 'MC_DE_ASTHMA_ACTIVE',
        asthmaUncontrolled: 'MC_DE_ASTHMA_UNCONTROLLED',
        copdActiveInCare: 'MC_DE_COPD_ACTIVE',
        strokeAdmissions: 'MC_DE_STROKE_ADMISSIONS',
        strokeThromboliticsGiven: 'MC_DE_STROKE_THROMBOLYTICS',
      },
    },
    outpatient_morbidity: {
      dataSetCode: 'MC_DS_OUTPATIENT_MORBIDITY_MONTHLY',
      metricCodes: {
        totalOutpatientAttendances: 'MC_DE_OPD_TOTAL',
        totalNewAttendances: 'MC_DE_OPD_NEW',
        malariaCases: 'MC_DE_OPD_MALARIA',
        acuteRespiratoryInfection: 'MC_DE_OPD_ARI',
        diarrhoeaCases: 'MC_DE_OPD_DIARRHOEA',
        skinDisease: 'MC_DE_OPD_SKIN',
        eyeDisease: 'MC_DE_OPD_EYE',
        injuriesTrauma: 'MC_DE_OPD_INJURY',
        hypertensionCases: 'MC_DE_OPD_HTN',
        diabetesCases: 'MC_DE_OPD_DM',
        tbSuspected: 'MC_DE_OPD_TB_SUSPECT',
        stisUrogenital: 'MC_DE_OPD_STI',
      },
    },
    laboratory_monthly: {
      dataSetCode: 'MC_DS_LABORATORY_MONTHLY',
      metricCodes: {
        totalTestsOrdered: 'MC_DE_LAB_TESTS_ORDERED',
        totalTestsCompleted: 'MC_DE_LAB_TESTS_COMPLETED',
        haematologyTests: 'MC_DE_LAB_HAEMATOLOGY',
        biochemistryTests: 'MC_DE_LAB_BIOCHEMISTRY',
        microbiologyTests: 'MC_DE_LAB_MICROBIOLOGY',
        criticalValuesReported: 'MC_DE_LAB_CRITICAL_VALUES',
        avgTurnaroundHours: 'MC_DE_LAB_TAT_HOURS',
        specimenRejections: 'MC_DE_LAB_SPECIMEN_REJECTIONS',
        cd4CountTests: 'MC_DE_LAB_CD4',
        viralLoadTests: 'MC_DE_LAB_VIRAL_LOAD',
        malariaRdtTests: 'MC_DE_LAB_MALARIA_RDT',
        sputumSmearTests: 'MC_DE_LAB_SPUTUM_SMEAR',
      },
    },
    mental_health_monthly: {
      dataSetCode: 'MC_DS_MENTAL_HEALTH_MONTHLY',
      metricCodes: {
        totalScreened: 'MC_DE_MH_SCREENED',
        depressionPositive: 'MC_DE_MH_DEPRESSION_POSITIVE',
        anxietyPositive: 'MC_DE_MH_ANXIETY_POSITIVE',
        substanceUsePositive: 'MC_DE_MH_SUBSTANCE_POSITIVE',
        newCarePlansCreated: 'MC_DE_MH_CARE_PLANS_NEW',
        activeInMentalHealthCare: 'MC_DE_MH_ACTIVE_CARE',
        psychiatricReferrals: 'MC_DE_MH_REFERRALS',
        suicideRiskHigh: 'MC_DE_MH_SUICIDE_HIGH_RISK',
      },
    },
    nutrition_monthly: {
      dataSetCode: 'MC_DS_NUTRITION_MONTHLY',
      metricCodes: {
        samAdmissions: 'MC_DE_NUT_SAM_ADMISSIONS',
        mamAdmissions: 'MC_DE_NUT_MAM_ADMISSIONS',
        samCured: 'MC_DE_NUT_SAM_CURED',
        samDied: 'MC_DE_NUT_SAM_DIED',
        samDefaulted: 'MC_DE_NUT_SAM_DEFAULTED',
        samNonResponsive: 'MC_DE_NUT_SAM_NON_RESPONSIVE',
        mamCured: 'MC_DE_NUT_MAM_CURED',
        muacRedAdmissions: 'MC_DE_NUT_MUAC_RED',
        muacYellowAdmissions: 'MC_DE_NUT_MUAC_YELLOW',
        oedemaCases: 'MC_DE_NUT_OEDEMA',
        rutfDispensedKg: 'MC_DE_NUT_RUTF_KG',
        therapeuticFeedingEnrolled: 'MC_DE_NUT_TF_ENROLLED',
      },
    },
    icu_monthly: {
      dataSetCode: 'MC_DS_ICU_MONTHLY',
      metricCodes: {
        icuAdmissions: 'MC_DE_ICU_ADMISSIONS',
        icuDeaths: 'MC_DE_ICU_DEATHS',
        icuAvgLosHours: 'MC_DE_ICU_AVG_LOS_HOURS',
        icuApacheHigh: 'MC_DE_ICU_APACHE_HIGH',
        icuVentilatorDays: 'MC_DE_ICU_VENTILATOR_DAYS',
        icuReadmissions: 'MC_DE_ICU_READMISSIONS',
        sepsisCases: 'MC_DE_ICU_SEPSIS',
        icuCardiacArrest: 'MC_DE_ICU_CARDIAC_ARREST',
      },
    },
    hai_monthly: {
      dataSetCode: 'MC_DS_HAI_MONTHLY',
      metricCodes: {
        totalHaiCases: 'MC_DE_HAI_TOTAL',
        ssiCases: 'MC_DE_HAI_SSI',
        cautCases: 'MC_DE_HAI_CAUTI',
        clabsiCases: 'MC_DE_HAI_CLABSI',
        vapCases: 'MC_DE_HAI_VAP',
        mrsaIsolates: 'MC_DE_HAI_MRSA',
        esblIsolates: 'MC_DE_HAI_ESBL',
        cdifficileCases: 'MC_DE_HAI_CDIFF',
        haiDeaths: 'MC_DE_HAI_DEATHS',
      },
    },
    surgical_monthly: {
      dataSetCode: 'MC_DS_SURGICAL_MONTHLY',
      metricCodes: {
        totalSurgicalCases: 'MC_DE_SURG_TOTAL',
        electiveCases: 'MC_DE_SURG_ELECTIVE',
        emergencyCases: 'MC_DE_SURG_EMERGENCY',
        caesareanSections: 'MC_DE_SURG_CSECTION',
        majorSurgicalComplications: 'MC_DE_SURG_COMPLICATIONS',
        surgicalMortality: 'MC_DE_SURG_MORTALITY',
        cancelledCases: 'MC_DE_SURG_CANCELLED',
        avgOperativeTimeMinutes: 'MC_DE_SURG_AVG_OP_TIME',
        bloodTransfusionsIntraop: 'MC_DE_SURG_TRANSFUSIONS',
      },
    },
    cervical_cancer_monthly: {
      dataSetCode: 'MC_DS_CERVICAL_CANCER_MONTHLY',
      metricCodes: {
        womenScreened: 'MC_DE_CX_SCREENED',
        viaPositive: 'MC_DE_CX_VIA_POSITIVE',
        papPositive: 'MC_DE_CX_PAP_POSITIVE',
        hpvPositive: 'MC_DE_CX_HPV_POSITIVE',
        cryotherapyPerformed: 'MC_DE_CX_CRYOTHERAPY',
        leepPerformed: 'MC_DE_CX_LEEP',
        referredForColposcopy: 'MC_DE_CX_COLPOSCOPY_REFERRAL',
        confirmedCancerCases: 'MC_DE_CX_CONFIRMED_CANCER',
      },
    },
    neonatal_monthly: {
      dataSetCode: 'MC_DS_NEONATAL_MONTHLY',
      metricCodes: {
        liveBirthsTotal: 'MC_DE_NEO_LIVE_BIRTHS',
        stillbirthsTotal: 'MC_DE_NEO_STILLBIRTHS',
        lowBirthWeightCount: 'MC_DE_NEO_LBW',
        veryLowBirthWeightCount: 'MC_DE_NEO_VLBW',
        pretermBirths: 'MC_DE_NEO_PRETERM',
        apgar5MinUnder7: 'MC_DE_NEO_APGAR_LOW',
        neonatalResuscitation: 'MC_DE_NEO_RESUSCITATION',
        scbuAdmissions: 'MC_DE_NEO_SCBU_ADMISSIONS',
        neonatalDeaths: 'MC_DE_NEO_DEATHS',
        hivExposedInfants: 'MC_DE_NEO_HIV_EXPOSED',
        arvProphylaxisGiven: 'MC_DE_NEO_ARV_PROPHYLAXIS',
      },
    },
  };

  constructor(private readonly tenantService: TenantService) {
    if (this.forceMockMode) {
      this.logger.warn('DHIS2 service running in MOCK mode (DHIS2_USE_MOCK=true)');
      return;
    }

    if (this.envPat) {
      this.logger.log('DHIS2 service initialized with PAT auth support (env fallback enabled)');
      return;
    }

    if (this.envUsername && this.envPassword) {
      this.logger.log('DHIS2 service initialized with basic auth support (env fallback enabled)');
      return;
    }

    this.logger.warn(
      'DHIS2 service initialized without env credentials. Per-tenant DHIS2 config is expected; otherwise API runs in MOCK mode.',
    );
  }

  private buildTenantRuntime(config: TenantDhis2Config): Dhis2RuntimeConfig {
    return {
      baseUrl: config.baseUrl,
      apiVersion: config.apiVersion || '40',
      authType: config.authType,
      pat: config.pat || undefined,
      username: config.username || undefined,
      password: config.password || undefined,
      orgUnitId: config.orgUnitId,
      trackedEntityTypeId: config.trackedEntityTypeId || undefined,
      dataSetId: config.dataSetId || undefined,
    };
  }

  private buildEnvRuntime(): Dhis2RuntimeConfig | null {
    const hasPat = Boolean(this.envPat && this.envPat.trim().length > 0);
    const hasBasic = Boolean(this.envUsername && this.envPassword);

    if (!hasPat && !hasBasic) {
      return null;
    }

    return {
      baseUrl: this.envBaseUrl,
      apiVersion: this.envApiVersion,
      authType: hasPat ? 'pat' : 'basic',
      pat: this.envPat,
      username: this.envUsername,
      password: this.envPassword,
      orgUnitId: this.envOrgUnit,
      trackedEntityTypeId: this.envTrackedEntityType,
      dataSetId: this.envDataSetId,
    };
  }

  private createClient(runtime: Dhis2RuntimeConfig): AxiosInstance {
    const normalizedBaseUrl = runtime.baseUrl.replace(/\/$/, '');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (runtime.authType === 'pat' && runtime.pat) {
      headers.Authorization = `ApiToken ${runtime.pat}`;
    }

    const client = axios.create({
      baseURL: `${normalizedBaseUrl}/api/${runtime.apiVersion}`,
      timeout: 30000,
      headers,
      auth:
        runtime.authType === 'basic' && runtime.username && runtime.password
          ? { username: runtime.username, password: runtime.password }
          : undefined,
    });

    client.interceptors.response.use(
      (response) => response,
      (error) => {
        this.logger.error(`DHIS2 API Error: ${error.message}`, error.response?.data);
        throw error;
      },
    );

    return client;
  }

  private async resolveContext(tenantId?: string): Promise<Dhis2Context> {
    if (this.forceMockMode) {
      return { enabled: true, useMock: true, reason: 'DHIS2_USE_MOCK=true' };
    }

    let runtime: Dhis2RuntimeConfig | null = null;

    if (tenantId) {
      const tenantConfig = await this.tenantService.getTenantDhis2Config(tenantId);
      if (tenantConfig && !tenantConfig.enabled) {
        return { enabled: false, useMock: false, reason: 'Tenant DHIS2 sync is disabled.' };
      }
      if (tenantConfig) {
        runtime = this.buildTenantRuntime(tenantConfig);
      }
    }

    if (!runtime) {
      runtime = this.buildEnvRuntime();
    }

    if (!runtime) {
      return {
        enabled: true,
        useMock: true,
        reason: this.envBaseUrl
          ? 'No DHIS2 PAT/basic credentials configured for tenant or env fallback.'
          : 'DHIS2_URL is not configured for tenant or env fallback.',
      };
    }

    if (runtime.authType === 'pat' && !runtime.pat) {
      return {
        enabled: false,
        useMock: false,
        reason: 'Tenant DHIS2 auth type is PAT but PAT is missing.',
      };
    }

    if (runtime.authType === 'basic' && (!runtime.username || !runtime.password)) {
      return {
        enabled: false,
        useMock: false,
        reason: 'Tenant DHIS2 auth type is basic but username/password are missing.',
      };
    }

    return {
      enabled: true,
      useMock: false,
      config: runtime,
      client: this.createClient(runtime),
    };
  }

  private isNotFoundError(error: any): boolean {
    return Number(error?.response?.status) === 404;
  }

  private isMissingRelationError(error: any): boolean {
    const pgCode = error?.code;
    const message = String(error?.message || '').toLowerCase();
    return pgCode === '42P01' || message.includes('relation') && message.includes('does not exist');
  }

  private formatDateOnly(value: unknown): string {
    if (!value) {
      return '';
    }

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? '' : value.toISOString().split('T')[0];
    }

    if (typeof value === 'string') {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
      return value.length >= 10 ? value.slice(0, 10) : '';
    }

    return '';
  }

  private getConfiguredPatientAttributeFallbacks(): PatientAttributeIdMap {
    return {
      patientNumber: this.envAttrPatientNumber || undefined,
      firstName: this.envAttrFirstName || this.legacyAttributeFallbacks.firstName,
      lastName: this.envAttrLastName || this.legacyAttributeFallbacks.lastName,
      dateOfBirth: this.envAttrDob || this.legacyAttributeFallbacks.dateOfBirth,
      gender: this.envAttrGender || this.legacyAttributeFallbacks.gender,
      nationalId: this.envAttrNationalId || this.legacyAttributeFallbacks.nationalId,
      phone: this.envAttrPhone || undefined,
    };
  }

  private async resolvePatientAttributeIds(context: Dhis2Context): Promise<PatientAttributeIdMap> {
    const fallback = this.getConfiguredPatientAttributeFallbacks();
    if (!context.client) {
      return fallback;
    }

    try {
      const response = await context.client.get('/trackedEntityAttributes', {
        params: {
          fields: 'id,code,name',
          paging: false,
        },
      });

      const trackedEntityAttributes = response.data?.trackedEntityAttributes || [];
      const byCode: Record<string, string> = {};
      for (const item of trackedEntityAttributes) {
        const code = item?.code;
        const id = item?.id;
        if (code && id) {
          byCode[String(code)] = String(id);
        }
      }

      return {
        patientNumber: byCode.MC_ATTR_PATIENT_NUMBER || fallback.patientNumber,
        firstName: byCode.MC_ATTR_FIRST_NAME || fallback.firstName,
        lastName: byCode.MC_ATTR_LAST_NAME || fallback.lastName,
        dateOfBirth: byCode.MC_ATTR_DOB || fallback.dateOfBirth,
        gender: byCode.MC_ATTR_GENDER || fallback.gender,
        nationalId: byCode.MC_ATTR_NATIONAL_ID || fallback.nationalId,
        phone: byCode.MC_ATTR_PHONE || fallback.phone,
      };
    } catch (error: any) {
      this.logger.warn(
        `Unable to resolve DHIS2 patient attributes by code, using fallback IDs: ${error?.message || error}`,
      );
      return fallback;
    }
  }

  private buildPatientAttributes(patient: Patient, attributeIds: PatientAttributeIdMap) {
    const attributes: Array<{ attribute: string; value: string }> = [];

    if (attributeIds.patientNumber) {
      attributes.push({ attribute: attributeIds.patientNumber, value: patient.patientNumber || patient.id || '' });
    }
    if (attributeIds.firstName) {
      attributes.push({ attribute: attributeIds.firstName, value: patient.firstName || '' });
    }
    if (attributeIds.lastName) {
      attributes.push({ attribute: attributeIds.lastName, value: patient.lastName || '' });
    }
    if (attributeIds.dateOfBirth) {
      attributes.push({ attribute: attributeIds.dateOfBirth, value: this.formatDateOnly(patient.dateOfBirth) });
    }
    if (attributeIds.gender) {
      // DHIS2 option sets expect title-case ("Male"/"Female"), not uppercase
      const raw = (patient.gender || '').toLowerCase();
      const genderValue = raw === 'male' ? 'Male' : raw === 'female' ? 'Female' : raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : '';
      attributes.push({ attribute: attributeIds.gender, value: genderValue });
    }
    if (attributeIds.nationalId) {
      attributes.push({ attribute: attributeIds.nationalId, value: patient.nationalId || '' });
    }
    if (attributeIds.phone) {
      attributes.push({ attribute: attributeIds.phone, value: patient.phone || '' });
    }

    return attributes;
  }

  private extractTeiId(responseData: any): string | null {
    return (
      responseData?.response?.importSummaries?.[0]?.reference ||
      responseData?.response?.reference ||
      responseData?.reference ||
      null
    );
  }

  private extractImportReference(responseData: any): string | null {
    return (
      responseData?.response?.importSummaries?.[0]?.reference ||
      responseData?.response?.reference ||
      responseData?.response?.uid ||
      responseData?.reference ||
      responseData?.uid ||
      null
    );
  }

  private toImportCount(value: any): number {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  }

  private extractImportCounts(responseData: any): {
    imported: number;
    updated: number;
    ignored: number;
    deleted: number;
  } {
    const importCount = responseData?.importCount || {};
    return {
      imported: this.toImportCount(responseData?.imported ?? importCount.imported),
      updated: this.toImportCount(responseData?.updated ?? importCount.updated),
      ignored: this.toImportCount(responseData?.ignored ?? importCount.ignored),
      deleted: this.toImportCount(responseData?.deleted ?? importCount.deleted),
    };
  }

  private extractLatestOpenFuturePeriod(errorData: any): string | null {
    const conflicts = errorData?.response?.conflicts || errorData?.conflicts || [];
    if (!Array.isArray(conflicts) || conflicts.length === 0) {
      return null;
    }

    const periods = new Set<string>();
    for (const conflict of conflicts) {
      const value = String(conflict?.value || '');
      const match = value.match(/latest open future period:\s*`?(\d{6})`?/i);
      if (match?.[1]) {
        periods.add(match[1]);
      }
    }

    if (periods.size !== 1) {
      return null;
    }

    return Array.from(periods)[0];
  }

  private isUuid(value?: string | null): boolean {
    if (!value) {
      return false;
    }
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  private asNullableUuid(value?: string | null): string | null {
    return this.isUuid(value) ? String(value) : null;
  }

  private canQueryTenantDb(tenantDb?: DataSource): tenantDb is DataSource {
    return Boolean(tenantDb && typeof (tenantDb as any).query === 'function');
  }

  private async ensureTenantSyncTables(tenantDb: DataSource): Promise<void> {
    await tenantDb.query(`
      CREATE TABLE IF NOT EXISTS dhis2_patient_mappings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL UNIQUE,
        dhis2_tei_id VARCHAR(64) NOT NULL,
        org_unit_id VARCHAR(64),
        tenant_identifier VARCHAR(128),
        last_synced_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    await tenantDb.query(`
      CREATE TABLE IF NOT EXISTS dhis2_sync_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        entity_type VARCHAR(50) NOT NULL,
        entity_id UUID,
        dhis2_id VARCHAR(64),
        action VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL,
        error_message TEXT,
        payload JSONB DEFAULT '{}'::jsonb,
        synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    await tenantDb.query(`
      ALTER TABLE dhis2_sync_log
      DROP CONSTRAINT IF EXISTS dhis2_sync_log_action_check
    `);
    await tenantDb.query(`
      ALTER TABLE dhis2_sync_log
      ADD CONSTRAINT dhis2_sync_log_action_check
      CHECK (action IN ('create','update','upsert','skip','error','run_now'))
    `);
  }

  private async loadPatientMappings(tenantDb: DataSource): Promise<Map<string, string>> {
    const rows: Dhis2PatientMappingRow[] = await tenantDb.query(
      `SELECT patient_id, dhis2_tei_id FROM dhis2_patient_mappings`,
    );
    return new Map(rows.map((row) => [row.patient_id, row.dhis2_tei_id]));
  }

  private async loadPatientTeiMapping(tenantDb: DataSource, patientId: string): Promise<string | null> {
    const rows: Array<{ dhis2_tei_id: string }> = await tenantDb.query(
      `
      SELECT dhis2_tei_id
      FROM dhis2_patient_mappings
      WHERE patient_id = $1
      LIMIT 1
      `,
      [patientId],
    );
    if (!rows || rows.length === 0) {
      return null;
    }
    return rows[0].dhis2_tei_id || null;
  }

  private async resolveDataSetIdByCode(context: Dhis2Context, dataSetCode: string): Promise<string | null> {
    if (!context.client || !dataSetCode) {
      return null;
    }

    try {
      const response = await context.client.get('/dataSets', {
        params: {
          fields: 'id,code',
          paging: false,
          filter: `code:eq:${dataSetCode}`,
        },
      });

      const dataSets = response.data?.dataSets || [];
      if (!Array.isArray(dataSets) || dataSets.length === 0) {
        return null;
      }
      return dataSets[0]?.id || null;
    } catch (error: any) {
      this.logger.warn(`Unable to resolve dataset by code ${dataSetCode}: ${error?.message || error}`);
      return null;
    }
  }

  private async resolveAggregateElementIdsByCode(
    context: Dhis2Context,
    dataSetId: string | undefined,
    metricCodes: Record<string, string>,
  ): Promise<Record<string, string>> {
    if (!context.client || !dataSetId) {
      return {};
    }

    try {
      const response = await context.client.get(`/dataSets/${dataSetId}`, {
        params: {
          fields: 'dataSetElements[dataElement[id,code,name]]',
        },
      });

      const byCode: Record<string, string> = {};
      const dataSetElements = response.data?.dataSetElements || [];
      for (const item of dataSetElements) {
        const code = item?.dataElement?.code;
        const id = item?.dataElement?.id;
        if (code && id) {
          byCode[String(code)] = String(id);
        }
      }

      const resolved: Record<string, string> = {};
      for (const [metricKey, metricCode] of Object.entries(metricCodes)) {
        if (byCode[metricCode]) {
          resolved[metricKey] = byCode[metricCode];
        }
      }
      return resolved;
    } catch (error: any) {
      this.logger.warn(
        `Unable to resolve dataset data elements from DHIS2 (${dataSetId}): ${error?.message || error}`,
      );
      return {};
    }
  }

  private getAggregateProfile(profile?: string): {
    key: AggregateProfileKey;
    definition: AggregateProfileDefinition;
  } | null {
    const normalized = String(profile || 'service_delivery').trim().toLowerCase() as AggregateProfileKey;
    const definition = this.aggregateProfileDefinitions[normalized];
    if (!definition) {
      return null;
    }
    return {
      key: normalized,
      definition,
    };
  }

  private resolveMonthlyPeriodBounds(period: string): { startDate: string; endDate: string } {
    const normalized = String(period || '').trim();
    if (!/^\d{6}$/.test(normalized)) {
      const now = new Date();
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      return {
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
      };
    }

    const year = Number(normalized.slice(0, 4));
    const month = Number(normalized.slice(4, 6));
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    };
  }

  private async safeMetricCount(
    tenantDb: DataSource,
    label: string,
    sql: string,
    params: any[] = [],
  ): Promise<number> {
    try {
      const rows: Array<{ total: number | string }> = await tenantDb.query(sql, params);
      return Number(rows?.[0]?.total || 0);
    } catch (error: any) {
      if (this.isMissingRelationError(error)) {
        this.logger.warn(`DHIS2 aggregate source for ${label} is missing; defaulting to 0.`);
        return 0;
      }
      throw error;
    }
  }

  private async safeMetricSum(
    tenantDb: DataSource,
    label: string,
    sql: string,
    params: any[] = [],
  ): Promise<number> {
    try {
      const rows: Array<{ total: number | string }> = await tenantDb.query(sql, params);
      return Number(rows?.[0]?.total || 0);
    } catch (error: any) {
      if (this.isMissingRelationError(error)) {
        this.logger.warn(`DHIS2 aggregate source for ${label} is missing; defaulting to 0.`);
        return 0;
      }
      throw error;
    }
  }

  private async computeAggregateMetrics(
    profile: AggregateProfileKey,
    tenantDb: DataSource,
    period: string,
  ): Promise<Record<string, number>> {
    const { startDate, endDate } = this.resolveMonthlyPeriodBounds(period);

    if (profile === 'service_delivery') {
      const [totalConsultations, completedConsultations, totalAdmissions, totalDischarges, totalEdVisits] =
        await Promise.all([
          this.safeMetricCount(
            tenantDb,
            'appointments_total',
            `SELECT COUNT(*)::int AS total FROM appointments
             WHERE COALESCE(appointment_date, created_at)::date >= $1
               AND COALESCE(appointment_date, created_at)::date < $2`,
            [startDate, endDate],
          ),
          this.safeMetricCount(
            tenantDb,
            'appointments_completed',
            `SELECT COUNT(*)::int AS total FROM appointments
             WHERE LOWER(COALESCE(status, '')) = 'completed'
               AND COALESCE(appointment_date, created_at)::date >= $1
               AND COALESCE(appointment_date, created_at)::date < $2`,
            [startDate, endDate],
          ),
          this.safeMetricCount(
            tenantDb,
            'admissions_total',
            `SELECT COUNT(*)::int AS total FROM admissions
             WHERE COALESCE(admission_date, created_at)::date >= $1
               AND COALESCE(admission_date, created_at)::date < $2`,
            [startDate, endDate],
          ),
          this.safeMetricCount(
            tenantDb,
            'discharges_total',
            `SELECT COUNT(*)::int AS total FROM discharges
             WHERE COALESCE(discharge_date, created_at)::date >= $1
               AND COALESCE(discharge_date, created_at)::date < $2`,
            [startDate, endDate],
          ),
          this.safeMetricCount(
            tenantDb,
            'ed_visits_total',
            `SELECT COUNT(*)::int AS total FROM ed_visits
             WHERE COALESCE(visit_date, created_at)::date >= $1
               AND COALESCE(visit_date, created_at)::date < $2`,
            [startDate, endDate],
          ),
        ]);

      return {
        totalConsultations,
        completedConsultations,
        totalAdmissions,
        totalDischarges,
        totalEdVisits,
      };
    }

    if (profile === 'maternal_newborn') {
      const [
        anc1Plus,
        anc4Plus,
        anc8Plus,
        totalDeliveries,
        caesareanDeliveries,
        liveBirths,
        stillBirths,
        lowBirthWeightCount,
      ] = await Promise.all([
        this.safeMetricCount(
          tenantDb,
          'anc_1_plus',
          `
          SELECT COUNT(DISTINCT maternity_enrollment_id)::int AS total
          FROM anc_visits
          WHERE visit_date >= $1 AND visit_date < $2
          `,
          [startDate, endDate],
        ),
        this.safeMetricCount(
          tenantDb,
          'anc_4_plus',
          `
          SELECT COUNT(*)::int AS total
          FROM (
            SELECT maternity_enrollment_id
            FROM anc_visits
            WHERE visit_date >= $1 AND visit_date < $2
            GROUP BY maternity_enrollment_id
            HAVING COUNT(*) >= 4
          ) coverage
          `,
          [startDate, endDate],
        ),
        this.safeMetricCount(
          tenantDb,
          'anc_8_plus',
          `
          SELECT COUNT(*)::int AS total
          FROM (
            SELECT maternity_enrollment_id
            FROM anc_visits
            WHERE visit_date >= $1 AND visit_date < $2
            GROUP BY maternity_enrollment_id
            HAVING COUNT(*) >= 8
          ) coverage
          `,
          [startDate, endDate],
        ),
        this.safeMetricCount(
          tenantDb,
          'deliveries_total',
          `
          SELECT COUNT(*)::int AS total
          FROM deliveries
          WHERE delivery_date >= $1 AND delivery_date < $2
          `,
          [startDate, endDate],
        ),
        this.safeMetricCount(
          tenantDb,
          'deliveries_c_section',
          `
          SELECT COUNT(*)::int AS total
          FROM deliveries
          WHERE delivery_date >= $1
            AND delivery_date < $2
            AND (
              LOWER(COALESCE(delivery_type, '')) LIKE '%c%section%'
              OR LOWER(COALESCE(delivery_method, '')) LIKE '%caesar%'
            )
          `,
          [startDate, endDate],
        ),
        this.safeMetricCount(
          tenantDb,
          'births_live',
          `
          SELECT COUNT(*)::int AS total
          FROM birth_outcomes bo
          JOIN deliveries d ON d.id = bo.delivery_id
          WHERE d.delivery_date >= $1
            AND d.delivery_date < $2
            AND (
              LOWER(COALESCE(bo.newborn_outcome, '')) LIKE '%live%'
              OR LOWER(COALESCE(bo.birth_outcome, '')) LIKE '%live%'
            )
          `,
          [startDate, endDate],
        ),
        this.safeMetricCount(
          tenantDb,
          'births_still',
          `
          SELECT COUNT(*)::int AS total
          FROM birth_outcomes bo
          JOIN deliveries d ON d.id = bo.delivery_id
          WHERE d.delivery_date >= $1
            AND d.delivery_date < $2
            AND (
              LOWER(COALESCE(bo.newborn_outcome, '')) LIKE '%still%'
              OR LOWER(COALESCE(bo.birth_outcome, '')) LIKE '%still%'
            )
          `,
          [startDate, endDate],
        ),
        this.safeMetricCount(
          tenantDb,
          'births_low_weight',
          `
          SELECT COUNT(*)::int AS total
          FROM birth_outcomes bo
          JOIN deliveries d ON d.id = bo.delivery_id
          WHERE d.delivery_date >= $1
            AND d.delivery_date < $2
            AND bo.birth_weight IS NOT NULL
            AND bo.birth_weight > 0
            AND bo.birth_weight < 2500
          `,
          [startDate, endDate],
        ),
      ]);

      return {
        anc1Plus,
        anc4Plus,
        anc8Plus,
        totalDeliveries,
        caesareanDeliveries,
        liveBirths,
        stillBirths,
        lowBirthWeightCount,
      };
    }

    if (profile === 'hiv_monthly') {
      const [plhivActiveInCare, artCoverageCount, viralLoadSuppressed, viralLoadUndetectable, lossToFollowUpCount, treatmentFailureCount, tbScreenedCount] =
        await Promise.all([
          this.safeMetricCount(
            tenantDb,
            'hiv_active_in_care',
            `
            SELECT COUNT(*)::int AS total
            FROM hiv_care_enrollments
            WHERE LOWER(COALESCE(enrollment_status, '')) IN ('active', 'in_care', 'incare', 'on_art')
            `,
          ),
          this.safeMetricCount(
            tenantDb,
            'hiv_on_art',
            `
            SELECT COUNT(*)::int AS total
            FROM hiv_care_enrollments
            WHERE art_start_date IS NOT NULL
              AND LOWER(COALESCE(enrollment_status, '')) IN ('active', 'in_care', 'incare', 'on_art')
            `,
          ),
          this.safeMetricCount(
            tenantDb,
            'hiv_vl_suppressed',
            `
            SELECT COUNT(*)::int AS total
            FROM hiv_clinical_visits
            WHERE visit_date >= $1
              AND visit_date < $2
              AND viral_load IS NOT NULL
              AND viral_load > 0
              AND viral_load < 1000
            `,
            [startDate, endDate],
          ),
          this.safeMetricCount(
            tenantDb,
            'hiv_vl_undetectable',
            `
            SELECT COUNT(*)::int AS total
            FROM hiv_clinical_visits
            WHERE visit_date >= $1
              AND visit_date < $2
              AND viral_load IS NOT NULL
              AND viral_load > 0
              AND viral_load < 50
            `,
            [startDate, endDate],
          ),
          this.safeMetricCount(
            tenantDb,
            'hiv_ltfu',
            `
            SELECT COUNT(*)::int AS total
            FROM hiv_care_enrollments
            WHERE LOWER(COALESCE(enrollment_status, '')) LIKE '%lost%'
            `,
          ),
          this.safeMetricCount(
            tenantDb,
            'hiv_treatment_failure',
            `
            SELECT COUNT(*)::int AS total
            FROM hiv_clinical_visits
            WHERE visit_date >= $1
              AND visit_date < $2
              AND viral_load IS NOT NULL
              AND viral_load > 1000
            `,
            [startDate, endDate],
          ),
          this.safeMetricCount(
            tenantDb,
            'hiv_tb_screened',
            `
            SELECT COUNT(*)::int AS total
            FROM hiv_clinical_visits
            WHERE visit_date >= $1
              AND visit_date < $2
              AND (
                tb_screening IS NOT NULL
                OR tb_screened_legacy IS NOT NULL
              )
            `,
            [startDate, endDate],
          ),
        ]);

      return {
        plhivActiveInCare,
        artCoverageCount,
        viralLoadSuppressed,
        viralLoadUndetectable,
        lossToFollowUpCount,
        treatmentFailureCount,
        tbScreenedCount,
      };
    }

    if (profile === 'immunization_monthly') {
      const [dtp1Administered, dtp3Administered, measlesDose1Administered, fullyImmunizedProxy, aefiReports] =
        await Promise.all([
          this.safeMetricCount(
            tenantDb,
            'immunization_dtp1',
            `
            SELECT COUNT(*)::int AS total
            FROM immunizations
            WHERE administration_date >= $1
              AND administration_date < $2
              AND (
                LOWER(COALESCE(vaccine_code, '') || ' ' || COALESCE(vaccine_name, '') || ' ' || COALESCE(cvx_code, '')) LIKE '%dtp1%'
                OR (LOWER(COALESCE(vaccine_name, '')) LIKE '%pentavalent%' AND dose_number = 1)
              )
            `,
            [startDate, endDate],
          ),
          this.safeMetricCount(
            tenantDb,
            'immunization_dtp3',
            `
            SELECT COUNT(*)::int AS total
            FROM immunizations
            WHERE administration_date >= $1
              AND administration_date < $2
              AND (
                LOWER(COALESCE(vaccine_code, '') || ' ' || COALESCE(vaccine_name, '') || ' ' || COALESCE(cvx_code, '')) LIKE '%dtp3%'
                OR (LOWER(COALESCE(vaccine_name, '')) LIKE '%pentavalent%' AND dose_number = 3)
              )
            `,
            [startDate, endDate],
          ),
          this.safeMetricCount(
            tenantDb,
            'immunization_mcv1',
            `
            SELECT COUNT(*)::int AS total
            FROM immunizations
            WHERE administration_date >= $1
              AND administration_date < $2
              AND LOWER(COALESCE(vaccine_name, '') || ' ' || COALESCE(vaccine_code, '')) LIKE '%measles%'
              AND COALESCE(dose_number, 1) = 1
            `,
            [startDate, endDate],
          ),
          this.safeMetricCount(
            tenantDb,
            'immunization_fully_proxy',
            `
            SELECT COUNT(*)::int AS total
            FROM (
              SELECT patient_id
              FROM immunizations
              WHERE administration_date >= $1
                AND administration_date < $2
              GROUP BY patient_id
              HAVING COUNT(*) >= 3
            ) coverage
            `,
            [startDate, endDate],
          ),
          this.safeMetricCount(
            tenantDb,
            'immunization_aefi',
            `
            SELECT COUNT(*)::int AS total
            FROM vaccine_adverse_events
            WHERE event_date >= $1
              AND event_date < $2
            `,
            [startDate, endDate],
          ),
        ]);

      return {
        dtp1Administered,
        dtp3Administered,
        measlesDose1Administered,
        fullyImmunizedProxy,
        aefiReports,
      };
    }

    if (profile === 'pharmacy_stock') {
    const [stockOnHandTotal, stockOutItemCount, dispensedUnits, dispensingTransactions] = await Promise.all([
      this.safeMetricSum(
        tenantDb,
        'pharmacy_stock_on_hand',
        `SELECT COALESCE(SUM(quantity_on_hand), 0)::numeric AS total FROM pharmacy_inventory`,
      ),
      this.safeMetricCount(
        tenantDb,
        'pharmacy_stockout_items',
        `SELECT COUNT(*)::int AS total FROM pharmacy_inventory WHERE COALESCE(quantity_on_hand, 0) <= 0`,
      ),
      this.safeMetricSum(
        tenantDb,
        'pharmacy_dispensed_units',
        `
        SELECT COALESCE(SUM(pi.quantity_dispensed), 0)::numeric AS total
        FROM pharmacy_dispensing_items pi
        JOIN pharmacy_dispensings pd ON pd.id = pi.dispensing_id
        WHERE pd.dispensing_date >= $1
          AND pd.dispensing_date < $2
        `,
        [startDate, endDate],
      ),
      this.safeMetricCount(
        tenantDb,
        'pharmacy_dispensing_transactions',
        `
        SELECT COUNT(*)::int AS total
        FROM pharmacy_dispensings
        WHERE dispensing_date >= $1
          AND dispensing_date < $2
        `,
        [startDate, endDate],
      ),
    ]);

    return {
      stockOnHandTotal,
      stockOutItemCount,
      dispensedUnits,
      dispensingTransactions,
    };
  }

  // ── NTD / Regional profile ─────────────────────────────────────────────────
    if (profile === 'ntd_regional') {
      const [choleraNew, choleraDeaths, typhoidNew, schistosomiasisNew, ntdOtherNew] = await Promise.all([
        this.safeMetricCount(tenantDb, 'ntd_cholera_new',
          `SELECT COUNT(*)::int AS total FROM cholera_cases WHERE created_at >= $1 AND created_at < $2`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'ntd_cholera_deaths',
          `SELECT COALESCE(SUM(cholera_deaths), 0)::int AS total FROM regional_disease_reports
           WHERE report_period >= $1 AND report_period < $2`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'ntd_typhoid_new',
          `SELECT COUNT(*)::int AS total FROM typhoid_cases WHERE created_at >= $1 AND created_at < $2`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'ntd_schistosomiasis_new',
          `SELECT COUNT(*)::int AS total FROM ntd_cases WHERE disease = 'schistosomiasis'
           AND created_at >= $1 AND created_at < $2`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'ntd_other_new',
          `SELECT COUNT(*)::int AS total FROM ntd_cases WHERE disease != 'schistosomiasis'
           AND created_at >= $1 AND created_at < $2`,
          [startDate, endDate]),
      ]);
      return { choleraNew, choleraDeaths, typhoidNew, schistosomiasisNew, ntdOtherNew };
    }

    // ── PMTCT profile ──────────────────────────────────────────────────────────
    if (profile === 'pmtct_monthly') {
      const [pmtctEnrolled, hivPositiveAtBooking, artStartedInPregnancy, infantsTestedAt6Weeks, infantsHivPositive] = await Promise.all([
        this.safeMetricCount(tenantDb, 'pmtct_enrolled',
          `SELECT COUNT(*)::int AS total FROM pmtct_enrollments WHERE enrollment_date >= $1 AND enrollment_date < $2`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'pmtct_hiv_positive_booking',
          `SELECT COUNT(*)::int AS total FROM pmtct_enrollments
           WHERE enrollment_date >= $1 AND enrollment_date < $2 AND hiv_status_at_booking = 'positive'`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'pmtct_art_started',
          `SELECT COUNT(*)::int AS total FROM pmtct_enrollments
           WHERE enrollment_date >= $1 AND enrollment_date < $2 AND art_started = true`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'pmtct_infant_tested_6w',
          `SELECT COUNT(*)::int AS total FROM pmtct_infants
           WHERE created_at >= $1 AND created_at < $2 AND hiv_test_at_6weeks = 'done'`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'pmtct_infant_hiv_positive',
          `SELECT COUNT(*)::int AS total FROM pmtct_infants
           WHERE created_at >= $1 AND created_at < $2 AND dbs_result_6weeks = 'positive'`,
          [startDate, endDate]),
      ]);
      return { pmtctEnrolled, hivPositiveAtBooking, artStartedInPregnancy, infantsTestedAt6Weeks, infantsHivPositive };
    }

    if (profile === 'tb_quarterly') {
      const [
        tbNewPulmonaryBacteriologicallyConfirmed, tbNewPulmonaryClinicallyDiagnosed,
        tbNewExtrapulmonary, tbRelapse, tbMdrConfirmed, tbXdrConfirmed,
        tbHivCoinfected, tbOnArt, tbOutcomeCured, tbOutcomeCompleted,
        tbOutcomeFailed, tbOutcomeDied, tbOutcomeLtfu,
        tbContactsInvestigated, tbContactsLtbi,
      ] = await Promise.all([
        this.safeMetricCount(tenantDb, 'tb_new_pulm_bact',
          `SELECT COUNT(*)::int AS total FROM tb_patients
           WHERE notification_date >= $1 AND notification_date < $2
             AND LOWER(COALESCE(case_type,'')) IN ('pulmonary','pulm')
             AND LOWER(COALESCE(bacteriological_confirmation,'')) IN ('confirmed','positive','yes')`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'tb_new_pulm_clin',
          `SELECT COUNT(*)::int AS total FROM tb_patients
           WHERE notification_date >= $1 AND notification_date < $2
             AND LOWER(COALESCE(case_type,'')) IN ('pulmonary','pulm')
             AND LOWER(COALESCE(bacteriological_confirmation,'')) NOT IN ('confirmed','positive','yes')`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'tb_new_eptb',
          `SELECT COUNT(*)::int AS total FROM tb_patients
           WHERE notification_date >= $1 AND notification_date < $2
             AND LOWER(COALESCE(case_type,'')) IN ('extrapulmonary','eptb')`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'tb_relapse',
          `SELECT COUNT(*)::int AS total FROM tb_patients
           WHERE notification_date >= $1 AND notification_date < $2
             AND LOWER(COALESCE(treatment_category,'')) LIKE '%relapse%'`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'tb_mdr',
          `SELECT COUNT(*)::int AS total FROM tb_patients
           WHERE notification_date >= $1 AND notification_date < $2
             AND LOWER(COALESCE(case_type,'')) IN ('mdr','mdr-tb','mdr_tb')`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'tb_xdr',
          `SELECT COUNT(*)::int AS total FROM tb_patients
           WHERE notification_date >= $1 AND notification_date < $2
             AND LOWER(COALESCE(case_type,'')) IN ('xdr','xdr-tb','xdr_tb')`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'tb_hiv',
          `SELECT COUNT(*)::int AS total FROM tb_patients
           WHERE notification_date >= $1 AND notification_date < $2
             AND hiv_status = 'positive'`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'tb_hiv_on_art',
          `SELECT COUNT(*)::int AS total FROM tb_patients
           WHERE notification_date >= $1 AND notification_date < $2
             AND hiv_status = 'positive' AND art_linkage_date IS NOT NULL`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'tb_cured',
          `SELECT COUNT(*)::int AS total FROM tb_treatment_episodes
           WHERE outcome_date >= $1 AND outcome_date < $2
             AND LOWER(COALESCE(treatment_outcome,'')) = 'cured'`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'tb_completed',
          `SELECT COUNT(*)::int AS total FROM tb_treatment_episodes
           WHERE outcome_date >= $1 AND outcome_date < $2
             AND LOWER(COALESCE(treatment_outcome,'')) = 'treatment completed'`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'tb_failed',
          `SELECT COUNT(*)::int AS total FROM tb_treatment_episodes
           WHERE outcome_date >= $1 AND outcome_date < $2
             AND LOWER(COALESCE(treatment_outcome,'')) = 'failed'`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'tb_died',
          `SELECT COUNT(*)::int AS total FROM tb_treatment_episodes
           WHERE outcome_date >= $1 AND outcome_date < $2
             AND LOWER(COALESCE(treatment_outcome,'')) = 'died'`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'tb_ltfu',
          `SELECT COUNT(*)::int AS total FROM tb_treatment_episodes
           WHERE outcome_date >= $1 AND outcome_date < $2
             AND LOWER(COALESCE(treatment_outcome,'')) IN ('lost to follow-up','ltfu','defaulted')`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'tb_contacts',
          `SELECT COUNT(*)::int AS total FROM contact_tracing_contacts ctc
           JOIN contact_tracing_records ctr ON ctr.id = ctc.record_id
           WHERE ctr.created_at >= $1 AND ctr.created_at < $2`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'tb_contacts_ltbi',
          `SELECT COUNT(*)::int AS total FROM contact_tracing_contacts ctc
           JOIN contact_tracing_records ctr ON ctr.id = ctc.record_id
           WHERE ctr.created_at >= $1 AND ctr.created_at < $2
             AND ctc.rdt_result = 'positive'`,
          [startDate, endDate]),
      ]);
      return {
        tbNewPulmonaryBacteriologicallyConfirmed, tbNewPulmonaryClinicallyDiagnosed,
        tbNewExtrapulmonary, tbRelapse, tbMdrConfirmed, tbXdrConfirmed,
        tbHivCoinfected, tbOnArt, tbOutcomeCured, tbOutcomeCompleted,
        tbOutcomeFailed, tbOutcomeDied, tbOutcomeLtfu,
        tbContactsInvestigated, tbContactsLtbi,
      };
    }

    if (profile === 'malaria_monthly') {
      const [
        malariaTested, malariaRdtPositive, malariaMicroscopyPositive,
        malariaConfirmedTreated, malariaUncomplicated, malariaSevere,
        malariaDeath, malariaPlasmodiumFalciparum, malariaPlasmodiumVivax,
        malariaTreatmentFailure, malariaPregnantWomenTested, malariaPregnantWomenPositive,
      ] = await Promise.all([
        this.safeMetricCount(tenantDb, 'malaria_tested',
          `SELECT COUNT(*)::int AS total FROM malaria_tests
           WHERE test_date >= $1 AND test_date < $2`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'malaria_rdt_pos',
          `SELECT COUNT(*)::int AS total FROM malaria_tests
           WHERE test_date >= $1 AND test_date < $2
             AND LOWER(COALESCE(test_type,'')) IN ('rdt','rapid')
             AND LOWER(COALESCE(result,'')) IN ('positive','pos')`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'malaria_micro_pos',
          `SELECT COUNT(*)::int AS total FROM malaria_tests
           WHERE test_date >= $1 AND test_date < $2
             AND LOWER(COALESCE(test_type,'')) IN ('microscopy','smear')
             AND LOWER(COALESCE(result,'')) IN ('positive','pos')`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'malaria_treated',
          `SELECT COUNT(*)::int AS total FROM malaria_cases mc
           JOIN malaria_treatment_episodes mte ON mte.malaria_case_id = mc.id
           WHERE mc.case_date >= $1 AND mc.case_date < $2`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'malaria_uncomp',
          `SELECT COUNT(*)::int AS total FROM malaria_cases
           WHERE case_date >= $1 AND case_date < $2
             AND LOWER(COALESCE(severity,'')) IN ('uncomplicated','mild','moderate')`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'malaria_severe',
          `SELECT COUNT(*)::int AS total FROM malaria_cases
           WHERE case_date >= $1 AND case_date < $2
             AND LOWER(COALESCE(severity,'')) IN ('severe','critical')`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'malaria_death',
          `SELECT COUNT(*)::int AS total FROM malaria_cases
           WHERE case_date >= $1 AND case_date < $2
             AND LOWER(COALESCE(case_outcome,'')) = 'died'`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'malaria_pf',
          `SELECT COUNT(*)::int AS total FROM malaria_cases
           WHERE case_date >= $1 AND case_date < $2
             AND LOWER(COALESCE(parasite_species,'')) LIKE '%falciparum%'`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'malaria_pv',
          `SELECT COUNT(*)::int AS total FROM malaria_cases
           WHERE case_date >= $1 AND case_date < $2
             AND LOWER(COALESCE(parasite_species,'')) LIKE '%vivax%'`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'malaria_failure',
          `SELECT COUNT(*)::int AS total FROM malaria_treatment_episodes
           WHERE created_at >= $1 AND created_at < $2
             AND LOWER(COALESCE(treatment_outcome,'')) LIKE '%fail%'`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'malaria_preg_tested',
          `SELECT COUNT(DISTINCT mc.id)::int AS total FROM malaria_cases mc
           JOIN patients p ON p.id = mc.patient_id
           WHERE mc.case_date >= $1 AND mc.case_date < $2
             AND p.gender = 'female'`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'malaria_preg_pos',
          `SELECT COUNT(DISTINCT mc.id)::int AS total FROM malaria_cases mc
           JOIN patients p ON p.id = mc.patient_id
           WHERE mc.case_date >= $1 AND mc.case_date < $2
             AND p.gender = 'female'
             AND LOWER(COALESCE(mc.case_outcome,'')) != 'negative'`,
          [startDate, endDate]),
      ]);
      return {
        malariaTested, malariaRdtPositive, malariaMicroscopyPositive,
        malariaConfirmedTreated, malariaUncomplicated, malariaSevere,
        malariaDeath, malariaPlasmodiumFalciparum, malariaPlasmodiumVivax,
        malariaTreatmentFailure, malariaPregnantWomenTested, malariaPregnantWomenPositive,
      };
    }

    if (profile === 'ncd_monthly') {
      const [
        hypertensionNewlyDiagnosed, hypertensionActiveInCare, hypertensionBpControlled,
        hypertensionOnTreatment, diabetesNewlyDiagnosed, diabetesActiveInCare,
        diabetesHba1cControlled, diabetesOnInsulin, ckdStage3to5, ckdOnRasBlockade,
        asthmaPatientsActive, asthmaUncontrolled, copdActiveInCare, strokeAdmissions, strokeThromboliticsGiven,
      ] = await Promise.all([
        this.safeMetricCount(tenantDb, 'htn_new',
          `SELECT COUNT(*)::int AS total FROM patient_diagnoses
           WHERE created_at >= $1 AND created_at < $2
             AND icd10_code LIKE 'I1%' AND status = 'active'`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'htn_active',
          `SELECT COUNT(DISTINCT patient_id)::int AS total FROM patient_diagnoses
           WHERE icd10_code LIKE 'I1%' AND status = 'active'`),
        this.safeMetricCount(tenantDb, 'htn_controlled',
          `SELECT COUNT(DISTINCT htnr.patient_id)::int AS total
           FROM hypertension_reviews htnr
           WHERE htnr.review_date >= $1 AND htnr.review_date < $2
             AND htnr.systolic_bp IS NOT NULL AND htnr.diastolic_bp IS NOT NULL
             AND htnr.systolic_bp < 140 AND htnr.diastolic_bp < 90`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'htn_on_treatment',
          `SELECT COUNT(DISTINCT patient_id)::int AS total FROM prescriptions
           WHERE created_at >= $1 AND created_at < $2
             AND LOWER(COALESCE(drug_class,'') || ' ' || COALESCE(medication_name,''))
               SIMILAR TO '%(antihypertensive|ace inhibitor|arb|beta.block|calcium channel|diuretic|amlodipine|losartan|enalapril|hydrochlorothiazide)%'`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'dm_new',
          `SELECT COUNT(*)::int AS total FROM patient_diagnoses
           WHERE created_at >= $1 AND created_at < $2
             AND icd10_code LIKE 'E1%' AND status = 'active'`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'dm_active',
          `SELECT COUNT(DISTINCT patient_id)::int AS total FROM patient_diagnoses
           WHERE icd10_code LIKE 'E1%' AND status = 'active'`),
        this.safeMetricCount(tenantDb, 'dm_hba1c',
          `SELECT COUNT(DISTINCT lr.patient_id)::int AS total FROM lab_results lr
           WHERE lr.resulted_at >= $1 AND lr.resulted_at < $2
             AND LOWER(COALESCE(lr.test_name,'')) LIKE '%hba1c%'
             AND CAST(NULLIF(REGEXP_REPLACE(lr.value_text,'[^0-9.]','','g'),'') AS numeric) < 7.0`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'dm_insulin',
          `SELECT COUNT(DISTINCT patient_id)::int AS total FROM prescriptions
           WHERE created_at >= $1 AND created_at < $2
             AND LOWER(COALESCE(medication_name,'')) LIKE '%insulin%'`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'ckd_stage3_5',
          `SELECT COUNT(DISTINCT patient_id)::int AS total FROM ckd_assessments
           WHERE assessed_at >= $1 AND assessed_at < $2
             AND ckd_stage >= 3`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'ckd_ras',
          `SELECT COUNT(DISTINCT patient_id)::int AS total FROM ckd_assessments
           WHERE assessed_at >= $1 AND assessed_at < $2
             AND on_ras_blockade = true`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'asthma_active',
          `SELECT COUNT(DISTINCT patient_id)::int AS total FROM asthma_records
           WHERE created_at >= $1 AND created_at < $2`),
        this.safeMetricCount(tenantDb, 'asthma_uncontrolled',
          `SELECT COUNT(DISTINCT patient_id)::int AS total FROM asthma_records
           WHERE created_at >= $1 AND created_at < $2
             AND LOWER(COALESCE(asthma_control,'')) IN ('uncontrolled','poorly controlled')`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'copd_active',
          `SELECT COUNT(DISTINCT patient_id)::int AS total FROM copd_assessments
           WHERE assessed_at >= $1 AND assessed_at < $2`),
        this.safeMetricCount(tenantDb, 'stroke_admissions',
          `SELECT COUNT(*)::int AS total FROM stroke_assessments
           WHERE created_at >= $1 AND created_at < $2`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'stroke_thrombolytics',
          `SELECT COUNT(*)::int AS total FROM stroke_assessments
           WHERE created_at >= $1 AND created_at < $2
             AND thrombolytic_given = true`,
          [startDate, endDate]),
      ]);
      return {
        hypertensionNewlyDiagnosed, hypertensionActiveInCare, hypertensionBpControlled,
        hypertensionOnTreatment, diabetesNewlyDiagnosed, diabetesActiveInCare,
        diabetesHba1cControlled, diabetesOnInsulin, ckdStage3to5, ckdOnRasBlockade,
        asthmaPatientsActive, asthmaUncontrolled, copdActiveInCare, strokeAdmissions, strokeThromboliticsGiven,
      };
    }

    if (profile === 'outpatient_morbidity') {
      const [
        totalOutpatientAttendances, totalNewAttendances, malariaCases,
        acuteRespiratoryInfection, diarrhoeaCases, skinDisease,
        eyeDisease, injuriesTrauma, hypertensionCases, diabetesCases,
        tbSuspected, stisUrogenital,
      ] = await Promise.all([
        this.safeMetricCount(tenantDb, 'opd_total',
          `SELECT COUNT(*)::int AS total FROM encounters
           WHERE COALESCE(encounter_date, created_at)::date >= $1
             AND COALESCE(encounter_date, created_at)::date < $2
             AND LOWER(COALESCE(encounter_type,'')) IN ('outpatient','opd','consultation')`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'opd_new',
          `SELECT COUNT(DISTINCT e.patient_id)::int AS total FROM encounters e
           WHERE COALESCE(e.encounter_date, e.created_at)::date >= $1
             AND COALESCE(e.encounter_date, e.created_at)::date < $2
             AND LOWER(COALESCE(e.encounter_type,'')) IN ('outpatient','opd','consultation')
             AND NOT EXISTS (
               SELECT 1 FROM encounters e2
               WHERE e2.patient_id = e.patient_id
                 AND COALESCE(e2.encounter_date, e2.created_at) < COALESCE(e.encounter_date, e.created_at)
             )`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'opd_malaria',
          `SELECT COUNT(*)::int AS total FROM patient_diagnoses pd
           JOIN encounters e ON e.id = pd.encounter_id
           WHERE COALESCE(e.encounter_date, e.created_at)::date >= $1
             AND COALESCE(e.encounter_date, e.created_at)::date < $2
             AND pd.icd10_code LIKE 'B5%'`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'opd_ari',
          `SELECT COUNT(*)::int AS total FROM patient_diagnoses pd
           JOIN encounters e ON e.id = pd.encounter_id
           WHERE COALESCE(e.encounter_date, e.created_at)::date >= $1
             AND COALESCE(e.encounter_date, e.created_at)::date < $2
             AND (pd.icd10_code LIKE 'J0%' OR pd.icd10_code LIKE 'J1%' OR pd.icd10_code LIKE 'J2%')`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'opd_diarrhoea',
          `SELECT COUNT(*)::int AS total FROM patient_diagnoses pd
           JOIN encounters e ON e.id = pd.encounter_id
           WHERE COALESCE(e.encounter_date, e.created_at)::date >= $1
             AND COALESCE(e.encounter_date, e.created_at)::date < $2
             AND (pd.icd10_code LIKE 'A0%' OR pd.icd10_code LIKE 'K58%' OR pd.icd10_code = 'K59.1')`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'opd_skin',
          `SELECT COUNT(*)::int AS total FROM patient_diagnoses pd
           JOIN encounters e ON e.id = pd.encounter_id
           WHERE COALESCE(e.encounter_date, e.created_at)::date >= $1
             AND COALESCE(e.encounter_date, e.created_at)::date < $2
             AND pd.icd10_code LIKE 'L%'`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'opd_eye',
          `SELECT COUNT(*)::int AS total FROM patient_diagnoses pd
           JOIN encounters e ON e.id = pd.encounter_id
           WHERE COALESCE(e.encounter_date, e.created_at)::date >= $1
             AND COALESCE(e.encounter_date, e.created_at)::date < $2
             AND pd.icd10_code LIKE 'H%'`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'opd_injury',
          `SELECT COUNT(*)::int AS total FROM patient_diagnoses pd
           JOIN encounters e ON e.id = pd.encounter_id
           WHERE COALESCE(e.encounter_date, e.created_at)::date >= $1
             AND COALESCE(e.encounter_date, e.created_at)::date < $2
             AND (pd.icd10_code LIKE 'S%' OR pd.icd10_code LIKE 'T%')`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'opd_htn',
          `SELECT COUNT(*)::int AS total FROM patient_diagnoses pd
           JOIN encounters e ON e.id = pd.encounter_id
           WHERE COALESCE(e.encounter_date, e.created_at)::date >= $1
             AND COALESCE(e.encounter_date, e.created_at)::date < $2
             AND pd.icd10_code LIKE 'I1%'`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'opd_dm',
          `SELECT COUNT(*)::int AS total FROM patient_diagnoses pd
           JOIN encounters e ON e.id = pd.encounter_id
           WHERE COALESCE(e.encounter_date, e.created_at)::date >= $1
             AND COALESCE(e.encounter_date, e.created_at)::date < $2
             AND pd.icd10_code LIKE 'E1%'`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'opd_tb_suspect',
          `SELECT COUNT(*)::int AS total FROM patient_diagnoses pd
           JOIN encounters e ON e.id = pd.encounter_id
           WHERE COALESCE(e.encounter_date, e.created_at)::date >= $1
             AND COALESCE(e.encounter_date, e.created_at)::date < $2
             AND (pd.icd10_code LIKE 'A1%' OR pd.icd10_code LIKE 'Z03.6%')`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'opd_sti',
          `SELECT COUNT(*)::int AS total FROM patient_diagnoses pd
           JOIN encounters e ON e.id = pd.encounter_id
           WHERE COALESCE(e.encounter_date, e.created_at)::date >= $1
             AND COALESCE(e.encounter_date, e.created_at)::date < $2
             AND (pd.icd10_code LIKE 'A5%' OR pd.icd10_code LIKE 'A6%' OR pd.icd10_code LIKE 'N74%')`,
          [startDate, endDate]),
      ]);
      return {
        totalOutpatientAttendances, totalNewAttendances, malariaCases,
        acuteRespiratoryInfection, diarrhoeaCases, skinDisease,
        eyeDisease, injuriesTrauma, hypertensionCases, diabetesCases,
        tbSuspected, stisUrogenital,
      };
    }

    if (profile === 'laboratory_monthly') {
      const [
        totalTestsOrdered, totalTestsCompleted, haematologyTests, biochemistryTests,
        microbiologyTests, criticalValuesReported, avgTurnaroundHours, specimenRejections,
        cd4CountTests, viralLoadTests, malariaRdtTests, sputumSmearTests,
      ] = await Promise.all([
        this.safeMetricCount(tenantDb, 'lab_ordered',
          `SELECT COUNT(*)::int AS total FROM lab_orders
           WHERE created_at >= $1 AND created_at < $2`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'lab_completed',
          `SELECT COUNT(*)::int AS total FROM lab_results
           WHERE resulted_at >= $1 AND resulted_at < $2`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'lab_haem',
          `SELECT COUNT(*)::int AS total FROM lab_results
           WHERE resulted_at >= $1 AND resulted_at < $2
             AND LOWER(COALESCE(category,'')) IN ('haematology','hematology','cbc')`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'lab_biochem',
          `SELECT COUNT(*)::int AS total FROM lab_results
           WHERE resulted_at >= $1 AND resulted_at < $2
             AND LOWER(COALESCE(category,'')) IN ('biochemistry','chemistry','metabolic')`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'lab_micro',
          `SELECT COUNT(*)::int AS total FROM lab_results
           WHERE resulted_at >= $1 AND resulted_at < $2
             AND LOWER(COALESCE(category,'')) IN ('microbiology','culture','sensitivity')`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'lab_critical',
          `SELECT COUNT(*)::int AS total FROM lab_results
           WHERE resulted_at >= $1 AND resulted_at < $2
             AND flag IN ('HH','LL','critical')`,
          [startDate, endDate]),
        this.safeMetricSum(tenantDb, 'lab_tat',
          `SELECT COALESCE(
             AVG(EXTRACT(EPOCH FROM (resulted_at - ordered_at))/3600)
           , 0)::numeric AS total
           FROM lab_results lr
           JOIN lab_orders lo ON lo.id = lr.order_id
           WHERE lr.resulted_at >= $1 AND lr.resulted_at < $2
             AND lo.created_at IS NOT NULL`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'lab_rejection',
          `SELECT COUNT(*)::int AS total FROM lab_orders
           WHERE created_at >= $1 AND created_at < $2
             AND LOWER(COALESCE(status,'')) = 'rejected'`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'lab_cd4',
          `SELECT COUNT(*)::int AS total FROM lab_results
           WHERE resulted_at >= $1 AND resulted_at < $2
             AND LOWER(COALESCE(test_name,'')) LIKE '%cd4%'`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'lab_vl',
          `SELECT COUNT(*)::int AS total FROM lab_results
           WHERE resulted_at >= $1 AND resulted_at < $2
             AND LOWER(COALESCE(test_name,'')) LIKE '%viral load%'`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'lab_malaria_rdt',
          `SELECT COUNT(*)::int AS total FROM lab_results
           WHERE resulted_at >= $1 AND resulted_at < $2
             AND LOWER(COALESCE(test_name,'')) LIKE '%malaria%rdt%'`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'lab_sputum',
          `SELECT COUNT(*)::int AS total FROM lab_results
           WHERE resulted_at >= $1 AND resulted_at < $2
             AND LOWER(COALESCE(test_name,'')) LIKE '%sputum%smear%'`,
          [startDate, endDate]),
      ]);
      return {
        totalTestsOrdered, totalTestsCompleted, haematologyTests, biochemistryTests,
        microbiologyTests, criticalValuesReported,
        avgTurnaroundHours: Math.round(avgTurnaroundHours * 10) / 10,
        specimenRejections, cd4CountTests, viralLoadTests, malariaRdtTests, sputumSmearTests,
      };
    }

    if (profile === 'mental_health_monthly') {
      const [
        totalScreened, depressionPositive, anxietyPositive, substanceUsePositive,
        newCarePlansCreated, activeInMentalHealthCare, psychiatricReferrals, suicideRiskHigh,
      ] = await Promise.all([
        this.safeMetricCount(tenantDb, 'mh_screened',
          `SELECT COUNT(*)::int AS total FROM mental_health_screenings
           WHERE screening_date >= $1 AND screening_date < $2`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'mh_depression',
          `SELECT COUNT(*)::int AS total FROM mental_health_screenings
           WHERE screening_date >= $1 AND screening_date < $2
             AND phq9_score IS NOT NULL AND phq9_score >= 10`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'mh_anxiety',
          `SELECT COUNT(*)::int AS total FROM mental_health_screenings
           WHERE screening_date >= $1 AND screening_date < $2
             AND gad7_score IS NOT NULL AND gad7_score >= 10`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'mh_substance',
          `SELECT COUNT(*)::int AS total FROM mental_health_screenings
           WHERE screening_date >= $1 AND screening_date < $2
             AND (audit_score >= 8 OR cage_score >= 2)`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'mh_care_plans',
          `SELECT COUNT(*)::int AS total FROM mental_health_care_plans
           WHERE created_at >= $1 AND created_at < $2`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'mh_active',
          `SELECT COUNT(DISTINCT patient_id)::int AS total FROM mental_health_care_plans
           WHERE LOWER(COALESCE(status,'')) = 'active'`),
        this.safeMetricCount(tenantDb, 'mh_referrals',
          `SELECT COUNT(*)::int AS total FROM mental_health_follow_ups
           WHERE follow_up_date >= $1 AND follow_up_date < $2
             AND LOWER(COALESCE(disposition,'')) LIKE '%refer%'`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'mh_suicide_high',
          `SELECT COUNT(*)::int AS total FROM mental_health_follow_ups
           WHERE follow_up_date >= $1 AND follow_up_date < $2
             AND LOWER(COALESCE(risk_tier,'')) IN ('high','critical')`,
          [startDate, endDate]),
      ]);
      return {
        totalScreened, depressionPositive, anxietyPositive, substanceUsePositive,
        newCarePlansCreated, activeInMentalHealthCare, psychiatricReferrals, suicideRiskHigh,
      };
    }

    if (profile === 'nutrition_monthly') {
      const [
        samAdmissions, mamAdmissions, samCured, samDied, samDefaulted, samNonResponsive,
        mamCured, muacRedAdmissions, muacYellowAdmissions, oedemaCases,
        rutfDispensedKg, therapeuticFeedingEnrolled,
      ] = await Promise.all([
        this.safeMetricCount(tenantDb, 'nut_sam',
          `SELECT COUNT(*)::int AS total FROM nutrition_assessments
           WHERE assessment_date >= $1 AND assessment_date < $2
             AND LOWER(COALESCE(acute_malnutrition_classification,'')) = 'sam'`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'nut_mam',
          `SELECT COUNT(*)::int AS total FROM nutrition_assessments
           WHERE assessment_date >= $1 AND assessment_date < $2
             AND LOWER(COALESCE(acute_malnutrition_classification,'')) = 'mam'`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'nut_sam_cured',
          `SELECT COUNT(*)::int AS total FROM nutrition_assessments
           WHERE assessment_date >= $1 AND assessment_date < $2
             AND LOWER(COALESCE(program_type,'')) IN ('imam','otp','sc')
             AND LOWER(COALESCE(discharge_outcome,'')) = 'cured'`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'nut_sam_died',
          `SELECT COUNT(*)::int AS total FROM nutrition_assessments
           WHERE assessment_date >= $1 AND assessment_date < $2
             AND LOWER(COALESCE(discharge_outcome,'')) = 'died'`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'nut_sam_default',
          `SELECT COUNT(*)::int AS total FROM nutrition_assessments
           WHERE assessment_date >= $1 AND assessment_date < $2
             AND LOWER(COALESCE(discharge_outcome,'')) IN ('defaulted','default','ltfu')`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'nut_non_resp',
          `SELECT COUNT(*)::int AS total FROM nutrition_assessments
           WHERE assessment_date >= $1 AND assessment_date < $2
             AND LOWER(COALESCE(discharge_outcome,'')) LIKE '%non%resp%'`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'nut_mam_cured',
          `SELECT COUNT(*)::int AS total FROM nutrition_assessments
           WHERE assessment_date >= $1 AND assessment_date < $2
             AND LOWER(COALESCE(program_type,'')) IN ('tsfp','sfp')
             AND LOWER(COALESCE(discharge_outcome,'')) = 'cured'`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'nut_muac_red',
          `SELECT COUNT(*)::int AS total FROM nutrition_assessments
           WHERE assessment_date >= $1 AND assessment_date < $2
             AND muac IS NOT NULL AND muac < 115`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'nut_muac_yellow',
          `SELECT COUNT(*)::int AS total FROM nutrition_assessments
           WHERE assessment_date >= $1 AND assessment_date < $2
             AND muac IS NOT NULL AND muac >= 115 AND muac < 125`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'nut_oedema',
          `SELECT COUNT(*)::int AS total FROM nutrition_assessments
           WHERE assessment_date >= $1 AND assessment_date < $2
             AND bilateral_pitting_oedema = true`,
          [startDate, endDate]),
        this.safeMetricSum(tenantDb, 'nut_rutf',
          `SELECT COALESCE(SUM(0), 0)::numeric AS total FROM nutrition_assessments
           WHERE assessment_date >= $1 AND assessment_date < $2`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'nut_tf',
          `SELECT COUNT(*)::int AS total FROM nutrition_assessments
           WHERE assessment_date >= $1 AND assessment_date < $2
             AND LOWER(COALESCE(program_type,'')) IN ('imam','tsfp','otp','sc','sfp')`,
          [startDate, endDate]),
      ]);
      return {
        samAdmissions, mamAdmissions, samCured, samDied, samDefaulted, samNonResponsive,
        mamCured, muacRedAdmissions, muacYellowAdmissions, oedemaCases,
        rutfDispensedKg, therapeuticFeedingEnrolled,
      };
    }

    if (profile === 'icu_monthly') {
      const [
        icuAdmissions, icuDeaths, icuAvgLosHours, icuApacheHigh,
        icuVentilatorDays, icuReadmissions, sepsisCases, icuCardiacArrest,
      ] = await Promise.all([
        this.safeMetricCount(tenantDb, 'icu_admissions',
          `SELECT COUNT(*)::int AS total FROM icu_admissions
           WHERE admission_date >= $1 AND admission_date < $2`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'icu_deaths',
          `SELECT COUNT(*)::int AS total FROM icu_admissions
           WHERE admission_date >= $1 AND admission_date < $2
             AND LOWER(COALESCE(discharge_reason,'')) IN ('died','death','expired')`,
          [startDate, endDate]),
        this.safeMetricSum(tenantDb, 'icu_los',
          `SELECT COALESCE(AVG(
             EXTRACT(EPOCH FROM (COALESCE(discharge_date, NOW()) - admission_date))/3600
           ), 0)::numeric AS total
           FROM icu_admissions
           WHERE admission_date >= $1 AND admission_date < $2`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'icu_apache_high',
          `SELECT COUNT(*)::int AS total FROM icu_admissions
           WHERE admission_date >= $1 AND admission_date < $2
             AND apache_ii_score IS NOT NULL AND apache_ii_score >= 25`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'icu_vent',
          `SELECT COALESCE(SUM(
             EXTRACT(DAY FROM (COALESCE(discharge_date, NOW()) - admission_date))
           ), 0)::int AS total
           FROM icu_admissions
           WHERE admission_date >= $1 AND admission_date < $2
             AND intubated = true`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'icu_readmit',
          `SELECT COUNT(*)::int AS total FROM icu_admissions ia
           WHERE ia.admission_date >= $1 AND ia.admission_date < $2
             AND EXISTS (
               SELECT 1 FROM icu_admissions ia2
               WHERE ia2.patient_id = ia.patient_id
                 AND ia2.admission_date < ia.admission_date
                 AND ia2.discharge_date > ia.admission_date - INTERVAL '30 days'
             )`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'icu_sepsis',
          `SELECT COUNT(*)::int AS total FROM icu_admissions
           WHERE admission_date >= $1 AND admission_date < $2
             AND LOWER(COALESCE(primary_diagnosis,'')) LIKE '%sepsis%'`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'icu_arrest',
          `SELECT COUNT(*)::int AS total FROM icu_admissions
           WHERE admission_date >= $1 AND admission_date < $2
             AND LOWER(COALESCE(primary_diagnosis,'')) LIKE '%cardiac arrest%'`,
          [startDate, endDate]),
      ]);
      return {
        icuAdmissions, icuDeaths,
        icuAvgLosHours: Math.round(icuAvgLosHours * 10) / 10,
        icuApacheHigh, icuVentilatorDays, icuReadmissions, sepsisCases, icuCardiacArrest,
      };
    }

    if (profile === 'hai_monthly') {
      const [
        totalHaiCases, ssiCases, cautCases, clabsiCases, vapCases,
        mrsaIsolates, esblIsolates, cdifficileCases, haiDeaths,
      ] = await Promise.all([
        this.safeMetricCount(tenantDb, 'hai_total',
          `SELECT COUNT(*)::int AS total FROM healthcare_associated_infections
           WHERE onset_date >= $1 AND onset_date < $2`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'hai_ssi',
          `SELECT COUNT(*)::int AS total FROM healthcare_associated_infections
           WHERE onset_date >= $1 AND onset_date < $2
             AND LOWER(COALESCE(infection_site,'')) IN ('ssi','surgical site','wound')`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'hai_cauti',
          `SELECT COUNT(*)::int AS total FROM healthcare_associated_infections
           WHERE onset_date >= $1 AND onset_date < $2
             AND LOWER(COALESCE(infection_site,'')) IN ('cauti','urinary','catheter')`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'hai_clabsi',
          `SELECT COUNT(*)::int AS total FROM healthcare_associated_infections
           WHERE onset_date >= $1 AND onset_date < $2
             AND LOWER(COALESCE(infection_site,'')) IN ('clabsi','bloodstream','bsi','central line')`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'hai_vap',
          `SELECT COUNT(*)::int AS total FROM healthcare_associated_infections
           WHERE onset_date >= $1 AND onset_date < $2
             AND LOWER(COALESCE(infection_site,'')) IN ('vap','ventilator','pneumonia')`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'hai_mrsa',
          `SELECT COUNT(*)::int AS total FROM healthcare_associated_infections
           WHERE onset_date >= $1 AND onset_date < $2
             AND LOWER(COALESCE(organism,'')) LIKE '%mrsa%'`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'hai_esbl',
          `SELECT COUNT(*)::int AS total FROM healthcare_associated_infections
           WHERE onset_date >= $1 AND onset_date < $2
             AND LOWER(COALESCE(antibiotic_resistance_profile,'')) LIKE '%esbl%'`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'hai_cdiff',
          `SELECT COUNT(*)::int AS total FROM healthcare_associated_infections
           WHERE onset_date >= $1 AND onset_date < $2
             AND LOWER(COALESCE(organism,'')) LIKE '%difficile%'`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'hai_deaths',
          `SELECT COUNT(*)::int AS total FROM healthcare_associated_infections
           WHERE onset_date >= $1 AND onset_date < $2
             AND LOWER(COALESCE(outcome,'')) IN ('died','death')`,
          [startDate, endDate]),
      ]);
      return {
        totalHaiCases, ssiCases, cautCases, clabsiCases, vapCases,
        mrsaIsolates, esblIsolates, cdifficileCases, haiDeaths,
      };
    }

    if (profile === 'surgical_monthly') {
      const [
        totalSurgicalCases, electiveCases, emergencyCases, caesareanSections,
        majorSurgicalComplications, surgicalMortality, cancelledCases,
        avgOperativeTimeMinutes, bloodTransfusionsIntraop,
      ] = await Promise.all([
        this.safeMetricCount(tenantDb, 'surg_total',
          `SELECT COUNT(*)::int AS total FROM surgical_cases
           WHERE scheduled_date >= $1 AND scheduled_date < $2`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'surg_elective',
          `SELECT COUNT(*)::int AS total FROM surgical_cases
           WHERE scheduled_date >= $1 AND scheduled_date < $2
             AND LOWER(COALESCE(case_priority,'')) IN ('elective','routine')`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'surg_emergency',
          `SELECT COUNT(*)::int AS total FROM surgical_cases
           WHERE scheduled_date >= $1 AND scheduled_date < $2
             AND LOWER(COALESCE(case_priority,'')) IN ('emergency','urgent','emergent')`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'surg_csection',
          `SELECT COUNT(*)::int AS total FROM surgical_cases
           WHERE scheduled_date >= $1 AND scheduled_date < $2
             AND (LOWER(COALESCE(procedure_name,'')) LIKE '%caesarean%'
               OR LOWER(COALESCE(procedure_name,'')) LIKE '%c-section%'
               OR LOWER(COALESCE(procedure_name,'')) LIKE '%c section%')`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'surg_complications',
          `SELECT COUNT(*)::int AS total FROM surgical_cases
           WHERE scheduled_date >= $1 AND scheduled_date < $2
             AND complications IS NOT NULL AND complications != '' AND complications != 'none'`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'surg_mortality',
          `SELECT COUNT(*)::int AS total FROM surgical_cases
           WHERE scheduled_date >= $1 AND scheduled_date < $2
             AND LOWER(COALESCE(post_op_diagnosis,'')) LIKE '%died%'`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'surg_cancelled',
          `SELECT COUNT(*)::int AS total FROM surgical_cases
           WHERE scheduled_date >= $1 AND scheduled_date < $2
             AND LOWER(COALESCE(status,'')) IN ('cancelled','canceled')`,
          [startDate, endDate]),
        this.safeMetricSum(tenantDb, 'surg_op_time',
          `SELECT COALESCE(AVG(
             EXTRACT(EPOCH FROM (actual_end_time - actual_start_time))/60
           ), 0)::numeric AS total
           FROM surgical_cases
           WHERE scheduled_date >= $1 AND scheduled_date < $2
             AND actual_start_time IS NOT NULL AND actual_end_time IS NOT NULL`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'surg_transfusions',
          `SELECT COUNT(*)::int AS total FROM surgical_cases
           WHERE scheduled_date >= $1 AND scheduled_date < $2
             AND blood_products IS NOT NULL AND blood_products != ''`,
          [startDate, endDate]),
      ]);
      return {
        totalSurgicalCases, electiveCases, emergencyCases, caesareanSections,
        majorSurgicalComplications, surgicalMortality, cancelledCases,
        avgOperativeTimeMinutes: Math.round(avgOperativeTimeMinutes),
        bloodTransfusionsIntraop,
      };
    }

    if (profile === 'cervical_cancer_monthly') {
      const [
        womenScreened, viaPositive, papPositive, hpvPositive,
        cryotherapyPerformed, leepPerformed, referredForColposcopy, confirmedCancerCases,
      ] = await Promise.all([
        this.safeMetricCount(tenantDb, 'cx_screened',
          `SELECT COUNT(*)::int AS total FROM cervical_screenings
           WHERE screening_date >= $1 AND screening_date < $2`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'cx_via_pos',
          `SELECT COUNT(*)::int AS total FROM cervical_screenings
           WHERE screening_date >= $1 AND screening_date < $2
             AND LOWER(COALESCE(screening_type,'')) LIKE '%via%'
             AND LOWER(COALESCE(result,'')) IN ('positive','pos','acetowhite','abnormal')`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'cx_pap_pos',
          `SELECT COUNT(*)::int AS total FROM cervical_screenings
           WHERE screening_date >= $1 AND screening_date < $2
             AND LOWER(COALESCE(screening_type,'')) LIKE '%pap%'
             AND LOWER(COALESCE(result,'')) NOT IN ('normal','negative','nilm')`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'cx_hpv_pos',
          `SELECT COUNT(*)::int AS total FROM cervical_screenings
           WHERE screening_date >= $1 AND screening_date < $2
             AND LOWER(COALESCE(screening_type,'')) LIKE '%hpv%'
             AND LOWER(COALESCE(result,'')) IN ('positive','detected')`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'cx_cryo',
          `SELECT COUNT(*)::int AS total FROM cervical_screenings
           WHERE screening_date >= $1 AND screening_date < $2
             AND LOWER(COALESCE(treatment_method,'')) LIKE '%cryotherapy%'`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'cx_leep',
          `SELECT COUNT(*)::int AS total FROM cervical_screenings
           WHERE screening_date >= $1 AND screening_date < $2
             AND LOWER(COALESCE(treatment_method,'')) IN ('leep','lletz')`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'cx_colpo_ref',
          `SELECT COUNT(*)::int AS total FROM cervical_screenings
           WHERE screening_date >= $1 AND screening_date < $2
             AND LOWER(COALESCE(referral_type,'')) LIKE '%colposcopy%'`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'cx_cancer',
          `SELECT COUNT(*)::int AS total FROM cervical_screenings
           WHERE screening_date >= $1 AND screening_date < $2
             AND LOWER(COALESCE(result,'')) LIKE '%cancer%'`,
          [startDate, endDate]),
      ]);
      return {
        womenScreened, viaPositive, papPositive, hpvPositive,
        cryotherapyPerformed, leepPerformed, referredForColposcopy, confirmedCancerCases,
      };
    }

    if (profile === 'neonatal_monthly') {
      const [
        liveBirthsTotal, stillbirthsTotal, lowBirthWeightCount, veryLowBirthWeightCount,
        pretermBirths, apgar5MinUnder7, neonatalResuscitation, scbuAdmissions,
        neonatalDeaths, hivExposedInfants, arvProphylaxisGiven,
      ] = await Promise.all([
        this.safeMetricCount(tenantDb, 'neo_live',
          `SELECT COUNT(*)::int AS total FROM neonatal_records
           WHERE created_at >= $1 AND created_at < $2
             AND LOWER(COALESCE(discharge_status,'')) != 'stillbirth'`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'neo_still',
          `SELECT COUNT(*)::int AS total FROM neonatal_records
           WHERE created_at >= $1 AND created_at < $2
             AND LOWER(COALESCE(discharge_status,'')) = 'stillbirth'`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'neo_lbw',
          `SELECT COUNT(*)::int AS total FROM neonatal_records
           WHERE created_at >= $1 AND created_at < $2
             AND birth_weight IS NOT NULL AND birth_weight > 0 AND birth_weight < 2500`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'neo_vlbw',
          `SELECT COUNT(*)::int AS total FROM neonatal_records
           WHERE created_at >= $1 AND created_at < $2
             AND birth_weight IS NOT NULL AND birth_weight > 0 AND birth_weight < 1500`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'neo_preterm',
          `SELECT COUNT(*)::int AS total FROM neonatal_records
           WHERE created_at >= $1 AND created_at < $2
             AND gestational_age IS NOT NULL AND gestational_age < 37`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'neo_apgar_low',
          `SELECT COUNT(*)::int AS total FROM neonatal_records
           WHERE created_at >= $1 AND created_at < $2
             AND apgar_5min IS NOT NULL AND apgar_5min < 7`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'neo_resus',
          `SELECT COUNT(*)::int AS total FROM neonatal_records
           WHERE created_at >= $1 AND created_at < $2
             AND resuscitation_performed = true`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'neo_scbu',
          `SELECT COUNT(*)::int AS total FROM neonatal_records
           WHERE created_at >= $1 AND created_at < $2
             AND scbu_admission = true`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'neo_deaths',
          `SELECT COUNT(*)::int AS total FROM neonatal_records
           WHERE created_at >= $1 AND created_at < $2
             AND LOWER(COALESCE(discharge_status,'')) IN ('died','death','neonatal death')`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'neo_hiv_exposed',
          `SELECT COUNT(*)::int AS total FROM neonatal_records
           WHERE created_at >= $1 AND created_at < $2
             AND hiv_exposure_status = 'exposed'`,
          [startDate, endDate]),
        this.safeMetricCount(tenantDb, 'neo_arv',
          `SELECT COUNT(*)::int AS total FROM neonatal_records
           WHERE created_at >= $1 AND created_at < $2
             AND arvs_given = true`,
          [startDate, endDate]),
      ]);
      return {
        liveBirthsTotal, stillbirthsTotal, lowBirthWeightCount, veryLowBirthWeightCount,
        pretermBirths, apgar5MinUnder7, neonatalResuscitation, scbuAdmissions,
        neonatalDeaths, hivExposedInfants, arvProphylaxisGiven,
      };
    }

    return {};
  }

  private async getProgramType(context: Dhis2Context, programId: string): Promise<string | null> {
    if (!context.client) {
      return null;
    }

    try {
      const response = await context.client.get(`/programs/${programId}`, {
        params: {
          fields: 'id,programType',
        },
      });
      return response.data?.programType || null;
    } catch (error: any) {
      this.logger.warn(`Unable to resolve DHIS2 program type for ${programId}: ${error?.message || error}`);
      return null;
    }
  }

  private async getExistingEnrollment(
    context: Dhis2Context,
    programId: string,
    teiId: string,
  ): Promise<string | null> {
    if (!context.client) {
      return null;
    }

    try {
      const response = await context.client.get('/enrollments', {
        params: {
          program: programId,
          trackedEntityInstance: teiId,
          paging: false,
          fields: 'enrollments[enrollment,status]',
        },
      });
      const enrollments: Dhis2EnrollmentRow[] = response.data?.enrollments || [];
      if (!Array.isArray(enrollments) || enrollments.length === 0) {
        return null;
      }
      return enrollments[0]?.enrollment || null;
    } catch (error: any) {
      this.logger.warn(
        `Unable to lookup DHIS2 enrollment for program ${programId} and TEI ${teiId}: ${error?.message || error}`,
      );
      return null;
    }
  }

  private async ensureEnrollmentForEvent(
    context: Dhis2Context,
    args: {
      programId: string;
      teiId: string;
      orgUnit: string;
      eventDate?: string;
    },
  ): Promise<string | null> {
    const programType = await this.getProgramType(context, args.programId);
    if (!programType || programType !== 'WITH_REGISTRATION') {
      return null;
    }

    const existingEnrollment = await this.getExistingEnrollment(context, args.programId, args.teiId);
    if (existingEnrollment) {
      return existingEnrollment;
    }

    if (!context.client) {
      return null;
    }

    const dateOnly = this.formatDateOnly(args.eventDate || new Date().toISOString());
    const payload = {
      trackedEntityInstance: args.teiId,
      program: args.programId,
      orgUnit: args.orgUnit,
      enrollmentDate: dateOnly,
      incidentDate: dateOnly,
      status: 'ACTIVE',
    };

    const response = await context.client.post('/enrollments', payload);
    return this.extractImportReference(response.data);
  }

  private async upsertPatientMapping(
    tenantDb: DataSource,
    patientId: string,
    teiId: string,
    orgUnitId?: string,
    tenantId?: string,
  ): Promise<void> {
    await tenantDb.query(
      `
      INSERT INTO dhis2_patient_mappings (
        patient_id,
        dhis2_tei_id,
        org_unit_id,
        tenant_identifier,
        last_synced_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      ON CONFLICT (patient_id)
      DO UPDATE SET
        dhis2_tei_id = EXCLUDED.dhis2_tei_id,
        org_unit_id = EXCLUDED.org_unit_id,
        tenant_identifier = EXCLUDED.tenant_identifier,
        last_synced_at = NOW(),
        updated_at = NOW()
      `,
      [patientId, teiId, orgUnitId || null, tenantId || null],
    );
  }

  private async insertSyncLog(
    tenantDb: DataSource,
    args: {
      entityType: string;
      entityId?: string | null;
      dhis2Id?: string | null;
      action: 'create' | 'update' | 'upsert' | 'skip' | 'error';
      status: 'success' | 'error' | 'skipped';
      errorMessage?: string | null;
      payload?: Record<string, any>;
    },
  ): Promise<void> {
    await tenantDb.query(
      `
      INSERT INTO dhis2_sync_log (
        entity_type,
        entity_id,
        dhis2_id,
        action,
        status,
        error_message,
        payload,
        synced_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())
      `,
      [
        args.entityType,
        args.entityId || null,
        args.dhis2Id || null,
        args.action,
        args.status,
        args.errorMessage || null,
        JSON.stringify(args.payload || {}),
      ],
    );
  }

  async getSyncLog(
    tenantDb: DataSource,
    filters?: {
      entityType?: string;
      status?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    await this.ensureTenantSyncTables(tenantDb);

    const limit = Math.min(Math.max(Number(filters?.limit || 50), 1), 500);
    const offset = Math.max(Number(filters?.offset || 0), 0);

    const params: any[] = [];
    const whereClauses: string[] = [];

    if (filters?.entityType) {
      params.push(filters.entityType);
      whereClauses.push(`entity_type = $${params.length}`);
    }

    if (filters?.status) {
      params.push(filters.status);
      whereClauses.push(`status = $${params.length}`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRows: Array<{ total: number | string }> = await tenantDb.query(
      `
      SELECT COUNT(*)::int AS total
      FROM dhis2_sync_log
      ${whereSql}
      `,
      params,
    );

    const pagedRows: Dhis2SyncLogRow[] = await tenantDb.query(
      `
      SELECT
        id,
        entity_type,
        entity_id,
        dhis2_id,
        action,
        status,
        error_message,
        payload,
        synced_at
      FROM dhis2_sync_log
      ${whereSql}
      ORDER BY synced_at DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
      `,
      [...params, limit, offset],
    );

    const summaryRows: Array<{ entity_type: string; status: string; count: number | string }> = await tenantDb.query(
      `
      SELECT entity_type, status, COUNT(*)::int AS count
      FROM dhis2_sync_log
      GROUP BY entity_type, status
      ORDER BY entity_type, status
      `,
    );

    return {
      total: Number(countRows?.[0]?.total || 0),
      limit,
      offset,
      logs: pagedRows,
      summary: summaryRows.map((row) => ({
        entityType: row.entity_type,
        status: row.status,
        count: Number(row.count || 0),
      })),
    };
  }

  async retryFailedSync(
    tenantDb: DataSource,
    tenantId: string | undefined,
    options?: {
      entityType?: string;
      limit?: number;
      dryRun?: boolean;
    },
  ) {
    await this.ensureTenantSyncTables(tenantDb);

    const limit = Math.min(Math.max(Number(options?.limit || 25), 1), 200);
    const dryRun = Boolean(options?.dryRun);
    const params: any[] = ['error'];
    const whereClauses: string[] = [`status = $1`];

    if (options?.entityType) {
      params.push(options.entityType);
      whereClauses.push(`entity_type = $${params.length}`);
    }

    const rows: Dhis2SyncLogRow[] = await tenantDb.query(
      `
      SELECT
        id,
        entity_type,
        entity_id,
        action,
        status,
        error_message,
        payload,
        synced_at
      FROM dhis2_sync_log
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY synced_at DESC
      LIMIT $${params.length + 1}
      `,
      [...params, limit],
    );

    const retryCandidates = rows.reverse();
    let attempted = 0;
    let succeeded = 0;
    let failed = 0;
    let skipped = 0;
    let patientSyncTriggered = false;
    const results: Array<{ logId: string; entityType: string; status: string; message: string }> = [];

    for (const row of retryCandidates) {
      const payload = (row.payload || {}) as Record<string, any>;
      const requestPayload = payload.request;
      const entityType = row.entity_type;
      const retryDecision = this.getRetryDecision(row);

      if (entityType !== 'patient' && !retryDecision.retryable) {
        await this.markSyncLogSkipped(tenantDb, row.id, retryDecision.reason);
        skipped += 1;
        results.push({
          logId: row.id,
          entityType,
          status: 'skipped',
          message: retryDecision.reason,
        });
        continue;
      }

      if (entityType === 'patient') {
        if (patientSyncTriggered) {
          await this.markSyncLogSkipped(tenantDb, row.id, 'Patient retry already triggered once in this batch.');
          skipped += 1;
          results.push({
            logId: row.id,
            entityType,
            status: 'skipped',
            message: 'Patient retry already triggered once in this batch.',
          });
          continue;
        }

        attempted += 1;
        patientSyncTriggered = true;

        if (dryRun) {
          succeeded += 1;
          results.push({
            logId: row.id,
            entityType,
            status: 'dry_run',
            message: 'Would run patient sync retry.',
          });
          continue;
        }

        const retryResult = await this.syncPatients(tenantDb, tenantId);
        const ok = retryResult.status === 'SUCCESS' || retryResult.status === 'PARTIAL_SUCCESS';
        if (ok) {
          await this.markSyncLogSkipped(tenantDb, row.id, 'Superseded by bulk patient sync retry.');
          succeeded += 1;
        } else {
          failed += 1;
        }
        results.push({
          logId: row.id,
          entityType,
          status: ok ? 'success' : 'error',
          message: retryResult.message || 'Patient retry completed.',
        });
        continue;
      }

      if (!requestPayload || typeof requestPayload !== 'object') {
        await this.markSyncLogSkipped(tenantDb, row.id, 'No request payload found in sync log; cannot replay automatically.');
        skipped += 1;
        results.push({
          logId: row.id,
          entityType,
          status: 'skipped',
          message: 'No request payload found in sync log; cannot replay automatically.',
        });
        continue;
      }

      attempted += 1;

      if (dryRun) {
        succeeded += 1;
        results.push({
          logId: row.id,
          entityType,
          status: 'dry_run',
          message: 'Would retry this payload.',
        });
        continue;
      }

      if (entityType === 'event') {
        const retryResult = await this.sendEvent(requestPayload, tenantDb, tenantId);
        const ok = retryResult.status === 'SUCCESS';
        if (ok) {
          succeeded += 1;
        } else {
          failed += 1;
        }
        results.push({
          logId: row.id,
          entityType,
          status: ok ? 'success' : 'error',
          message: retryResult.message || 'Event retry completed.',
        });
        continue;
      }

      if (entityType === 'aggregate') {
        const retryResult = await this.sendAggregateReport(requestPayload, tenantDb, tenantId);
        const ok = retryResult.status === 'SUCCESS' || retryResult.status === 'OK';
        if (ok) {
          succeeded += 1;
        } else {
          failed += 1;
        }
        results.push({
          logId: row.id,
          entityType,
          status: ok ? 'success' : 'error',
          message: retryResult.message || 'Aggregate retry completed.',
        });
        continue;
      }

      if (entityType === 'data_value_set') {
        const retryResult = await this.sendDataValues(requestPayload, tenantDb, tenantId);
        const ok = retryResult.status === 'SUCCESS' || retryResult.status === 'OK';
        if (ok) {
          succeeded += 1;
        } else {
          failed += 1;
        }
        results.push({
          logId: row.id,
          entityType,
          status: ok ? 'success' : 'error',
          message: retryResult.message || 'Data value retry completed.',
        });
        continue;
      }

      skipped += 1;
      await this.markSyncLogSkipped(tenantDb, row.id, `Entity type ${entityType} does not support automatic retry yet.`);
      results.push({
        logId: row.id,
        entityType,
        status: 'skipped',
        message: `Entity type ${entityType} does not support automatic retry yet.`,
      });
    }

    return {
      dryRun,
      requestedLimit: limit,
      found: retryCandidates.length,
      attempted,
      succeeded,
      failed,
      skipped,
      results,
    };
  }

  private getRetryDecision(row: Dhis2SyncLogRow): { retryable: boolean; reason: string } {
    const payload = (row.payload || {}) as Record<string, any>;
    const rawStatusCode =
      payload?.response?.httpStatusCode ??
      payload?.response?.statusCode ??
      payload?.httpStatusCode;
    const statusCode = Number(rawStatusCode);

    if (
      Number.isFinite(statusCode) &&
      statusCode >= 400 &&
      statusCode < 500 &&
      statusCode !== 408 &&
      statusCode !== 429
    ) {
      return {
        retryable: false,
        reason: `Non-retryable DHIS2 client error (${statusCode}).`,
      };
    }

    const importDescription = String(
      payload?.response?.response?.importSummaries?.[0]?.description || '',
    ).toLowerCase();
    if (importDescription.includes('does not point to a valid')) {
      return {
        retryable: false,
        reason: 'Non-retryable DHIS2 validation failure in import summary.',
      };
    }

    return {
      retryable: true,
      reason: 'Retryable.',
    };
  }

  private async markSyncLogSkipped(tenantDb: DataSource, logId: string, reason: string): Promise<void> {
    await tenantDb.query(
      `
      UPDATE dhis2_sync_log
      SET
        status = 'skipped',
        action = 'skip',
        error_message = $2,
        synced_at = NOW()
      WHERE id = $1
      `,
      [logId, reason],
    );
  }

  async getRecentErrorCount(tenantDb: DataSource, lookbackHours = 24): Promise<number> {
    await this.ensureTenantSyncTables(tenantDb);
    const normalizedHours = Math.min(Math.max(Number(lookbackHours || 24), 1), 720);
    const rows: Array<{ total: number | string }> = await tenantDb.query(
      `
      SELECT COUNT(*)::int AS total
      FROM dhis2_sync_log
      WHERE status = 'error'
        AND synced_at >= NOW() - ($1 * INTERVAL '1 hour')
      `,
      [normalizedHours],
    );
    return Number(rows?.[0]?.total || 0);
  }

  async syncPatients(tenantDb: DataSource, tenantId?: string) {
    try {
      const patientRepository = tenantDb.getRepository(Patient);
      const patients = await patientRepository.find({ where: { isActive: true } });
      const context = await this.resolveContext(tenantId);

      if (!context.enabled) {
        return {
          status: 'NOT_CONFIGURED',
          imported: 0,
          updated: 0,
          ignored: 0,
          deleted: 0,
          message: context.reason || 'DHIS2 is not configured for this tenant.',
        };
      }

      if (context.useMock || !context.client || !context.config) {
        this.logger.warn(`DHIS2 sync running in MOCK mode (${context.reason || 'fallback'})`);
        return {
          status: 'SUCCESS',
          imported: patients.length,
          updated: 0,
          ignored: 0,
          deleted: 0,
          message: `[MOCK] Successfully synced ${patients.length} patients to DHIS2`,
        };
      }

      const trackedEntityType =
        context.config.trackedEntityTypeId || this.envTrackedEntityType || 'MCPQUTHX1Ze';
      const orgUnit = context.config.orgUnitId || this.envOrgUnit || 'YOUR_ORG_UNIT_ID';
      const patientAttributeIds = await this.resolvePatientAttributeIds(context);
      await this.ensureTenantSyncTables(tenantDb);
      const existingMappings = await this.loadPatientMappings(tenantDb);

      let created = 0;
      let updated = 0;
      let failed = 0;
      let skipped = 0;

      for (const patient of patients) {
        const existingTeiId = existingMappings.get(patient.id);
        const payload = {
          trackedEntityType,
          orgUnit,
          attributes: this.buildPatientAttributes(patient, patientAttributeIds),
        };

        try {
          if (existingTeiId) {
            try {
              await context.client.put(`/trackedEntityInstances/${existingTeiId}`, payload);
              updated += 1;
              await this.upsertPatientMapping(tenantDb, patient.id, existingTeiId, orgUnit, tenantId);
              await this.insertSyncLog(tenantDb, {
                entityType: 'patient',
                entityId: patient.id,
                dhis2Id: existingTeiId,
                action: 'update',
                status: 'success',
                payload: { patientId: patient.id, orgUnit },
              });
              continue;
            } catch (updateError: any) {
              if (!this.isNotFoundError(updateError)) {
                throw updateError;
              }
              this.logger.warn(
                `Mapped TEI not found in DHIS2 for patient ${patient.id}; re-creating record.`,
              );
            }
          }

          const createResponse = await context.client.post('/trackedEntityInstances', {
            trackedEntityInstances: [payload],
          });
          const createdTeiId = this.extractTeiId(createResponse.data);
          if (!createdTeiId) {
            skipped += 1;
            await this.insertSyncLog(tenantDb, {
              entityType: 'patient',
              entityId: patient.id,
              dhis2Id: null,
              action: 'skip',
              status: 'skipped',
              errorMessage: 'TEI ID not returned by DHIS2 create response',
              payload: { patientId: patient.id, orgUnit, response: createResponse.data || null },
            });
            continue;
          }

          await this.upsertPatientMapping(tenantDb, patient.id, createdTeiId, orgUnit, tenantId);
          created += 1;
          await this.insertSyncLog(tenantDb, {
            entityType: 'patient',
            entityId: patient.id,
            dhis2Id: createdTeiId,
            action: 'create',
            status: 'success',
            payload: { patientId: patient.id, orgUnit },
          });
        } catch (patientError: any) {
          failed += 1;
          await this.insertSyncLog(tenantDb, {
            entityType: 'patient',
            entityId: patient.id,
            dhis2Id: existingTeiId || null,
            action: 'error',
            status: 'error',
            errorMessage: patientError?.message || 'Patient sync failed',
            payload: {
              patientId: patient.id,
              orgUnit,
              response: patientError?.response?.data || null,
            },
          });
        }
      }

      return {
        status: failed > 0 ? 'PARTIAL_SUCCESS' : 'SUCCESS',
        imported: created,
        updated,
        ignored: skipped,
        deleted: 0,
        failed,
        message: `Patient sync complete. Created ${created}, updated ${updated}, skipped ${skipped}, failed ${failed}.`,
      };
    } catch (error: any) {
      this.logger.error('Error syncing patients to DHIS2:', error);
      return {
        status: 'ERROR',
        imported: 0,
        updated: 0,
        ignored: 0,
        deleted: 0,
        message: `DHIS2 sync failed: ${error.message}`,
        error: error.response?.data || error.message,
      };
    }
  }

  async sendEvent(eventData: any, tenantDb: DataSource, tenantId?: string) {
    try {
      const context = await this.resolveContext(tenantId);

      if (!context.enabled) {
        return {
          status: 'NOT_CONFIGURED',
          reference: `EVENT_${Date.now()}`,
          message: context.reason || 'DHIS2 is not configured for this tenant.',
        };
      }

      if (context.useMock || !context.client || !context.config) {
        this.logger.warn(`DHIS2 sendEvent running in MOCK mode (${context.reason || 'fallback'})`);
        return {
          status: 'SUCCESS',
          reference: `EVENT_${Date.now()}`,
          message: '[MOCK] Event sent to DHIS2 successfully',
        };
      }

      let trackedEntityInstance: string | undefined =
        eventData.trackedEntityInstance || eventData.teiId || undefined;

      if (!trackedEntityInstance && eventData.patientId && this.canQueryTenantDb(tenantDb)) {
        await this.ensureTenantSyncTables(tenantDb);
        trackedEntityInstance = await this.loadPatientTeiMapping(tenantDb, eventData.patientId);
      }

      if (!trackedEntityInstance && eventData.patientId) {
        if (this.canQueryTenantDb(tenantDb)) {
          await this.ensureTenantSyncTables(tenantDb);
          await this.insertSyncLog(tenantDb, {
            entityType: 'event',
            entityId: this.asNullableUuid(eventData.patientId),
            dhis2Id: null,
            action: 'error',
            status: 'error',
            errorMessage: `Missing TEI mapping for patient ${eventData.patientId}`,
            payload: {
              program: eventData.program || null,
              programStage: eventData.programStage || null,
              patientId: eventData.patientId,
              request: eventData || null,
            },
          });
        }
        return {
          status: 'ERROR',
          reference: `EVENT_${Date.now()}`,
          message: `No DHIS2 TEI mapping found for patient ${eventData.patientId}. Run patient sync first.`,
        };
      }

      const dhis2Event = {
        program: eventData.program,
        programStage: eventData.programStage,
        orgUnit: eventData.orgUnit || context.config.orgUnitId || this.envOrgUnit,
        eventDate: eventData.eventDate
          ? this.formatDateOnly(eventData.eventDate)
          : new Date().toISOString().slice(0, 10),
        status: 'COMPLETED',
        trackedEntityInstance,
        dataValues: eventData.dataValues || [],
      };

      const enrollmentId =
        eventData.enrollment ||
        await this.ensureEnrollmentForEvent(context, {
          programId: String(eventData.program),
          teiId: String(trackedEntityInstance),
          orgUnit: String(dhis2Event.orgUnit || ''),
          eventDate: eventData.eventDate,
        });

      if (enrollmentId) {
        (dhis2Event as any).enrollment = enrollmentId;
      }

      const response = await context.client.post('/events', dhis2Event);
      const reference = this.extractImportReference(response.data) || `EVENT_${Date.now()}`;

      if (this.canQueryTenantDb(tenantDb)) {
        await this.ensureTenantSyncTables(tenantDb);
        await this.insertSyncLog(tenantDb, {
          entityType: 'event',
          entityId: this.asNullableUuid(eventData.patientId),
          dhis2Id: reference,
          action: 'create',
          status: 'success',
          payload: {
            program: eventData.program,
            programStage: eventData.programStage || null,
            orgUnit: dhis2Event.orgUnit,
            trackedEntityInstance,
            enrollmentId: enrollmentId || null,
            dataValuesCount: Array.isArray(eventData.dataValues) ? eventData.dataValues.length : 0,
          },
        });
      }

      return {
        status: 'SUCCESS',
        reference,
        message: 'Event sent to DHIS2 successfully',
      };
    } catch (error: any) {
      this.logger.error('Error sending event to DHIS2:', error);
      if (this.canQueryTenantDb(tenantDb)) {
        try {
          await this.ensureTenantSyncTables(tenantDb);
          await this.insertSyncLog(tenantDb, {
            entityType: 'event',
            entityId: this.asNullableUuid(eventData?.patientId),
            dhis2Id: null,
            action: 'error',
            status: 'error',
            errorMessage: error?.message || 'DHIS2 event send failed',
            payload: {
              program: eventData?.program || null,
              programStage: eventData?.programStage || null,
              request: eventData || null,
              response: error?.response?.data || null,
            },
          });
        } catch (logError: any) {
          this.logger.warn(`Failed to write DHIS2 event sync log: ${logError?.message || logError}`);
        }
      }
      return {
        status: 'ERROR',
        reference: `EVENT_${Date.now()}`,
        message: `DHIS2 event send failed: ${error.message}`,
        error: error.response?.data || error.message,
      };
    }
  }

  async sendDataValues(dataValues: any, tenantDb: DataSource, tenantId?: string) {
    try {
      const context = await this.resolveContext(tenantId);

      if (!context.enabled) {
        return {
          status: 'NOT_CONFIGURED',
          imported: 0,
          message: context.reason || 'DHIS2 is not configured for this tenant.',
        };
      }

      if (context.useMock || !context.client || !context.config) {
        this.logger.warn(`DHIS2 sendDataValues running in MOCK mode (${context.reason || 'fallback'})`);
        return {
          status: 'SUCCESS',
          imported: dataValues.values?.length || 0,
          message: '[MOCK] Data values sent to DHIS2 successfully',
        };
      }

      const dhis2DataValues = {
        dataSet: dataValues.dataSet || context.config.dataSetId || this.envDataSetId,
        completeDate: new Date().toISOString().slice(0, 10),
        period: dataValues.period,
        orgUnit: dataValues.orgUnit || context.config.orgUnitId || this.envOrgUnit,
        dataValues: (dataValues.values || []).map((item: any) => ({
          ...item,
          orgUnit: item?.orgUnit || dataValues.orgUnit || context.config.orgUnitId || this.envOrgUnit,
          period: item?.period || dataValues.period,
        })),
      };

      const response = await context.client.post('/dataValueSets', dhis2DataValues);
      const importCounts = this.extractImportCounts(response.data);

      if (this.canQueryTenantDb(tenantDb)) {
        await this.ensureTenantSyncTables(tenantDb);
        await this.insertSyncLog(tenantDb, {
          entityType: 'data_value_set',
          entityId: null,
          dhis2Id: null,
          action: 'upsert',
          status: 'success',
          payload: {
            dataSet: dhis2DataValues.dataSet,
            period: dhis2DataValues.period,
            orgUnit: dhis2DataValues.orgUnit,
            dataValuesCount: Array.isArray(dhis2DataValues.dataValues) ? dhis2DataValues.dataValues.length : 0,
            ...importCounts,
          },
        });
      }

      return {
        status: response.data.status || 'SUCCESS',
        imported: importCounts.imported,
        updated: importCounts.updated,
        ignored: importCounts.ignored,
        deleted: importCounts.deleted,
        message: 'Data values sent to DHIS2 successfully',
      };
    } catch (error: any) {
      this.logger.error('Error sending data values to DHIS2:', error);
      if (this.canQueryTenantDb(tenantDb)) {
        try {
          await this.ensureTenantSyncTables(tenantDb);
          await this.insertSyncLog(tenantDb, {
            entityType: 'data_value_set',
            entityId: null,
            dhis2Id: null,
            action: 'error',
            status: 'error',
            errorMessage: error?.message || 'DHIS2 data values send failed',
            payload: {
              dataSet: dataValues?.dataSet || null,
              period: dataValues?.period || null,
              orgUnit: dataValues?.orgUnit || null,
              request: dataValues || null,
              response: error?.response?.data || null,
            },
          });
        } catch (logError: any) {
          this.logger.warn(`Failed to write DHIS2 data-value sync log: ${logError?.message || logError}`);
        }
      }
      return {
        status: 'ERROR',
        imported: 0,
        message: `DHIS2 data values send failed: ${error.message}`,
        error: error.response?.data || error.message,
      };
    }
  }

  // ── TRACKER PROGRAM STAGE EVENTS ────────────────────────────────────────

  /**
   * Push a clinical encounter as a DHIS2 program stage event.
   * Requires the patient to already have a TEI mapping (run syncPatients first).
   */
  async syncEncounterAsTrackerEvent(
    tenantDb: DataSource,
    tenantId: string | undefined,
    encounterId: string,
    programId: string,
    programStageId: string,
  ): Promise<{ status: string; reference?: string; message: string }> {
    const context = await this.resolveContext(tenantId);
    if (!context.enabled) return { status: 'NOT_CONFIGURED', message: context.reason ?? 'DHIS2 not configured.' };
    if (context.useMock || !context.client || !context.config) return { status: 'SUCCESS', reference: `MOCK_EVT_${encounterId}`, message: '[MOCK] Encounter event recorded.' };

    await this.ensureTenantSyncTables(tenantDb);

    const [encounter] = await tenantDb.query(
      `SELECT e.id, e.patient_id, e.encounter_date, e.encounter_type, e.ward, e.department, e.created_at
       FROM encounters e WHERE e.id = $1 LIMIT 1`,
      [encounterId],
    );
    if (!encounter) return { status: 'ERROR', message: `Encounter ${encounterId} not found.` };

    const teiId = await this.loadPatientTeiMapping(tenantDb, encounter.patient_id);
    if (!teiId) return { status: 'ERROR', message: `No DHIS2 TEI mapping for patient ${encounter.patient_id}. Run patient sync first.` };

    const diagnoses: Array<{ icd10_code: string; description: string }> = await tenantDb.query(
      `SELECT icd10_code, COALESCE(description, display_name, icd10_code) AS description
       FROM patient_diagnoses WHERE encounter_id = $1 ORDER BY created_at ASC LIMIT 5`,
      [encounterId],
    );

    const eventDate = this.formatDateOnly(encounter.encounter_date || encounter.created_at);
    const orgUnit = context.config.orgUnitId || this.envOrgUnit || '';

    // Resolve data element IDs for encounter fields from DHIS2 metadata
    const deMap = await this.resolveAggregateElementIdsByCode(context, undefined, {
      encounterType: 'MC_DE_ENCOUNTER_TYPE',
      ward: 'MC_DE_ENCOUNTER_WARD',
      primaryDiagnosis: 'MC_DE_ENCOUNTER_PRIMARY_DIAGNOSIS',
      diagnosisCodes: 'MC_DE_ENCOUNTER_DIAGNOSIS_CODES',
    });

    const dataValues = [
      deMap.encounterType && { dataElement: deMap.encounterType, value: encounter.encounter_type || 'OPD' },
      deMap.ward && encounter.ward && { dataElement: deMap.ward, value: encounter.ward },
      deMap.primaryDiagnosis && diagnoses[0] && { dataElement: deMap.primaryDiagnosis, value: diagnoses[0].icd10_code },
      deMap.diagnosisCodes && diagnoses.length > 0 && {
        dataElement: deMap.diagnosisCodes,
        value: diagnoses.map(d => d.icd10_code).join(';'),
      },
    ].filter(Boolean);

    return this.sendEvent(
      { program: programId, programStage: programStageId, orgUnit, eventDate, patientId: encounter.patient_id, dataValues },
      tenantDb, tenantId,
    );
  }

  /**
   * Push a lab result as a DHIS2 program stage event.
   */
  async syncLabResultAsTrackerEvent(
    tenantDb: DataSource,
    tenantId: string | undefined,
    labResultId: string,
    programId: string,
    programStageId: string,
  ): Promise<{ status: string; reference?: string; message: string }> {
    const context = await this.resolveContext(tenantId);
    if (!context.enabled) return { status: 'NOT_CONFIGURED', message: context.reason ?? 'DHIS2 not configured.' };
    if (context.useMock || !context.client || !context.config) return { status: 'SUCCESS', reference: `MOCK_LAB_${labResultId}`, message: '[MOCK] Lab event recorded.' };

    await this.ensureTenantSyncTables(tenantDb);

    const [result] = await tenantDb.query(
      `SELECT lr.id, lr.patient_id, lr.test_name, lr.loinc_code, lr.value_text,
              lr.value_numeric, lr.unit, lr.flag, lr.resulted_at, lr.reference_range
       FROM lab_results lr WHERE lr.id = $1 LIMIT 1`,
      [labResultId],
    );
    if (!result) return { status: 'ERROR', message: `Lab result ${labResultId} not found.` };

    const teiId = await this.loadPatientTeiMapping(tenantDb, result.patient_id);
    if (!teiId) return { status: 'ERROR', message: `No DHIS2 TEI mapping for patient ${result.patient_id}.` };

    const deMap = await this.resolveAggregateElementIdsByCode(context, undefined, {
      testName: 'MC_DE_LAB_TEST_NAME',
      loincCode: 'MC_DE_LAB_LOINC_CODE',
      resultValue: 'MC_DE_LAB_RESULT_VALUE',
      resultUnit: 'MC_DE_LAB_RESULT_UNIT',
      resultFlag: 'MC_DE_LAB_RESULT_FLAG',
      referenceRange: 'MC_DE_LAB_REFERENCE_RANGE',
    });

    const dataValues = [
      deMap.testName && { dataElement: deMap.testName, value: result.test_name || '' },
      deMap.loincCode && result.loinc_code && { dataElement: deMap.loincCode, value: result.loinc_code },
      deMap.resultValue && { dataElement: deMap.resultValue, value: String(result.value_numeric ?? result.value_text ?? '') },
      deMap.resultUnit && result.unit && { dataElement: deMap.resultUnit, value: result.unit },
      deMap.resultFlag && result.flag && { dataElement: deMap.resultFlag, value: result.flag },
      deMap.referenceRange && result.reference_range && { dataElement: deMap.referenceRange, value: result.reference_range },
    ].filter(Boolean);

    const eventDate = this.formatDateOnly(result.resulted_at);
    const orgUnit = context.config.orgUnitId || this.envOrgUnit || '';

    return this.sendEvent(
      { program: programId, programStage: programStageId, orgUnit, eventDate, patientId: result.patient_id, dataValues },
      tenantDb, tenantId,
    );
  }

  /**
   * Push a vital signs set as a DHIS2 program stage event.
   */
  async syncVitalSignsAsTrackerEvent(
    tenantDb: DataSource,
    tenantId: string | undefined,
    vitalSignsId: string,
    programId: string,
    programStageId: string,
  ): Promise<{ status: string; reference?: string; message: string }> {
    const context = await this.resolveContext(tenantId);
    if (!context.enabled) return { status: 'NOT_CONFIGURED', message: context.reason ?? 'DHIS2 not configured.' };
    if (context.useMock || !context.client || !context.config) return { status: 'SUCCESS', reference: `MOCK_VS_${vitalSignsId}`, message: '[MOCK] Vitals event recorded.' };

    await this.ensureTenantSyncTables(tenantDb);

    const [vitals] = await tenantDb.query(
      `SELECT vs.id, vs.patient_id, vs.recorded_at,
              vs.systolic_bp, vs.diastolic_bp, vs.heart_rate, vs.respiratory_rate,
              vs.spo2, vs.temperature, vs.weight, vs.height, vs.muac,
              vs.pain_score, vs.news2_total_score
       FROM vital_signs vs WHERE vs.id = $1 LIMIT 1`,
      [vitalSignsId],
    );
    if (!vitals) return { status: 'ERROR', message: `Vital signs ${vitalSignsId} not found.` };

    const teiId = await this.loadPatientTeiMapping(tenantDb, vitals.patient_id);
    if (!teiId) return { status: 'ERROR', message: `No DHIS2 TEI mapping for patient ${vitals.patient_id}.` };

    const deMap = await this.resolveAggregateElementIdsByCode(context, undefined, {
      systolicBp: 'MC_DE_VS_SYSTOLIC_BP',
      diastolicBp: 'MC_DE_VS_DIASTOLIC_BP',
      heartRate: 'MC_DE_VS_HEART_RATE',
      respiratoryRate: 'MC_DE_VS_RESPIRATORY_RATE',
      spo2: 'MC_DE_VS_SPO2',
      temperature: 'MC_DE_VS_TEMPERATURE',
      weight: 'MC_DE_VS_WEIGHT',
      muac: 'MC_DE_VS_MUAC',
      news2Score: 'MC_DE_VS_NEWS2_SCORE',
    });

    const dataValues = [
      ['systolicBp', vitals.systolic_bp],
      ['diastolicBp', vitals.diastolic_bp],
      ['heartRate', vitals.heart_rate],
      ['respiratoryRate', vitals.respiratory_rate],
      ['spo2', vitals.spo2],
      ['temperature', vitals.temperature],
      ['weight', vitals.weight],
      ['muac', vitals.muac],
      ['news2Score', vitals.news2_total_score],
    ]
      .filter(([key, val]) => deMap[key as string] && val != null)
      .map(([key, val]) => ({ dataElement: deMap[key as string], value: String(val) }));

    const eventDate = this.formatDateOnly(vitals.recorded_at);
    const orgUnit = context.config.orgUnitId || this.envOrgUnit || '';

    return this.sendEvent(
      { program: programId, programStage: programStageId, orgUnit, eventDate, patientId: vitals.patient_id, dataValues },
      tenantDb, tenantId,
    );
  }

  async getPrograms(tenantId?: string) {
    try {
      const context = await this.resolveContext(tenantId);

      if (!context.enabled) {
        return {
          status: 'NOT_CONFIGURED',
          programs: [],
          message: context.reason || 'DHIS2 is not configured for this tenant.',
        };
      }

      if (context.useMock || !context.client) {
        this.logger.warn(`DHIS2 getPrograms running in MOCK mode (${context.reason || 'fallback'})`);
        return {
          programs: [
            { id: 'IpHINAT79UW', name: 'Child Programme', description: 'Child health and immunization program' },
            { id: 'WSGAb5XwJ3Y', name: 'Malaria case management', description: 'Malaria diagnosis and treatment program' },
            { id: 'M3xtLkYBlKI', name: 'TB care and treatment', description: 'Tuberculosis care and treatment program' },
            { id: 'uy2gU8kT1jF', name: 'HIV Care and Treatment', description: 'HIV/AIDS care and treatment program' },
          ],
        };
      }

      const response = await context.client.get('/programs', {
        params: {
          fields: 'id,name,description',
          paging: false,
        },
      });

      return { programs: response.data.programs || [] };
    } catch (error: any) {
      this.logger.error('Error fetching DHIS2 programs:', error);
      return {
        programs: [
          { id: 'uy2gU8kT1jF', name: 'HIV Care and Treatment', description: 'HIV/AIDS care and treatment program' },
          { id: 'M3xtLkYBlKI', name: 'TB care and treatment', description: 'Tuberculosis care and treatment program' },
        ],
        error: 'Failed to fetch from DHIS2, using default programs',
      };
    }
  }

  async getDataElements(program?: string, tenantId?: string) {
    try {
      const context = await this.resolveContext(tenantId);

      if (!context.enabled) {
        return {
          status: 'NOT_CONFIGURED',
          dataElements: [],
          message: context.reason || 'DHIS2 is not configured for this tenant.',
        };
      }

      if (context.useMock || !context.client) {
        this.logger.warn(`DHIS2 getDataElements running in MOCK mode (${context.reason || 'fallback'})`);
        const mockDataElements: Record<string, Array<{ id: string; name: string; valueType: string }>> = {
          IpHINAT79UW: [
            { id: 'UXz7xuGCEhU', name: 'Weight (kg)', valueType: 'NUMBER' },
            { id: 'lZGmxYbs97q', name: 'Height (cm)', valueType: 'NUMBER' },
            { id: 'X8zyunlgUfM', name: 'Vaccination given', valueType: 'BOOLEAN' },
          ],
          WSGAb5XwJ3Y: [
            { id: 'qrur9Dvnyt5', name: 'Fever', valueType: 'BOOLEAN' },
            { id: 'oZg33kd9taw', name: 'RDT Result', valueType: 'TEXT' },
            { id: 'GieVkTxp4HH', name: 'Treatment given', valueType: 'TEXT' },
          ],
        };

        return {
          dataElements: program ? mockDataElements[program] || [] : Object.values(mockDataElements).flat(),
        };
      }

      if (program) {
        const response = await context.client.get(`/programs/${program}`, {
          params: {
            fields: 'programStages[programStageDataElements[dataElement[id,name,valueType]]]',
          },
        });

        const dataElements: any[] = [];
        if (response.data.programStages) {
          response.data.programStages.forEach((stage: any) => {
            if (stage.programStageDataElements) {
              stage.programStageDataElements.forEach((psde: any) => {
                if (psde.dataElement) {
                  dataElements.push({
                    id: psde.dataElement.id,
                    name: psde.dataElement.name,
                    valueType: psde.dataElement.valueType,
                  });
                }
              });
            }
          });
        }

        return { dataElements };
      }

      const response = await context.client.get('/dataElements', {
        params: {
          fields: 'id,name,valueType',
          paging: false,
        },
      });

      return {
        dataElements: response.data.dataElements || [],
      };
    } catch (error: any) {
      this.logger.error('Error fetching DHIS2 data elements:', error);
      return {
        dataElements: [],
        error: error.response?.data || error.message,
      };
    }
  }

  async sendAggregateReport(reportData: any, tenantDb: DataSource, tenantId?: string) {
    try {
      const report = reportData || {};
      const context = await this.resolveContext(tenantId);

      if (!context.enabled) {
        return {
          status: 'NOT_CONFIGURED',
          period: report.period || 'unknown',
          dataValues: 0,
          message: context.reason || 'DHIS2 is not configured for this tenant.',
        };
      }

      const profileSelection = this.getAggregateProfile(report.profile);
      if (!profileSelection) {
        return {
          status: 'NOT_CONFIGURED',
          period: report.period || 'unknown',
          dataValues: 0,
          message: `Unsupported aggregate profile "${report.profile}".`,
        };
      }

      const profile = profileSelection.key;
      const profileDefinition = profileSelection.definition;
      const period = report.period || new Date().toISOString().slice(0, 7).replace('-', '');
      const orgUnit = report.orgUnit || context.config?.orgUnitId || this.envOrgUnit || 'YOUR_ORG_UNIT_ID';

      let dataSet =
        report.dataSet ||
        (profile === 'service_delivery'
          ? context.config?.dataSetId || this.envDataSetId
          : undefined);
      if (!dataSet && context.client) {
        dataSet = await this.resolveDataSetIdByCode(context, profileDefinition.dataSetCode);
      }

      const fallbackElementMap =
        !report.dataElements && context.client
          ? await this.resolveAggregateElementIdsByCode(context, dataSet, profileDefinition.metricCodes)
          : {};
      const elementMap = {
        ...fallbackElementMap,
        ...(report.dataElements || {}),
      };

      const computedMetrics = await this.computeAggregateMetrics(profile, tenantDb, period);

      const payloadDataValues =
        Array.isArray(report.dataValues) && report.dataValues.length > 0
          ? report.dataValues
          : Object.entries(computedMetrics)
              .filter(([metricKey]) => Boolean(elementMap[metricKey]))
              .map(([metricKey, value]) => ({
                dataElement: elementMap[metricKey],
                value: String(value),
              }));

      if (!dataSet) {
        return {
          status: 'NOT_CONFIGURED',
          period,
          dataValues: 0,
          message: `DHIS2 dataset is not configured for aggregate profile "${profile}".`,
        };
      }

      if (!payloadDataValues.length) {
        return {
          status: 'NOT_CONFIGURED',
          period,
          dataValues: 0,
          message: `No aggregate data elements are configured for profile "${profile}". Provide reportData.dataElements or include mapped data elements in the target dataset.`,
        };
      }

      // Pre-submission validation (non-blocking — violations are returned in response but don't prevent send)
      let validationResult: Awaited<ReturnType<typeof this.validateBeforeSubmit>> | null = null;
      if (report.validate !== false && dataSet) {
        try {
          validationResult = await this.validateBeforeSubmit(
            tenantId,
            dataSet,
            payloadDataValues.map((dv: any) => ({ dataElement: dv.dataElement, value: String(dv.value) })),
            period,
            orgUnit,
          );
          if (validationResult.violations.length > 0) {
            this.logger.warn(
              `DHIS2 validation: ${validationResult.violations.length} rule violation(s) for ${profile} period ${period}: ` +
              validationResult.violations.map(v => v.ruleName).join(', '),
            );
          }
        } catch (valErr: any) {
          this.logger.warn(`Validation check failed (non-blocking): ${valErr?.message}`);
        }
      }

      // completeDate must be YYYY-MM-DD — last day of the reporting period
      const { endDate: periodEnd } = this.resolveMonthlyPeriodBounds(period);
      const completeDate = new Date(new Date(periodEnd).getTime() - 86400000).toISOString().slice(0, 10);

      let aggregateData = {
        dataSet,
        completeDate,
        period,
        orgUnit,
        dataValues: payloadDataValues.map((item: any) => ({
          ...item,
          orgUnit: item?.orgUnit || orgUnit,
          period: item?.period || period,
        })),
      };

      if (context.useMock || !context.client) {
        this.logger.warn(`DHIS2 sendAggregateReport running in MOCK mode (${context.reason || 'fallback'})`);
        return {
          status: 'SUCCESS',
          profile,
          period: aggregateData.period,
          dataValues: aggregateData.dataValues.length,
          message: '[MOCK] Aggregate report sent to DHIS2 successfully',
        };
      }

      let response;
      try {
        response = await context.client.post('/dataValueSets', aggregateData);
      } catch (error: any) {
        const fallbackPeriod = this.extractLatestOpenFuturePeriod(error?.response?.data);
        if (!fallbackPeriod || fallbackPeriod === aggregateData.period) {
          throw error;
        }

        aggregateData = {
          ...aggregateData,
          period: fallbackPeriod,
          dataValues: aggregateData.dataValues.map((item: any) => ({
            ...item,
            period: fallbackPeriod,
          })),
        };

        this.logger.warn(
          `Aggregate period ${period} rejected by DHIS2; retrying with latest allowed period ${fallbackPeriod}.`,
        );
        response = await context.client.post('/dataValueSets', aggregateData);
      }

      const importCounts = this.extractImportCounts(response.data);

      await this.ensureTenantSyncTables(tenantDb);
      await this.insertSyncLog(tenantDb, {
        entityType: 'aggregate',
        entityId: null,
        dhis2Id: null,
        action: 'upsert',
        status: 'success',
        payload: {
          profile,
          dataSet: aggregateData.dataSet,
          period: aggregateData.period,
          orgUnit: aggregateData.orgUnit,
          dataValuesCount: aggregateData.dataValues.length,
          metrics: computedMetrics,
          ...importCounts,
        },
      });

      return {
        status: response.data.status || 'SUCCESS',
        profile,
        period: aggregateData.period,
        imported: importCounts.imported,
        updated: importCounts.updated,
        ignored: importCounts.ignored,
        dataValues: aggregateData.dataValues.length,
        message: 'Aggregate report sent to DHIS2 successfully',
        validation: validationResult
          ? {
              valid: validationResult.valid,
              violationCount: validationResult.violations.length,
              violations: validationResult.violations,
              rulesChecked: validationResult.rulesChecked,
            }
          : null,
      };
    } catch (error: any) {
      this.logger.error('Error sending aggregate report to DHIS2:', error);
      if (this.canQueryTenantDb(tenantDb)) {
        try {
          await this.ensureTenantSyncTables(tenantDb);
          await this.insertSyncLog(tenantDb, {
            entityType: 'aggregate',
            entityId: null,
            dhis2Id: null,
            action: 'error',
            status: 'error',
            errorMessage: error?.message || 'DHIS2 aggregate report send failed',
            payload: {
              profile: reportData?.profile || 'service_delivery',
              period: reportData?.period || null,
              dataSet: reportData?.dataSet || null,
              orgUnit: reportData?.orgUnit || null,
              request: reportData || null,
              response: error?.response?.data || null,
            },
          });
        } catch (logError: any) {
          this.logger.warn(`Failed to write DHIS2 aggregate sync log: ${logError?.message || logError}`);
        }
      }
      return {
        status: 'ERROR',
        profile: reportData?.profile || 'service_delivery',
        period: reportData?.period || 'unknown',
        dataValues: 0,
        message: `DHIS2 aggregate report send failed: ${error.message}`,
        error: error.response?.data || error.message,
      };
    }
  }

  async getSyncStatus(tenantDb: DataSource, tenantId?: string) {
    try {
      const context = await this.resolveContext(tenantId);

      if (!context.enabled) {
        return {
          lastSync: null,
          status: 'NOT_CONFIGURED',
          patientsSynced: 0,
          eventsSynced: 0,
          dataValuesSynced: 0,
          errors: 0,
          nextSync: null,
          message: context.reason || 'DHIS2 is not configured for this tenant.',
        };
      }

      if (context.useMock || !context.client) {
        return {
          lastSync: null,
          status: 'MOCK_MODE',
          patientsSynced: 0,
          eventsSynced: 0,
          dataValuesSynced: 0,
          errors: 0,
          nextSync: null,
          message:
            `DHIS2 running in MOCK mode (${context.reason || 'fallback'}). Configure DHIS2_PAT or DHIS2_USERNAME/DHIS2_PASSWORD to enable real API.`,
        };
      }

      const systemInfo = await context.client.get('/system/info');

      let lastSync: string | null = null;
      let patientSuccessCount = 0;
      let eventSuccessCount = 0;
      let dataValueSuccessCount = 0;
      let totalErrorCount = 0;

      if (tenantDb && typeof (tenantDb as any).query === 'function') {
        try {
          await this.ensureTenantSyncTables(tenantDb);
          const statsRows: Dhis2SyncStatsRow[] = await tenantDb.query(
            `
            SELECT
              MAX(synced_at) AS last_sync,
              COUNT(*) FILTER (WHERE entity_type = 'patient' AND status = 'success')::int AS patient_success_count,
              COUNT(*) FILTER (WHERE entity_type = 'event' AND status = 'success')::int AS event_success_count,
              COUNT(*) FILTER (
                WHERE entity_type IN ('data_value_set', 'aggregate') AND status = 'success'
              )::int AS data_value_success_count,
              COUNT(*) FILTER (WHERE status = 'error')::int AS total_error_count
            FROM dhis2_sync_log
            `,
          );
          const stats = statsRows?.[0] || {};
          lastSync = stats.last_sync ? String(stats.last_sync) : null;
          patientSuccessCount = Number(stats.patient_success_count || 0);
          eventSuccessCount = Number(stats.event_success_count || 0);
          dataValueSuccessCount = Number(stats.data_value_success_count || 0);
          totalErrorCount = Number(stats.total_error_count || 0);
        } catch (statsError: any) {
          this.logger.warn(`Unable to read DHIS2 sync log stats: ${statsError?.message || statsError}`);
        }
      }

      return {
        lastSync,
        status: 'CONNECTED',
        dhis2Version: systemInfo.data?.version || 'unknown',
        patientsSynced: patientSuccessCount,
        eventsSynced: eventSuccessCount,
        dataValuesSynced: dataValueSuccessCount,
        errors: totalErrorCount,
        nextSync: null,
        message: 'Connected to DHIS2 successfully',
      };
    } catch (error: any) {
      this.logger.error('Error checking DHIS2 sync status:', error);
      return {
        lastSync: null,
        status: 'ERROR',
        patientsSynced: 0,
        eventsSynced: 0,
        dataValuesSynced: 0,
        errors: 1,
        nextSync: null,
        message: `DHIS2 connection failed: ${error.message}`,
        error: error.response?.data || error.message,
      };
    }
  }

  /**
   * Pull aggregate analytics FROM DHIS2 for a given indicator/data element and org unit hierarchy.
   * Returns facility value + district/national benchmark so doctors can compare performance.
   */
  // ── ORG UNIT HIERARCHY RESOLUTION ────────────────────────────────────────

  private async resolveOrgUnitAncestors(
    context: Dhis2Context,
    orgUnitId: string,
  ): Promise<{ districtId: string | null; nationalId: string | null }> {
    if (!context.client || !orgUnitId) return { districtId: null, nationalId: null };
    try {
      const res = await context.client.get(`/organisationUnits/${orgUnitId}`, {
        params: { fields: 'id,level,ancestors[id,level]' },
      });
      const ancestors: Array<{ id: string; level: number }> = res.data?.ancestors || [];
      const facilityLevel = Number(res.data?.level ?? 0);
      // District is typically one level above facility; national is level 1
      const districtLevel = facilityLevel - 1;
      const district = ancestors.find(a => a.level === districtLevel) ?? null;
      const national = ancestors.find(a => a.level === 1) ?? null;
      return { districtId: district?.id ?? null, nationalId: national?.id ?? null };
    } catch {
      return { districtId: null, nationalId: null };
    }
  }

  private async analyticsValue(
    context: Dhis2Context,
    dataElement: string,
    orgUnit: string,
    period: string,
    aggregationType: 'AVERAGE' | 'SUM' = 'SUM',
  ): Promise<number | null> {
    if (!context.client) return null;
    try {
      const res = await context.client.get('/analytics', {
        params: {
          dimension: `dx:${dataElement},ou:${orgUnit},pe:${period}`,
          aggregationType,
          skipMeta: true,
        },
      });
      const rows: any[] = res.data?.rows || [];
      if (rows.length === 0) return null;
      // rows: [dxUid, ouUid, peUid, value]
      const nums = rows.map((r: any) => Number(r[3])).filter(n => Number.isFinite(n));
      if (nums.length === 0) return null;
      return aggregationType === 'AVERAGE'
        ? nums.reduce((a, b) => a + b, 0) / nums.length
        : nums.reduce((a, b) => a + b, 0);
    } catch {
      return null;
    }
  }

  async getFacilityBenchmarks(
    tenantId: string | undefined,
    args: {
      dataElement: string;
      period: string;
      facilityOrgUnit?: string;
      parentOrgUnit?: string;
    },
  ): Promise<{
    facility: number | null;
    district: number | null;
    national: number | null;
    districtOrgUnit: string | null;
    nationalOrgUnit: string | null;
    period: string;
    dataElement: string;
  }> {
    const context = await this.resolveContext(tenantId);
    const period = args.period || new Date().toISOString().slice(0, 7).replace('-', '');

    if (context.useMock || !context.client || !context.config) {
      return { facility: null, district: null, national: null, districtOrgUnit: null, nationalOrgUnit: null, period, dataElement: args.dataElement };
    }

    const facilityOrgUnit = args.facilityOrgUnit || context.config.orgUnitId || '';
    if (!facilityOrgUnit) {
      return { facility: null, district: null, national: null, districtOrgUnit: null, nationalOrgUnit: null, period, dataElement: args.dataElement };
    }

    // Resolve hierarchy from DHIS2 — use provided parentOrgUnit as override for district
    const { districtId, nationalId } = args.parentOrgUnit
      ? { districtId: args.parentOrgUnit, nationalId: null }
      : await this.resolveOrgUnitAncestors(context, facilityOrgUnit);

    const [facility, district, national] = await Promise.all([
      this.analyticsValue(context, args.dataElement, facilityOrgUnit, period, 'SUM'),
      districtId ? this.analyticsValue(context, args.dataElement, `LEVEL-${await this.getOrgUnitLevel(context, facilityOrgUnit)};${districtId}`, period, 'AVERAGE') : Promise.resolve(null),
      nationalId ? this.analyticsValue(context, args.dataElement, `LEVEL-${await this.getOrgUnitLevel(context, facilityOrgUnit)};${nationalId}`, period, 'AVERAGE') : Promise.resolve(null),
    ]);

    return { facility, district, national, districtOrgUnit: districtId, nationalOrgUnit: nationalId, period, dataElement: args.dataElement };
  }

  private async getOrgUnitLevel(context: Dhis2Context, orgUnitId: string): Promise<number> {
    if (!context.client) return 4;
    try {
      const res = await context.client.get(`/organisationUnits/${orgUnitId}`, { params: { fields: 'level' } });
      return Number(res.data?.level ?? 4);
    } catch {
      return 4;
    }
  }

  // ── VALIDATION RULES ENGINE ─────────────────────────────────────────────

  /**
   * Fetch DHIS2 validation rules for a dataset and evaluate them against
   * the given data values before submission. Returns any violations.
   */
  async validateBeforeSubmit(
    tenantId: string | undefined,
    dataSetId: string,
    dataValues: Array<{ dataElement: string; value: string }>,
    period: string,
    orgUnit: string,
  ): Promise<{
    valid: boolean;
    violations: Array<{ ruleName: string; description: string; operator: string; leftValue: number; rightValue: number }>;
    warnings: string[];
    rulesChecked: number;
  }> {
    const context = await this.resolveContext(tenantId);

    if (context.useMock || !context.client) {
      return { valid: true, violations: [], warnings: ['DHIS2 in mock mode — validation skipped.'], rulesChecked: 0 };
    }

    // Build a lookup map from the submitted data values
    const submitted: Record<string, number> = {};
    for (const dv of dataValues) {
      const n = Number(dv.value);
      if (Number.isFinite(n)) submitted[dv.dataElement] = n;
    }

    // Fetch validation rules from DHIS2 for this dataset
    let rules: any[] = [];
    try {
      const res = await context.client.get('/validationRules', {
        params: {
          filter: `dataSets.id:eq:${dataSetId}`,
          fields: 'id,name,description,operator,leftSide[expression,description],rightSide[expression,description]',
          paging: false,
        },
      });
      rules = res.data?.validationRules || [];
    } catch (err: any) {
      this.logger.warn(`Could not fetch DHIS2 validation rules for ${dataSetId}: ${err?.message}`);
      return { valid: true, violations: [], warnings: [`Validation rules unavailable: ${err?.message}`], rulesChecked: 0 };
    }

    const violations: Array<{ ruleName: string; description: string; operator: string; leftValue: number; rightValue: number }> = [];
    const warnings: string[] = [];

    for (const rule of rules) {
      const leftVal = this.evaluateRuleExpression(rule.leftSide?.expression, submitted);
      const rightVal = this.evaluateRuleExpression(rule.rightSide?.expression, submitted);

      if (leftVal === null || rightVal === null) {
        // Can't evaluate — data elements in rule not in submission
        warnings.push(`Rule "${rule.name}" skipped — referenced data elements not in submission.`);
        continue;
      }

      const violated = this.evaluateOperator(rule.operator, leftVal, rightVal);
      if (violated) {
        violations.push({
          ruleName: rule.name || rule.id,
          description: rule.description || `${rule.leftSide?.description} ${rule.operator} ${rule.rightSide?.description}`,
          operator: rule.operator,
          leftValue: leftVal,
          rightValue: rightVal,
        });
      }
    }

    return {
      valid: violations.length === 0,
      violations,
      warnings,
      rulesChecked: rules.length,
    };
  }

  private evaluateRuleExpression(expression: string | undefined, submitted: Record<string, number>): number | null {
    if (!expression) return null;
    // DHIS2 expressions reference data elements as #{UID} or #{UID.cocUID}
    // Replace each #{...} with the submitted value; if any is missing return null
    let resolved = expression;
    const refs = [...expression.matchAll(/#\{([^}]+)\}/g)];
    if (refs.length === 0) {
      // Pure numeric literal
      const n = Number(expression.trim());
      return Number.isFinite(n) ? n : null;
    }
    for (const [token, inner] of refs) {
      const deId = inner.split('.')[0]; // strip category option combo if present
      const val = submitted[deId];
      if (val === undefined) return null; // missing — can't evaluate
      resolved = resolved.replace(token, String(val));
    }
    try {
      // Safe arithmetic eval — only numbers and operators remain after substitution
      if (!/^[\d\s+\-*/().]+$/.test(resolved)) return null;
      // eslint-disable-next-line no-new-func
      const result = Function(`"use strict"; return (${resolved})`)();
      return Number.isFinite(result) ? result : null;
    } catch {
      return null;
    }
  }

  private evaluateOperator(operator: string, left: number, right: number): boolean {
    // DHIS2 validation rule operators: EQUAL_TO, NOT_EQUAL_TO, LESS_THAN, LESS_THAN_OR_EQUAL_TO,
    // GREATER_THAN, GREATER_THAN_OR_EQUAL_TO, COMPULSORY_PAIR, EXCLUSIVE_PAIR
    // A rule is VIOLATED when the condition is FALSE
    switch (operator) {
      case 'LESS_THAN':               return !(left < right);
      case 'LESS_THAN_OR_EQUAL_TO':   return !(left <= right);
      case 'GREATER_THAN':            return !(left > right);
      case 'GREATER_THAN_OR_EQUAL_TO':return !(left >= right);
      case 'EQUAL_TO':                return !(left === right);
      case 'NOT_EQUAL_TO':            return !(left !== right);
      default:                        return false; // unknown operator — pass
    }
  }

  /**
   * Pull a set of performance benchmarks for the doctor dashboard.
   * Returns facility, district average, and national average for each indicator.
   */
  async getDoctorPerformanceDashboard(
    tenantId: string | undefined,
    period: string,
    facilityOrgUnit?: string,
  ): Promise<{
    period: string;
    facilityOrgUnit: string | null;
    districtOrgUnit: string | null;
    nationalOrgUnit: string | null;
    indicators: Array<{
      label: string;
      dataElement: string;
      facilityValue: number | null;
      districtAvg: number | null;
      nationalAvg: number | null;
      unit: string;
      trend: 'above_district' | 'below_district' | 'at_par' | 'no_benchmark';
    }>;
    mock: boolean;
  }> {
    const context = await this.resolveContext(tenantId);
    const resolvedPeriod = period || new Date().toISOString().slice(0, 7).replace('-', '');

    if (context.useMock || !context.client || !context.config) {
      return {
        period: resolvedPeriod,
        facilityOrgUnit: null,
        districtOrgUnit: null,
        nationalOrgUnit: null,
        mock: true,
        indicators: [
          { label: 'TB Treatment Success Rate', dataElement: 'MC_DE_TB_OUTCOME_CURED', facilityValue: null, districtAvg: null, nationalAvg: null, unit: '%', trend: 'no_benchmark' },
          { label: 'HIV VL Suppression', dataElement: 'MC_DE_HIV_VL_SUPPRESSED_LT1000', facilityValue: null, districtAvg: null, nationalAvg: null, unit: 'patients', trend: 'no_benchmark' },
          { label: 'Malaria RDT Positivity', dataElement: 'MC_DE_MALARIA_RDT_POSITIVE', facilityValue: null, districtAvg: null, nationalAvg: null, unit: 'cases', trend: 'no_benchmark' },
          { label: 'ANC 4+ Coverage', dataElement: 'MC_DE_MATERNAL_ANC4_PLUS', facilityValue: null, districtAvg: null, nationalAvg: null, unit: 'women', trend: 'no_benchmark' },
          { label: 'BP Controlled (HTN)', dataElement: 'MC_DE_HTN_BP_CONTROLLED', facilityValue: null, districtAvg: null, nationalAvg: null, unit: 'patients', trend: 'no_benchmark' },
        ],
      };
    }

    const orgUnit = facilityOrgUnit || context.config.orgUnitId || '';
    if (!orgUnit) {
      return { period: resolvedPeriod, facilityOrgUnit: null, districtOrgUnit: null, nationalOrgUnit: null, mock: false, indicators: [] };
    }

    // Resolve org unit hierarchy once
    const [facilityLevel, { districtId, nationalId }] = await Promise.all([
      this.getOrgUnitLevel(context, orgUnit),
      this.resolveOrgUnitAncestors(context, orgUnit),
    ]);

    const indicatorDefs = [
      { label: 'TB Treatment Success Rate', dataElement: 'MC_DE_TB_OUTCOME_CURED', unit: '%', higherIsBetter: true },
      { label: 'HIV VL Suppression (<1000)', dataElement: 'MC_DE_HIV_VL_SUPPRESSED_LT1000', unit: 'patients', higherIsBetter: true },
      { label: 'Malaria RDT Positivity', dataElement: 'MC_DE_MALARIA_RDT_POSITIVE', unit: 'cases', higherIsBetter: false },
      { label: 'ANC 4+ Coverage', dataElement: 'MC_DE_MATERNAL_ANC4_PLUS', unit: 'women', higherIsBetter: true },
      { label: 'BP Controlled (HTN)', dataElement: 'MC_DE_HTN_BP_CONTROLLED', unit: 'patients', higherIsBetter: true },
      { label: 'ICU Mortality', dataElement: 'MC_DE_ICU_DEATHS', unit: 'deaths', higherIsBetter: false },
      { label: 'HAI Cases', dataElement: 'MC_DE_HAI_TOTAL', unit: 'cases', higherIsBetter: false },
      { label: 'Lab Turnaround (hrs)', dataElement: 'MC_DE_LAB_TAT_HOURS', unit: 'hours', higherIsBetter: false },
      { label: 'Cervical Screening VIA+', dataElement: 'MC_DE_CX_VIA_POSITIVE', unit: 'women', higherIsBetter: true },
      { label: 'Neonatal Deaths', dataElement: 'MC_DE_NEO_DEATHS', unit: 'deaths', higherIsBetter: false },
    ];

    const dxList = indicatorDefs.map(d => d.dataElement).join(';');
    const levelFilter = `LEVEL-${facilityLevel}`;

    // Fetch facility values, district averages, and national averages in parallel
    const [facilityRes, districtRes, nationalRes] = await Promise.allSettled([
      context.client.get('/analytics', {
        params: { dimension: `dx:${dxList},ou:${orgUnit},pe:${resolvedPeriod}`, skipMeta: true },
      }),
      districtId
        ? context.client.get('/analytics', {
            params: { dimension: `dx:${dxList},ou:${levelFilter};${districtId},pe:${resolvedPeriod}`, skipMeta: true, aggregationType: 'AVERAGE' },
          })
        : Promise.resolve(null),
      nationalId
        ? context.client.get('/analytics', {
            params: { dimension: `dx:${dxList},ou:${levelFilter};${nationalId},pe:${resolvedPeriod}`, skipMeta: true, aggregationType: 'AVERAGE' },
          })
        : Promise.resolve(null),
    ]);

    const extractValues = (settled: PromiseSettledResult<any>): Record<string, number> => {
      if (settled.status === 'rejected' || !settled.value) return {};
      const rows: any[] = settled.value?.data?.rows || [];
      const map: Record<string, number[]> = {};
      for (const row of rows) {
        const de = row[0]; const val = Number(row[3]);
        if (Number.isFinite(val)) { (map[de] ??= []).push(val); }
      }
      // Average across all org units in the result (district/national analytics returns one row per facility)
      const out: Record<string, number> = {};
      for (const [de, vals] of Object.entries(map)) {
        out[de] = vals.reduce((a, b) => a + b, 0) / vals.length;
      }
      return out;
    };

    const facilityVals = extractValues(facilityRes);
    const districtVals = extractValues(districtRes);
    const nationalVals = extractValues(nationalRes);

    const computeTrend = (fVal: number | null, dVal: number | null, higherIsBetter: boolean): 'above_district' | 'below_district' | 'at_par' | 'no_benchmark' => {
      if (fVal === null || dVal === null) return 'no_benchmark';
      const threshold = dVal * 0.05; // 5% tolerance band = "at par"
      if (Math.abs(fVal - dVal) <= threshold) return 'at_par';
      const facilityBetter = higherIsBetter ? fVal > dVal : fVal < dVal;
      return facilityBetter ? 'above_district' : 'below_district';
    };

    return {
      period: resolvedPeriod,
      facilityOrgUnit: orgUnit,
      districtOrgUnit: districtId,
      nationalOrgUnit: nationalId,
      mock: false,
      indicators: indicatorDefs.map(def => {
        const fv = facilityVals[def.dataElement] ?? null;
        const dv = districtVals[def.dataElement] ?? null;
        const nv = nationalVals[def.dataElement] ?? null;
        return {
          label: def.label,
          dataElement: def.dataElement,
          facilityValue: fv,
          districtAvg: dv !== null ? Math.round(dv * 10) / 10 : null,
          nationalAvg: nv !== null ? Math.round(nv * 10) / 10 : null,
          unit: def.unit,
          trend: computeTrend(fv, dv, def.higherIsBetter),
        };
      }),
    };
  }

}
