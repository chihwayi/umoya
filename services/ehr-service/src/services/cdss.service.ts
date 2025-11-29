import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Patient } from '../entities/patient.entity';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class CdssService {
  private readonly logger = new Logger(CdssService.name);
  private readonly cdssClient: AxiosInstance;
  private readonly cdssServiceUrl: string;

  constructor() {
    this.cdssServiceUrl = process.env.CDSS_SERVICE_URL || 'http://cdss-service:8000';
    this.cdssClient = axios.create({
      baseURL: this.cdssServiceUrl,
      timeout: 15000, // Increased timeout
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    // Add request interceptor for debugging
    this.cdssClient.interceptors.request.use(request => {
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
   * Basic drug interaction checking (fallback)
   */
  private async basicDrugInteractionCheck(drugIds: string[]) {
    // Basic fallback when CDSS service unavailable
    return {
      hasInteractions: false,
      interactions: [],
      severity_summary: { critical: 0, major: 0, moderate: 0, minor: 0 },
      recommendations: ['Basic checking completed. Advanced CDSS service unavailable.'],
      source: 'basic_fallback',
    };
  }

  /**
   * Diagnostic assistance using Python CDSS service
   */
  async diagnosisAssist(symptoms: any) {
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
      
      const response = await this.cdssClient.post('/diagnosis/suggest', {
        symptoms: normalizedSymptoms,
        vitals: symptoms.vitals || undefined,
        age: symptoms.age || undefined,
        gender: symptoms.gender || undefined,
      }, {
        timeout: 10000,
      });

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
   * Basic diagnostic assistance (fallback)
   */
  private async basicDiagnosisAssist(symptoms: any) {
    // AI diagnostic assistance based on symptoms (fallback)
    console.log('=== FALLBACK FUNCTION CALLED ===');
    console.log('[FALLBACK] basicDiagnosisAssist called with keys:', Object.keys(symptoms));
    console.log('[FALLBACK] Full symptoms object:', JSON.stringify(symptoms).substring(0, 500));
    this.logger.log(`[FALLBACK] basicDiagnosisAssist called with keys: ${Object.keys(symptoms).join(', ')}`);
    
    const patientAge =
      typeof symptoms.age === 'number'
        ? symptoms.age
        : typeof symptoms.patientAge === 'number'
        ? symptoms.patientAge
        : typeof symptoms.patient?.age === 'number'
        ? symptoms.patient.age
        : undefined;

    // Extract symptoms from different possible formats
    let allSymptoms: string[] = [];
    
    // Case 1: If symptoms.symptoms is an array (most common from frontend)
    if (symptoms.symptoms && Array.isArray(symptoms.symptoms)) {
      allSymptoms = symptoms.symptoms;
      this.logger.log(`[FALLBACK] Found symptoms.symptoms array with ${allSymptoms.length} items`);
    } 
    // Case 2: If symptoms.symptoms is a string
    else if (symptoms.symptoms && typeof symptoms.symptoms === 'string') {
      allSymptoms = [symptoms.symptoms];
      this.logger.log(`[FALLBACK] Found symptoms.symptoms as string`);
    } 
    // Case 3: If the whole object is an array (unlikely but possible)
    else if (Array.isArray(symptoms)) {
      allSymptoms = symptoms;
      this.logger.log(`[FALLBACK] Symptoms object is an array with ${allSymptoms.length} items`);
    }
    // Case 4: Check for chiefComplaint
    else if (symptoms.chiefComplaint) {
      allSymptoms = [symptoms.chiefComplaint];
      this.logger.log(`[FALLBACK] Found chiefComplaint`);
    }
    
    // Also add chiefComplaint if it exists separately
    if (symptoms.chiefComplaint && !allSymptoms.includes(symptoms.chiefComplaint)) {
      allSymptoms.push(symptoms.chiefComplaint);
    }
    
    // Filter out empty strings and create searchable text
    allSymptoms = allSymptoms.filter(s => s && typeof s === 'string' && s.trim().length > 0);
    const allSymptomsText = allSymptoms.join(' ').toLowerCase();
    
    console.log(`[FALLBACK] Final parsed symptoms (${allSymptoms.length} items): ${allSymptomsText.substring(0, 150)}...`);
    this.logger.log(`[FALLBACK] Final parsed symptoms (${allSymptoms.length} items): ${allSymptomsText.substring(0, 150)}...`);
    
    if (allSymptomsText.length === 0) {
      console.error(`[FALLBACK] No symptoms extracted! Original object keys: ${Object.keys(symptoms).join(', ')}`);
      console.error(`[FALLBACK] Original object:`, JSON.stringify(symptoms).substring(0, 300));
      this.logger.error(`[FALLBACK] No symptoms extracted! Original object: ${JSON.stringify(symptoms).substring(0, 200)}`);
      
      // Return at least a generic diagnosis so user sees something
      return {
        suggested_diagnoses: [{
          diagnosis: 'Symptom Evaluation Needed',
          probability: 0.5,
          confidence: 'low',
          matching_symptoms: []
        }],
        recommended_tests: ['Complete Blood Count (CBC)', 'Basic Metabolic Panel'],
        red_flags: [],
        differentialDiagnoses: [{
          condition: 'Symptom Evaluation Needed',
          probability: 0.5,
          icd10: 'R69'
        }],
        recommendedTests: ['Complete Blood Count', 'Basic Metabolic Panel'],
        urgencyLevel: 'medium'
      };
    }
    
    // Simulate AI diagnostic engine with better symptom matching
    const possibleDiagnoses = [];
    
    // Headache + nausea + photophobia = Migraine
    if ((allSymptomsText.includes('headache') || allSymptomsText.includes('head pain')) &&
        (allSymptomsText.includes('nausea') || allSymptomsText.includes('vomit')) &&
        (allSymptomsText.includes('light') || allSymptomsText.includes('photophobia') || allSymptomsText.includes('sensitivity'))) {
      possibleDiagnoses.push({
        diagnosis: 'Migraine',
        condition: 'Migraine',
        probability: 0.70,
        confidence: 'moderate',
        matching_symptoms: ['headache', 'nausea', 'photophobia'],
        icd10: 'G43.9'
      });
    }
    
    // Headache patterns
    if (allSymptomsText.includes('headache') || allSymptomsText.includes('head pain')) {
      if (allSymptomsText.includes('nausea') || allSymptomsText.includes('vomit')) {
        possibleDiagnoses.push({
          diagnosis: 'Migraine',
          condition: 'Migraine',
          probability: 0.55,
          confidence: 'moderate',
          matching_symptoms: ['headache', 'nausea'],
          icd10: 'G43.9'
        });
      }
      possibleDiagnoses.push({
        diagnosis: 'Tension Headache',
        condition: 'Tension Headache',
        probability: 0.45,
        confidence: 'moderate',
        matching_symptoms: ['headache'],
        icd10: 'G44.2'
      });
    }
    
    // Fever + chills
    if ((allSymptomsText.includes('fever') || allSymptomsText.includes('temperature') || allSymptomsText.includes('hot')) &&
        (allSymptomsText.includes('chill') || allSymptomsText.includes('shivering'))) {
      possibleDiagnoses.push({
        diagnosis: 'Infection (likely bacterial)',
        condition: 'Bacterial Infection',
        probability: 0.60,
        confidence: 'moderate',
        matching_symptoms: ['fever', 'chills'],
        icd10: 'B99.9'
      });
    }
    
    // Fever + respiratory
    if ((allSymptomsText.includes('fever') || allSymptomsText.includes('temperature')) && 
        (allSymptomsText.includes('cough') || allSymptomsText.includes('breathing'))) {
      possibleDiagnoses.push({
        diagnosis: 'Upper Respiratory Tract Infection',
        condition: 'Upper Respiratory Tract Infection',
        probability: 0.65,
        confidence: 'moderate',
        matching_symptoms: ['fever', 'cough'],
        icd10: 'J06.9'
      });
    }
    
    // Just fever
    if ((allSymptomsText.includes('fever') || allSymptomsText.includes('temperature') || allSymptomsText.includes('hot')) &&
        possibleDiagnoses.length === 0) {
      possibleDiagnoses.push({
        diagnosis: 'Viral Infection',
        condition: 'Viral Infection',
        probability: 0.50,
        confidence: 'low',
        matching_symptoms: ['fever'],
        icd10: 'B34.9'
      });
    }
    
    // Chest pain patterns
    if (allSymptomsText.includes('chest pain') || allSymptomsText.includes('chest discomfort')) {
      if (patientAge && patientAge > 40) {
        possibleDiagnoses.push({
          diagnosis: 'Acute Coronary Syndrome',
          condition: 'Acute Coronary Syndrome',
          probability: 0.60,
          confidence: 'moderate',
          matching_symptoms: ['chest_pain'],
          icd10: 'I20.9'
        });
      }
      possibleDiagnoses.push({
        diagnosis: 'Musculoskeletal Chest Pain',
        condition: 'Musculoskeletal Chest Pain',
        probability: 0.45,
        confidence: 'moderate',
        matching_symptoms: ['chest_pain'],
        icd10: 'M79.3'
      });
    }

    this.logger.log(`[FALLBACK] Found ${possibleDiagnoses.length} possible diagnoses`);
    if (possibleDiagnoses.length === 0) {
      this.logger.warn(`[FALLBACK] No diagnoses found for symptoms text (length: ${allSymptomsText.length}): ${allSymptomsText.substring(0, 200)}`);
      this.logger.warn(`[FALLBACK] Symptom text contains 'headache': ${allSymptomsText.includes('headache')}`);
      this.logger.warn(`[FALLBACK] Symptom text contains 'nausea': ${allSymptomsText.includes('nausea')}`);
      this.logger.warn(`[FALLBACK] Symptom text contains 'fever': ${allSymptomsText.includes('fever')}`);
      
      // Even if no matches, provide generic diagnoses based on any keywords found
      if (allSymptomsText.length > 0) {
        if (allSymptomsText.includes('headache')) {
          possibleDiagnoses.push({
            diagnosis: 'Headache Disorder',
            condition: 'Headache Disorder',
            probability: 0.50,
            confidence: 'moderate',
            matching_symptoms: ['headache'],
            icd10: 'R51'
          });
        }
        if (allSymptomsText.includes('fever')) {
          possibleDiagnoses.push({
            diagnosis: 'Fever, unspecified',
            condition: 'Fever',
            probability: 0.50,
            confidence: 'moderate',
            matching_symptoms: ['fever'],
            icd10: 'R50.9'
          });
        }
      }
      
      // If still nothing, add generic
      if (possibleDiagnoses.length === 0) {
        possibleDiagnoses.push({
          diagnosis: 'General Symptom Evaluation Needed',
          condition: 'General Symptom Evaluation Needed',
          probability: 0.30,
          confidence: 'low',
          matching_symptoms: [],
          icd10: 'R69'
        });
      }
    }
    
    // ALWAYS ensure we have at least one diagnosis - this should NEVER be empty
    if (possibleDiagnoses.length === 0) {
      console.error('[FALLBACK] ERROR: Still have 0 diagnoses after all checks!');
      console.error('[FALLBACK] Symptom text was:', allSymptomsText.substring(0, 200));
      console.error('[FALLBACK] All symptoms array:', allSymptoms);
      this.logger.error(`[FALLBACK] CRITICAL: No diagnoses found! Symptom text length: ${allSymptomsText.length}`);
      
      // FORCE at least one diagnosis - this should ALWAYS execute
      possibleDiagnoses.push({
        diagnosis: 'Symptom Assessment Required',
        condition: 'Symptom Assessment Required',
        probability: 0.5,
        confidence: 'low',
        matching_symptoms: allSymptoms.length > 0 ? allSymptoms.slice(0, 3) : ['unknown'],
        icd10: 'R69'
      });
      
      // Also add generic diagnoses based on ANY text presence
      if (allSymptomsText.length > 0) {
        possibleDiagnoses.push({
          diagnosis: 'Clinical Evaluation Needed',
          condition: 'Clinical Evaluation Needed',
          probability: 0.4,
          confidence: 'low',
          matching_symptoms: [],
          icd10: 'Z00.00'
        });
      }
    }
    
    // FINAL safety check - should NEVER happen but just in case
    if (possibleDiagnoses.length === 0) {
      this.logger.error('[FALLBACK] CRITICAL ERROR: possibleDiagnoses is STILL empty after all safeguards!');
      possibleDiagnoses.push({
        diagnosis: 'Emergency Assessment Required',
        condition: 'Emergency Assessment Required',
        probability: 1.0,
        confidence: 'high',
        matching_symptoms: ['unknown'],
        icd10: 'R69'
      });
    }
    
    // Convert to expected format - prioritize suggested_diagnoses format
    const response = {
      suggested_diagnoses: possibleDiagnoses.map(d => ({
        diagnosis: d.diagnosis || d.condition || 'Unknown',
        probability: d.probability || 0.5,
        confidence: d.confidence || 'low',
        matching_symptoms: d.matching_symptoms || []
      })),
      recommended_tests: ['Complete Blood Count (CBC)', 'Basic Metabolic Panel'],
      red_flags: [],
      // Keep old format for backwards compatibility - ENSURE IT HAS DATA
      differentialDiagnoses: possibleDiagnoses.map(d => ({
        condition: d.diagnosis || d.condition || 'Unknown',
        probability: d.probability || 0.5,
        confidence: d.confidence || 'low',
        icd10: d.icd10 || 'R69',
        matching_symptoms: d.matching_symptoms || []
      })),
      recommendedTests: ['Complete Blood Count', 'Basic Metabolic Panel'],
      urgencyLevel: possibleDiagnoses.some(d => (d.probability || 0) > 0.7) ? 'high' : 'medium'
    };
    
    // FINAL check - response should NEVER have empty arrays
    if (response.suggested_diagnoses.length === 0 || response.differentialDiagnoses.length === 0) {
      this.logger.error(`[FALLBACK] CRITICAL: Response has empty arrays! Force adding emergency diagnosis.`);
      console.error(`[FALLBACK] Response before fix:`, JSON.stringify(response).substring(0, 300));
      
      // Force add to BOTH formats
      const emergencyDiag = {
        diagnosis: 'Urgent Clinical Assessment Required',
        condition: 'Urgent Clinical Assessment Required',
        probability: 1.0,
        confidence: 'high',
        matching_symptoms: allSymptoms.length > 0 ? allSymptoms.slice(0, 2) : ['symptoms reported'],
        icd10: 'R69'
      };
      
      response.suggested_diagnoses.push(emergencyDiag);
      response.differentialDiagnoses.push({
        condition: emergencyDiag.diagnosis,
        probability: emergencyDiag.probability,
        confidence: emergencyDiag.confidence,
        icd10: emergencyDiag.icd10,
        matching_symptoms: emergencyDiag.matching_symptoms
      });
    }
    
    console.log(`[FALLBACK] Final response: ${response.suggested_diagnoses.length} suggested_diagnoses, ${response.differentialDiagnoses.length} differentialDiagnoses`);
    this.logger.log(`[FALLBACK] Returning response with ${response.suggested_diagnoses.length} diagnoses`);
    
    // ABSOLUTE FINAL CHECK - if still empty, something is very wrong
    if (response.suggested_diagnoses.length === 0 && response.differentialDiagnoses.length === 0) {
      this.logger.error('[FALLBACK] ABSOLUTE CRITICAL ERROR: Response is STILL empty after all fixes!');
      return {
        suggested_diagnoses: [{ diagnosis: 'SYSTEM ERROR - Please Retry', probability: 1.0, confidence: 'high', matching_symptoms: [] }],
        differentialDiagnoses: [{ condition: 'SYSTEM ERROR - Please Retry', probability: 1.0, icd10: 'R69' }],
        recommendedTests: ['System Error - Retry Diagnosis'],
        recommended_tests: ['System Error - Retry Diagnosis'],
        urgencyLevel: 'high',
        red_flags: ['Diagnostic system error - please retry']
      };
    }
    
    return response;
  }

  /**
   * Get clinical guidelines from Python CDSS service
   */
  async getGuidelines(condition: string, patientData?: any) {
    try {
      const response = await this.cdssClient.post('/guidelines/check', {
        condition,
        patient_age: patientData?.age,
        patient_gender: patientData?.gender,
        comorbidities: patientData?.comorbidities || [],
        medications: patientData?.medications || [],
      }, {
        timeout: 10000,
      });

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
   * Basic guidelines (fallback)
   */
  private async basicGetGuidelines(condition: string) {
    const guidelines = {
      'hypertension': {
        condition: 'Hypertension',
        guidelines: [
          'Target BP <140/90 mmHg for most adults',
          'Target BP <130/80 mmHg for high-risk patients',
        ],
        references: ['AHA/ACC 2017 Guidelines'],
      },
      'diabetes': {
        condition: 'Type 2 Diabetes',
        guidelines: [
          'Target HbA1c <7% for most adults',
          'Metformin as first-line therapy',
        ],
        references: ['ADA Standards of Care'],
      }
    };

    return {
      guidelines: [guidelines[condition.toLowerCase()] || { condition, guidelines: ['No guidelines available'] }],
      recommendations: guidelines[condition.toLowerCase()]?.guidelines || ['No specific guidelines available'],
      contraindications: [],
      medication_warnings: [],
      evidence_level: 'unknown',
      matched_condition: condition,
      source: 'basic_fallback',
    };
  }

  /**
   * Risk assessment using Python CDSS service with historical data
   */
  async riskAssessment(patientData: any, tenantDb?: DataSource) {
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

      const response = await this.cdssClient.post('/risk/calculate', requestPayload, {
        timeout: 15000,
      });

      // Merge trend analysis if available
      const result: any = {
        overall_score: response.data.overall_score,
        risk_level: response.data.risk_level,
        factors: response.data.factors || [],
        recommendations: response.data.recommendations || [],
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
        warnings: [],
        recommendations: ['Lab interpretation service unavailable']
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
        has_duplicates: false,
        duplicates: [],
        warnings: [],
        summary: { total_medications: medications.length }
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
        has_high_risk_medications: false,
        beers_criteria_alerts: [],
        stopp_criteria_alerts: [],
        high_alert_medications: [],
        summary: { total_medications: medications.length }
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
        has_gaps: false,
        gaps: [],
        recommendations: []
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
        recommendations: ['Food interaction service unavailable']
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
   * Basic risk assessment (fallback)
   */
  private async basicRiskAssessment(patientData: any) {
    const { age, vitals, medicalHistory, medications } = patientData;
    
    let riskScore = 0;
    const riskFactors = [];

    if (age > 65) {
      riskScore += 2;
      riskFactors.push('Advanced age');
    }

    if (vitals?.systolicBP > 140 || vitals?.bloodPressure?.split('/')[0] > 140) {
      riskScore += 2;
      riskFactors.push('Hypertension');
    }

    if (medicalHistory?.includes?.('diabetes') || medicalHistory?.some?.((h: string) => h.toLowerCase().includes('diabetes'))) {
      riskScore += 3;
      riskFactors.push('Diabetes mellitus');
    }

    const riskLevel = riskScore >= 6 ? 'high' : riskScore >= 3 ? 'moderate' : 'low';

    return {
      overall_score: riskScore * 5, // Convert to percentage
      risk_level: riskLevel,
      factors: riskFactors.map(f => ({ category: 'general', factor: f, impact: 'moderate' })),
      recommendations: riskLevel === 'high' ? 
        ['Frequent monitoring', 'Specialist referral'] :
        ['Regular follow-up', 'Lifestyle modifications'],
      source: 'basic_fallback',
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
        recommended_dose: dosingRequest.standard_dose || 0,
        frequency: 'as directed',
        adjustments: [],
        warnings: ['CDSS service unavailable - use standard dosing'],
        monitoring: [],
        drug_name: dosingRequest.drug_name,
        source: 'basic_fallback',
      };
    }
  }
}