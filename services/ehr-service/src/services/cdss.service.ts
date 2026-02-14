import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Patient } from '../entities/patient.entity';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { WhoSmartGuidelinesService, GuidelineRecommendation } from './who-smart-guidelines.service';

@Injectable()
export class CdssService {
  private readonly logger = new Logger(CdssService.name);
  private readonly cdssClient: AxiosInstance;
  private readonly cdssServiceUrl: string;
  private readonly cdssServiceToken?: string;

  constructor(
    @Optional() @Inject(WhoSmartGuidelinesService) 
    private readonly whoSmartGuidelinesService?: WhoSmartGuidelinesService
  ) {
    this.cdssServiceUrl = process.env.CDSS_SERVICE_URL || 'http://cdss-service:8000';
    this.cdssServiceToken = process.env.CDSS_SERVICE_TOKEN;
    this.cdssClient = axios.create({
      baseURL: this.cdssServiceUrl,
      timeout: 15000, // Increased timeout
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    // Add request interceptor for debugging
    this.cdssClient.interceptors.request.use(request => {
      if (this.cdssServiceToken) {
        request.headers = request.headers || {};
        request.headers['X-Service-Token'] = this.cdssServiceToken;
        request.headers['X-Service-Name'] = 'ehr-service';
      }
      this.logger.log(`[CDSS] Request to: ${request.url}`);
      return request;
    });
    
    // Add response interceptor for debugging
    this.cdssClient.interceptors.response.use(
      response => {
        this.logger.log(`[CDSS] Response status: ${response.status}`);
        return response;
      },
      error => {
        this.logger.warn(`[CDSS] Request failed: ${error.code || error.message}`);
        return Promise.reject(error);
      }
    );
  }

  private buildCdssRequestConfig(timeout: number, tenantId?: string): AxiosRequestConfig {
    const headers: Record<string, string> = {};
    if (tenantId) {
      headers['X-Tenant-ID'] = tenantId;
    }
    return {
      timeout,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    };
  }

  /**
   * Check drug interactions using Python CDSS service
   * Falls back to basic checking if CDSS service unavailable
   */
  async checkDrugInteractions(drugIds: string[], patientId?: string, tenantDb?: DataSource) {
    try {
      // Fetch drug data from database to send to CDSS service
      let drugsData: any[] = [];
      if (tenantDb) {
        const { Drug } = await import('../entities/drug.entity');
        const drugRepo = tenantDb.getRepository(Drug);
        for (const drugId of drugIds) {
          try {
            const drug = await drugRepo.findOne({ where: { id: drugId, isActive: true } });
            if (drug) {
              drugsData.push({
                id: drug.id,
                genericName: drug.genericName,
                name: drug.genericName,
                drugClass: drug.drugClass
              });
            }
          } catch (err) {
            this.logger.warn(`Failed to fetch drug ${drugId}: ${err.message}`);
          }
        }
      }

      // Try advanced checking via Python CDSS service
      const response = await this.cdssClient.post('/drugs/interactions/advanced', {
        drug_ids: drugIds,
        patient_id: patientId,
        drugs_data: drugsData.length > 0 ? drugsData : undefined,
      }, {
        timeout: 15000, // 15 second timeout
      });

      return {
        hasInteractions: response.data.interactions?.length > 0,
        interactions: response.data.interactions || [],
        severity_summary: response.data.severity_summary,
        recommendations: response.data.recommendations || [],
        source: 'advanced_cdss',
      };
    } catch (error: any) {
      this.logger.warn(`CDSS service unavailable, using basic checking: ${error.message}`);
      // Fallback to basic checking
      return this.basicDrugInteractionCheck(drugIds);
    }
  }

  /**
   * Basic drug interaction checking (fallback) - DISABLED
   */
  private async basicDrugInteractionCheck(drugIds: string[]) {
    // Return empty result to avoid fake data
    return {
      hasInteractions: false,
      interactions: [],
      severity_summary: { critical: 0, major: 0, moderate: 0, minor: 0 },
      recommendations: [],
      source: 'fallback_empty',
    };
  }

  /**
   * Diagnostic assistance using Python CDSS service
   * Uses intelligent endpoint (rule-based + AI) if available, falls back to rule-based
   */
  async diagnosisAssist(symptoms: any, useIntelligent: boolean = true, tenantId?: string) {
    try {
      // Handle different input formats
      let symptomList: string[] = [];
      if (symptoms.symptoms && Array.isArray(symptoms.symptoms)) {
        symptomList = symptoms.symptoms;
      } else if (symptoms.symptoms && typeof symptoms.symptoms === 'string') {
        symptomList = [symptoms.symptoms];
      } else if (symptoms.chiefComplaint) {
        symptomList = [symptoms.chiefComplaint];
      } else if (Array.isArray(symptoms)) {
        symptomList = symptoms;
      }
      
      // Normalize symptoms - keep original text for better matching
      const normalizedSymptoms = symptomList
        .map(s => String(s).trim())
        .filter(s => s.length > 0)
        .map(s => s.toLowerCase());
      
      this.logger.debug(`Calling CDSS with symptoms: ${JSON.stringify(normalizedSymptoms)}`);
      
      // Try intelligent endpoint first (if enabled and data available)
      const hasClinicalNotes = symptoms.clinicalNotes || symptoms.chiefComplaint || symptoms.historyOfPresentIllness;
      const hasPatientData = symptoms.age || symptoms.gender || symptoms.vitals || symptoms.labs;
      
      if (useIntelligent && (hasClinicalNotes || hasPatientData)) {
        try {
          const intelligentResponse = await this.cdssClient.post('/diagnosis/suggest/intelligent', {
            symptoms: normalizedSymptoms,
            vitals: symptoms.vitals || undefined,
            clinical_notes: symptoms.clinicalNotes || symptoms.chiefComplaint || symptoms.historyOfPresentIllness || undefined,
            patient_data: {
              age: symptoms.age,
              gender: symptoms.gender,
              vitals: symptoms.vitals,
              labs: symptoms.labs,
              conditions: symptoms.conditions || symptoms.diagnoses || []
            },
            age: symptoms.age || undefined,
            gender: symptoms.gender || undefined,
            labs: symptoms.labs || undefined,
            conditions: symptoms.conditions || symptoms.diagnoses || undefined
          }, this.buildCdssRequestConfig(20000, tenantId));

          const intelligentData = intelligentResponse.data;
          this.logger.log(`Intelligent CDSS response received (AI enabled: ${intelligentData?.ai_enabled})`);
          
          // Return intelligent results if available
          if (intelligentData?.suggested_diagnoses?.length > 0) {
            return {
              suggested_diagnoses: intelligentData.suggested_diagnoses.map((d: any) => ({
                diagnosis: d.diagnosis,
                probability: d.probability,
                icd10: d.icd10,
                confidence: d.confidence,
                sources: d.sources,
                explanation: d.explanation
              })),
              recommendedTests: intelligentData.recommended_tests || [],
              recommended_tests: intelligentData.recommended_tests || [],
              urgencyLevel: intelligentData.red_flags?.length > 0 ? 'high' : 'moderate',
              red_flags: intelligentData.red_flags || [],
              source: intelligentData.source || 'hybrid_cdss_ai',
              ai_enabled: intelligentData.ai_enabled || false,
              ai_models_used: intelligentData.ai_models_used || {},
              explanation: intelligentData.explanation
            };
          }
        } catch (intelligentError: any) {
          this.logger.warn(`Intelligent CDSS endpoint failed, falling back to rule-based: ${intelligentError.message}`);
          // Fall through to rule-based endpoint
        }
      }
      
      // Fallback to rule-based endpoint
      const response = await this.cdssClient.post('/diagnosis/suggest', {
        symptoms: normalizedSymptoms,
        vitals: symptoms.vitals || undefined,
        age: symptoms.age || undefined,
        gender: symptoms.gender || undefined,
      }, this.buildCdssRequestConfig(10000, tenantId));

      const responseData = response.data;
      console.log('[CDSS] Response received:', JSON.stringify(responseData).substring(0, 300));
      this.logger.log(`CDSS response received: ${JSON.stringify(responseData).substring(0, 200)}...`);
      
      // Ensure the response has diagnoses (not just empty arrays)
      const hasDiagnoses = responseData?.suggested_diagnoses?.length > 0 || 
                          responseData?.differentialDiagnoses?.length > 0;
      
      console.log('[CDSS] Has diagnoses?', hasDiagnoses, 'suggested_diagnoses length:', responseData?.suggested_diagnoses?.length, 'differentialDiagnoses length:', responseData?.differentialDiagnoses?.length);
      
      if (responseData && hasDiagnoses) {
        this.logger.log(`CDSS returned ${responseData.suggested_diagnoses?.length || responseData.differentialDiagnoses?.length} diagnoses`);
        return responseData;
      }
      
      // If Python service returns empty, use fallback
      console.warn('[CDSS] Empty response from Python, using fallback');
      this.logger.warn(`CDSS returned empty diagnoses (suggested_diagnoses: ${responseData?.suggested_diagnoses?.length || 0}, differentialDiagnoses: ${responseData?.differentialDiagnoses?.length || 0}), using fallback`);
      return this.basicDiagnosisAssist(symptoms);
    } catch (error: any) {
      this.logger.warn(`CDSS diagnostic assistance unavailable: ${error.message}`);
      this.logger.log(`CDSS error details: ${error.code || 'unknown'} - ${error.message}`);
      // Fallback to basic logic
      return this.basicDiagnosisAssist(symptoms);
    }
  }

  /**
   * Basic diagnostic assistance (fallback) - DISABLED
   */
  private async basicDiagnosisAssist(symptoms: any) {
    this.logger.warn(`[FALLBACK] Basic diagnosis assist triggered but disabled to prevent fake data.`);
    
    return {
      suggested_diagnoses: [],
      recommended_tests: [],
      red_flags: [],
      differentialDiagnoses: [],
      recommendedTests: [],
      urgencyLevel: 'unknown',
      source: 'fallback_empty',
      error: 'CDSS service unavailable'
    };
  }

  /**
   * Get clinical guidelines from Python CDSS service
   * Now integrates WHO Smart Guidelines if available
   */
  async getGuidelines(condition: string, patientData?: any, tenantId?: string) {
    // Try WHO Smart Guidelines first (if service available)
    if (this.whoSmartGuidelinesService) {
      try {
        const whoGuidelines = await this.whoSmartGuidelinesService.getRecommendations(condition, patientData);
        if (whoGuidelines && whoGuidelines.length > 0) {
          this.logger.log(`Using WHO Smart Guidelines for: ${condition}`);
          return {
            guidelines: whoGuidelines.map(g => ({
              title: g.title,
              description: g.description,
              source: 'WHO Smart Guidelines',
              priority: g.priority
            })),
            recommendations: whoGuidelines.map(g => g.description),
            contraindications: [],
            medication_warnings: [],
            evidence_level: 'high', // WHO Smart Guidelines are evidence-based
            matched_condition: condition,
            source: 'who_smart_guidelines',
            whoGuidelines: whoGuidelines
          };
        }
      } catch (error: any) {
        this.logger.debug(`WHO Smart Guidelines not available: ${error.message}`);
        // Continue to CDSS guidelines
      }
    }
    
    // Fallback to CDSS guidelines
    try {
      const response = await this.cdssClient.post('/guidelines/check', {
        condition,
        patient_age: patientData?.age,
        patient_gender: patientData?.gender,
        comorbidities: patientData?.comorbidities || patientData?.conditions || [],
        medications: patientData?.medications || [],
      }, this.buildCdssRequestConfig(10000, tenantId));

      return {
        guidelines: response.data.guidelines || [],
        recommendations: response.data.recommendations || [],
        contraindications: response.data.contraindications || [],
        medication_warnings: response.data.medication_warnings || [],
        evidence_level: response.data.evidence_level,
        matched_condition: response.data.matched_condition,
        source: 'advanced_cdss',
      };
    } catch (error: any) {
      this.logger.warn(`CDSS guidelines unavailable: ${error.message}`);
      // Fallback to basic guidelines
      return this.basicGetGuidelines(condition);
    }
  }

  /**
   * Search for clinical guidelines using RAG and WHO Smart Guidelines
   */
  async searchGuidelines(query: string, limit: number = 5, patientContext?: any, tenantId?: string) {
    const results = {
      query,
      citations: [],
      count: 0,
      error: null
    };

    try {
      // 1. Search WHO Smart Guidelines (Local)
      if (this.whoSmartGuidelinesService) {
        try {
          const whoResults = await this.whoSmartGuidelinesService.search(query);
          if (whoResults.length > 0) {
            results.citations.push(...whoResults.map(r => ({
              title: r.title,
              text: r.description || r.title,
              source: r.source,
              url: null,
              score: 1.0 // High confidence for local matches
            })));
          }
        } catch (err) {
          this.logger.warn(`WHO Smart Guidelines search failed: ${err.message}`);
        }
      }

      // 2. Search External CDSS (RAG)
      try {
        const response = await this.cdssClient.post('/guidelines/search', {
          query,
          limit,
          patient_context: patientContext
        }, this.buildCdssRequestConfig(15000, tenantId));
        if (response.data && response.data.citations) {
          results.citations.push(...response.data.citations);
        }
      } catch (error: any) {
        this.logger.warn(`CDSS guideline search failed: ${error.message}`);
      }
      
      // If no results found (either from WHO or CDSS), use fallback
      if (results.citations.length === 0) {
        this.logger.log('No guidelines found from external sources, using basic fallback');
        const fallback = this.basicSearchGuidelines(query);
        results.citations = fallback.citations;
      }
      
      results.count = results.citations.length;
      return results;
      
    } catch (error: any) {
      this.logger.error(`Unexpected error in searchGuidelines: ${error.message}`);
      return {
        query,
        citations: [],
        count: 0,
        error: error.message
      };
    }
  }

  /**
   * Basic guideline search (fallback) - NOW DISABLED to prevent fake data
   */
  private basicSearchGuidelines(query: string) {
    // We intentionally return empty results here to avoid showing
    // hardcoded/outdated/fake guidelines when the AI service is down.
    this.logger.warn(`[FALLBACK] Basic search triggered for query "${query}" but disabled to prevent fake data.`);
    
    return {
      query,
      citations: [],
      count: 0,
      error: null
    };
  }

  /**
   * Basic guidelines (fallback) - NOW DISABLED to prevent fake data
   */
  private async basicGetGuidelines(condition: string) {
    // Return empty/generic structure to avoid hardcoded fake guidelines
    return {
      guidelines: [{ condition, guidelines: ['Guideline service unavailable'] }],
      recommendations: [],
      contraindications: [],
      medication_warnings: [],
      evidence_level: 'unknown',
      matched_condition: condition,
      source: 'fallback_empty',
    };
  }

  /**
   * Risk assessment using Python CDSS service with historical data
   */
  async riskAssessment(patientData: any, tenantDb?: DataSource, tenantId?: string) {
    this.logger.log(`[CDSS] ========== riskAssessment ENTRY ==========`);
    this.logger.log(`[CDSS] patientData keys: ${Object.keys(patientData || {}).join(', ')}`);
    this.logger.log(`[CDSS] tenantDb type: ${typeof tenantDb}`);
    this.logger.log(`[CDSS] tenantDb is DataSource: ${tenantDb instanceof DataSource}`);
    this.logger.log(`[CDSS] tenantDb exists: ${!!tenantDb}`);
    
    try {
      const { patientId, age, gender, vitals, medicalHistory, medications, diagnoses, labResults } = patientData;
      this.logger.log(`[CDSS] Extracted patientId: ${patientId}`);
      
      // Fetch historical data if database connection available
      let historicalData: any = {};
      
      // Always try to fetch historical data if we have tenantDb and patientId
      if (tenantDb && patientId) {
        this.logger.log(`[CDSS] ✅ Conditions met - attempting to fetch historical data`);
        try {
          this.logger.log(`[CDSS] Calling fetchPatientHistory for patient: ${patientId}`);
          historicalData = await this.fetchPatientHistory(patientId, tenantDb);
          this.logger.log(`[CDSS] ✅ fetchPatientHistory completed`);
          this.logger.log(`[CDSS] Historical data: ${JSON.stringify({
            totalVisits: historicalData.totalVisits,
            totalVitals: historicalData.totalVitals,
            hasHistoricalVitals: !!(historicalData.historicalVitals && historicalData.historicalVitals.length > 0),
            hasVisitHistory: !!(historicalData.visitHistory && historicalData.visitHistory.length > 0)
          })}`);
        } catch (error: any) {
          this.logger.error(`[CDSS] ❌ ERROR in fetchPatientHistory: ${error.message}`);
          this.logger.error(`[CDSS] Error name: ${error.name}`);
          this.logger.error(`[CDSS] Error stack: ${error.stack?.substring(0, 500)}`);
        }
      } else {
        this.logger.warn(`[CDSS] ⚠️ Conditions NOT met - tenantDb: ${!!tenantDb}, patientId: ${patientId || 'undefined'}`);
        historicalData = {
          totalVisits: 0,
          totalVitals: 0,
          historicalVitals: [],
          visitHistory: [],
          daysSinceLastVisit: null
        };
      }
      
      // Format vitals for CDSS service with historical context
      const formattedVitals: any = {
        ...vitals,
        age: age || vitals?.age,
        patient_age: age || vitals?.patient_age,
        gender: gender || vitals?.gender,
        patient_gender: gender || vitals?.patient_gender,
        // Add historical visit data
        previousAdmissions: historicalData.previousAdmissions || 0,
        edVisits: historicalData.edVisits || 0,
        totalVisits: historicalData.totalVisits || 0,
        daysSinceLastVisit: historicalData.daysSinceLastVisit || null,
      };

      const requestPayload: any = {
        patient_id: patientId || 'unknown',
        vitals: formattedVitals,
        medications: medications || [],
        diagnoses: diagnoses || medicalHistory || [],
        lab_results: labResults,
      };

      // Add historical data for trend analysis if available
      if (historicalData.historicalVitals && historicalData.historicalVitals.length > 0) {
        requestPayload.historical_vitals = historicalData.historicalVitals;
      }
      if (historicalData.visitHistory && historicalData.visitHistory.length > 0) {
        requestPayload.visit_history = historicalData.visitHistory;
      }

      const response = await this.cdssClient.post('/risk/calculate', requestPayload, this.buildCdssRequestConfig(15000, tenantId));

      // Merge trend analysis if available
      const result: any = {
        overall_score: response.data.overall_score,
        risk_level: response.data.risk_level,
        factors: response.data.factors || [],
        recommendations: response.data.recommendations || [],
        guideline_citations: response.data.guideline_citations || [],
        source: 'advanced_cdss',
      };

      // Add historical context
      if (historicalData.totalVisits > 0) {
        result.historical_context = {
          total_visits: historicalData.totalVisits,
          days_since_last_visit: historicalData.daysSinceLastVisit,
          previous_admissions: historicalData.previousAdmissions,
          ed_visits: historicalData.edVisits,
        };
      }

      // Add trend analysis if available
      if (response.data.trends) {
        result.trends = response.data.trends;
      }
      
      // Add visit patterns if available
      if (response.data.visit_patterns) {
        result.visit_patterns = response.data.visit_patterns;
      }

      return result;
    } catch (error: any) {
      this.logger.warn(`CDSS risk assessment unavailable: ${error.message}`);
      // Fallback to basic risk assessment
      return this.basicRiskAssessment(patientData);
    }
  }

  /**
   * Fetch patient historical data for CDSS analysis
   */
  /**
   * Interpret lab results
   */
  async interpretLabResults(labResults: any, historicalLabs?: any[]) {
    try {
      const response = await this.cdssClient.post('/labs/interpret', {
        lab_results: labResults,
        historical_labs: historicalLabs || []
      }, {
        timeout: 15000,
      });
      return response.data;
    } catch (error: any) {
      this.logger.warn(`CDSS lab interpretation unavailable: ${error.message}`);
      return {
        interpretations: [],
        summary: { total_tests: 0, normal: 0, abnormal: 0, critical: 0 },
        critical_alerts: [],
        warnings: ['CDSS service unavailable - results not interpreted'],
        recommendations: ['Manual interpretation required'],
        source: 'error'
      };
    }
  }

  /**
   * Detect duplicate therapy
   */
  async detectDuplicateTherapy(medications: any[], prescriptions?: any[]) {
    try {
      const response = await this.cdssClient.post('/medications/duplicates', {
        medications,
        prescriptions: prescriptions || []
      }, {
        timeout: 15000,
      });
      return response.data;
    } catch (error: any) {
      this.logger.warn(`CDSS duplicate therapy detection unavailable: ${error.message}`);
      return {
        has_duplicates: false, // Default to false but warn
        duplicates: [],
        warnings: ['CDSS service unavailable - duplicate check failed'],
        summary: { total_medications: medications.length },
        source: 'error'
      };
    }
  }

  /**
   * Check high-risk medications
   */
  async checkHighRiskMedications(
    medications: any[],
    patientAge?: number,
    patientGender?: string,
    diagnoses?: string[],
    renalFunction?: number
  ) {
    try {
      const response = await this.cdssClient.post('/medications/high-risk', {
        medications,
        patient_age: patientAge,
        patient_gender: patientGender,
        diagnoses: diagnoses || [],
        renal_function: renalFunction
      }, {
        timeout: 15000,
      });
      return response.data;
    } catch (error: any) {
      this.logger.warn(`CDSS high-risk medication check unavailable: ${error.message}`);
      return {
        has_high_risk_medications: false, // Default to false but warn
        beers_criteria_alerts: [],
        stopp_criteria_alerts: [],
        high_alert_medications: [],
        summary: { total_medications: medications.length },
        warnings: ['CDSS service unavailable - high risk check failed'],
        source: 'error'
      };
    }
  }

  /**
   * Detect care gaps
   */
  async detectCareGaps(
    patientAge?: number,
    patientGender?: string,
    visitHistory?: any[],
    diagnoses?: string[]
  ) {
    try {
      const response = await this.cdssClient.post('/care-gaps/detect', {
        patient_age: patientAge,
        patient_gender: patientGender,
        visit_history: visitHistory || [],
        diagnoses: diagnoses || []
      }, {
        timeout: 15000,
      });
      return response.data;
    } catch (error: any) {
      this.logger.warn(`CDSS care gap detection unavailable: ${error.message}`);
      return {
        has_gaps: false, // Default to false but warn
        gaps: [],
        recommendations: [],
        warnings: ['CDSS service unavailable - care gap detection failed'],
        source: 'error'
      };
    }
  }

  /**
   * Check drug–food interactions
   */
  async checkFoodInteractions(medications: any[]) {
    try {
      const response = await this.cdssClient.post('/medications/food-interactions', {
        medications,
      }, {
        timeout: 15000,
      });
      return response.data;
    } catch (error: any) {
      this.logger.warn(`CDSS food interaction check unavailable: ${error.message}`);
      return {
        interactions: [],
        summary: { major: 0, moderate: 0 },
        recommendations: ['Food interaction service unavailable'],
        source: 'error'
      };
    }
  }

  private async fetchPatientHistory(patientId: string, tenantDb: DataSource) {
    this.logger.log(`[CDSS] fetchPatientHistory START - patientId: ${patientId}`);
    try {
      this.logger.log(`[CDSS] Importing entities...`);
      const { AppointmentSimple } = await import('../entities/appointment-simple.entity');
      const { Vitals } = await import('../entities/vitals.entity');
      this.logger.log(`[CDSS] Entities imported successfully`);
      
      this.logger.log(`[CDSS] Getting repositories...`);
      const appointmentRepo = tenantDb.getRepository(AppointmentSimple);
      const vitalsRepo = tenantDb.getRepository(Vitals);
      this.logger.log(`[CDSS] Repositories obtained`);
      
      // Fetch all appointments
      this.logger.log(`[CDSS] Querying appointments for patientId: ${patientId}`);
      const appointments = await appointmentRepo.find({
        where: { patientId },
        order: { appointmentDate: 'DESC' },
        take: 50, // Last 50 visits
      });
      this.logger.log(`[CDSS] Found ${appointments.length} appointments`);
      
      // Fetch all vitals
      this.logger.log(`[CDSS] Querying vitals for patientId: ${patientId}`);
      const vitals = await vitalsRepo.find({
        where: { patientId },
        order: { recordedAt: 'DESC' },
        take: 50, // Last 50 vitals
      });
      this.logger.log(`[CDSS] Found ${vitals.length} vitals records`);
      
      // Calculate visit statistics
      const completedAppointments = appointments.filter(a => a.status === 'completed');
      const urgentVisits = appointments.filter(a => a.priorityLevel === 'urgent' || a.priorityLevel === 'high');
      
      // Calculate days since last visit
      let daysSinceLastVisit: number | null = null;
      if (appointments.length > 0) {
        const lastVisit = appointments[0].appointmentDate;
        const now = new Date();
        daysSinceLastVisit = Math.floor((now.getTime() - new Date(lastVisit).getTime()) / (1000 * 60 * 60 * 24));
      }
      
      // Format historical vitals for trend analysis
      const historicalVitals = vitals.map(v => ({
        bloodPressure: v.bloodPressure,
        heartRate: v.heartRate,
        temperature: v.temperature,
        weight: v.weight,
        oxygenSaturation: v.oxygenSaturation,
        recordedAt: v.recordedAt?.toISOString() || new Date().toISOString(),
      }));
      
      // Format visit history
      const visitHistory = appointments.map(a => ({
        appointmentDate: a.appointmentDate?.toISOString() || new Date().toISOString(),
        appointmentType: a.appointmentType,
        status: a.status,
        priorityLevel: a.priorityLevel,
        reason: a.reason,
        notes: a.notes,
      }));
      
      return {
        totalVisits: appointments.length,
        completedVisits: completedAppointments.length,
        urgentVisits: urgentVisits.length,
        previousAdmissions: urgentVisits.length, // Simplified - could track actual admissions
        edVisits: urgentVisits.filter(v => v.priorityLevel === 'urgent').length,
        daysSinceLastVisit,
        historicalVitals,
        visitHistory,
        totalVitals: vitals.length,
      };
    } catch (error: any) {
      this.logger.error(`Error fetching patient history: ${error.message}`);
      return {};
    }
  }

  /**
   * Basic risk assessment (fallback) - DISABLED
   */
  private async basicRiskAssessment(patientData: any) {
    this.logger.warn(`[FALLBACK] Basic risk assessment triggered but disabled to prevent fake data.`);

    return {
      overall_score: 0,
      risk_level: 'unknown',
      factors: [],
      recommendations: [],
      source: 'fallback_empty',
      error: 'CDSS service unavailable'
    };
  }

  async allergyCheck(patientId: string, medication: string, tenantDb: DataSource) {
    const patientRepository = tenantDb.getRepository(Patient);
    const patient = await patientRepository.findOne({ where: { id: patientId } });
    
    if (!patient) {
      throw new Error('Patient not found');
    }

    const allergies = patient.allergies?.toLowerCase() || '';
    const medicationLower = medication.toLowerCase();
    
    const hasAllergy = allergies.includes(medicationLower) || 
                     allergies.includes('penicillin') && medicationLower.includes('penicillin') ||
                     allergies.includes('sulfa') && medicationLower.includes('sulfa');

    return {
      hasAllergy,
      medication,
      patientAllergies: patient.allergies,
      recommendation: hasAllergy ? 
        'CONTRAINDICATED - Patient has known allergy' : 
        'Safe to prescribe - No known allergies'
    };
  }

  /**
   * Get dosing recommendations from Python CDSS service
   */
  async getDosingRecommendation(dosingRequest: any) {
    try {
      const response = await this.cdssClient.post('/dosing/recommend', {
        drug_name: dosingRequest.drug_name,
        patient_age: dosingRequest.patient_age,
        patient_weight_kg: dosingRequest.patient_weight_kg,
        patient_gender: dosingRequest.patient_gender,
        eGFR: dosingRequest.eGFR,
        serum_creatinine: dosingRequest.serum_creatinine,
        crCl: dosingRequest.crCl,
        hepatic_function: dosingRequest.hepatic_function,
        standard_dose: dosingRequest.standard_dose,
      }, {
        timeout: 10000,
      });

      return {
        ...response.data,
        source: 'advanced_cdss',
      };
    } catch (error: any) {
      this.logger.warn(`CDSS dosing recommendation unavailable: ${error.message}`);
      return {
        recommended_dose: null, // Do not provide a fallback dose
        frequency: 'unknown',
        adjustments: [],
        warnings: ['CDSS service unavailable - Cannot provide dosing recommendation'],
        monitoring: [],
        drug_name: dosingRequest.drug_name,
        source: 'error',
      };
    }
  }
}
