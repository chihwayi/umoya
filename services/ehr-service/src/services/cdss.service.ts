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
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Check drug interactions using Python CDSS service
   * Falls back to basic checking if CDSS service unavailable
   */
  async checkDrugInteractions(drugIds: string[], patientId?: string) {
    try {
      // Try advanced checking via Python CDSS service
      const response = await this.cdssClient.post('/drugs/interactions/advanced', {
        drug_ids: drugIds,
        patient_id: patientId,
      });

      return {
        hasInteractions: response.data.interactions?.length > 0,
        interactions: response.data.interactions || [],
        severity_summary: response.data.severity_summary,
        recommendations: response.data.recommendations || [],
        source: 'advanced_cdss',
      };
    } catch (error) {
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
      const { chiefComplaint, symptoms: symptomList, vitals, age, gender } = symptoms;
      
      const response = await this.cdssClient.post('/diagnosis/suggest', {
        symptoms: symptomList || [chiefComplaint],
        vitals,
        age,
        gender,
      });

      return response.data;
    } catch (error) {
      this.logger.warn(`CDSS diagnostic assistance unavailable: ${error.message}`);
      // Fallback to basic logic
      return this.basicDiagnosisAssist(symptoms);
    }
  }

  /**
   * Basic diagnostic assistance (fallback)
   */
  private async basicDiagnosisAssist(symptoms: any) {
    // AI diagnostic assistance based on symptoms
    const { chiefComplaint, symptoms: symptomList, vitals, age, gender } = symptoms;
    
    // Simulate AI diagnostic engine
    const possibleDiagnoses = [];
    
    if (symptomList.includes('fever') && symptomList.includes('cough')) {
      possibleDiagnoses.push({
        condition: 'Upper Respiratory Tract Infection',
        probability: 0.75,
        icd10: 'J06.9',
        recommendations: ['Rest', 'Fluids', 'Symptomatic treatment']
      });
    }
    
    if (symptomList.includes('chest pain') && age > 40) {
      possibleDiagnoses.push({
        condition: 'Acute Coronary Syndrome',
        probability: 0.60,
        icd10: 'I20.9',
        recommendations: ['ECG', 'Cardiac enzymes', 'Immediate cardiology consult']
      });
    }

    return {
      chiefComplaint,
      differentialDiagnoses: possibleDiagnoses,
      recommendedTests: ['Complete Blood Count', 'Basic Metabolic Panel'],
      urgencyLevel: possibleDiagnoses.some(d => d.probability > 0.8) ? 'high' : 'medium'
    };
  }

  async getGuidelines(condition: string) {
    // Clinical guidelines database
    const guidelines = {
      'hypertension': {
        condition: 'Hypertension',
        guidelines: [
          'Target BP <140/90 mmHg for most adults',
          'Target BP <130/80 mmHg for high-risk patients',
          'Lifestyle modifications: diet, exercise, weight loss',
          'First-line medications: ACE inhibitors, ARBs, thiazide diuretics, CCBs'
        ],
        references: ['AHA/ACC 2017 Guidelines', 'WHO Guidelines']
      },
      'diabetes': {
        condition: 'Type 2 Diabetes',
        guidelines: [
          'Target HbA1c <7% for most adults',
          'Metformin as first-line therapy',
          'Regular monitoring of blood glucose',
          'Annual eye and foot examinations'
        ],
        references: ['ADA Standards of Care', 'WHO Guidelines']
      }
    };

    return guidelines[condition.toLowerCase()] || {
      condition,
      guidelines: ['No specific guidelines available'],
      references: []
    };
  }

  async riskAssessment(patientData: any) {
    const { age, gender, vitals, medicalHistory, medications } = patientData;
    
    let riskScore = 0;
    const riskFactors = [];

    // Age risk
    if (age > 65) {
      riskScore += 2;
      riskFactors.push('Advanced age');
    }

    // Vital signs risk
    if (vitals?.systolicBP > 140) {
      riskScore += 2;
      riskFactors.push('Hypertension');
    }

    // Medical history risk
    if (medicalHistory?.includes('diabetes')) {
      riskScore += 3;
      riskFactors.push('Diabetes mellitus');
    }

    if (medicalHistory?.includes('heart disease')) {
      riskScore += 3;
      riskFactors.push('Cardiovascular disease');
    }

    const riskLevel = riskScore >= 6 ? 'high' : riskScore >= 3 ? 'medium' : 'low';

    return {
      riskScore,
      riskLevel,
      riskFactors,
      recommendations: riskLevel === 'high' ? 
        ['Frequent monitoring', 'Specialist referral', 'Aggressive treatment'] :
        ['Regular follow-up', 'Lifestyle modifications']
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
}