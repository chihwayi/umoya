/**
 * Medical Entity Extractor Service for EHR Web Frontend
 * Extracts clinical entities (vitals, symptoms, problems) from transcribed text
 */

export interface ExtractedVitals {
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  temperature?: number;
  heartRate?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  weight?: number;
  height?: number;
  bloodGlucose?: number;
}

export interface ExtractedEntities {
  vitals?: ExtractedVitals;
  symptoms?: string[];
  problems?: string[];
  chiefComplaint?: string;
  medications?: string[];
  allergies?: string[];
  notes?: string;
}

class MedicalEntityExtractor {
  /**
   * Extract all medical entities from transcribed text
   */
  extractEntities(text: string): ExtractedEntities {
    const entities: ExtractedEntities = {};

    entities.vitals = this.extractVitals(text);
    entities.symptoms = this.extractSymptoms(text);
    entities.problems = this.extractProblems(text);
    entities.chiefComplaint = this.extractChiefComplaint(text);
    entities.medications = this.extractMedications(text);
    entities.allergies = this.extractAllergies(text);
    entities.notes = text;

    return entities;
  }

  /**
   * Extract vital signs from text
   */
  private extractVitals(text: string): ExtractedVitals {
    const vitals: ExtractedVitals = {};
    const lowerText = text.toLowerCase();

    // Blood Pressure patterns
    const bpPatterns = [
      /(?:blood pressure|bp|pressure)\s*(?:is|of|:)?\s*(\d{2,3})\s*(?:\/|over|and)\s*(\d{2,3})/gi,
      /(\d{2,3})\s*\/\s*(\d{2,3})\s*(?:mmhg|mmHg|blood pressure|bp)/gi,
      /(\d{2,3})\s*over\s*(\d{2,3})/gi,
    ];

    for (const pattern of bpPatterns) {
      const match = pattern.exec(text);
      if (match) {
        const systolic = parseInt(match[1], 10);
        const diastolic = parseInt(match[2], 10);
        if (systolic >= 60 && systolic <= 250 && diastolic >= 40 && diastolic <= 150) {
          vitals.bloodPressureSystolic = systolic;
          vitals.bloodPressureDiastolic = diastolic;
          break;
        }
      }
    }

    // Temperature patterns
    const tempPatterns = [
      /(?:temperature|temp|fever)\s*(?:is|of|:)?\s*(\d{1,2}\.?\d{0,1})\s*(?:degrees|°|celsius|celcius|c)/gi,
      /(\d{1,2}\.?\d{0,1})\s*(?:degrees|°)\s*(?:celsius|celcius|c|fahrenheit|f)/gi,
    ];

    for (const pattern of tempPatterns) {
      const match = pattern.exec(text);
      if (match) {
        const temp = parseFloat(match[1]);
        let celsiusTemp = temp;
        if (lowerText.includes('fahrenheit') || lowerText.includes('f')) {
          celsiusTemp = (temp - 32) * (5 / 9);
        }
        if (celsiusTemp >= 30 && celsiusTemp <= 45) {
          vitals.temperature = Math.round(celsiusTemp * 10) / 10;
          break;
        }
      }
    }

    // Heart Rate / Pulse patterns
    const hrPatterns = [
      /(?:heart rate|pulse|hr|pulse rate)\s*(?:is|of|:)?\s*(\d{2,3})\s*(?:bpm|beats|per minute)/gi,
      /(\d{2,3})\s*(?:bpm|beats per minute)/gi,
    ];

    for (const pattern of hrPatterns) {
      const match = pattern.exec(text);
      if (match) {
        const hr = parseInt(match[1], 10);
        if (hr >= 30 && hr <= 200) {
          vitals.heartRate = hr;
          break;
        }
      }
    }

    // Respiratory Rate patterns
    const rrPatterns = [
      /(?:respiratory rate|breathing rate|rr|respirations)\s*(?:is|of|:)?\s*(\d{1,2})\s*(?:per minute|bpm)/gi,
      /breathing\s*(\d{1,2})\s*(?:times|per minute)/gi,
    ];

    for (const pattern of rrPatterns) {
      const match = pattern.exec(text);
      if (match) {
        const rr = parseInt(match[1], 10);
        if (rr >= 8 && rr <= 40) {
          vitals.respiratoryRate = rr;
          break;
        }
      }
    }

    // Oxygen Saturation patterns
    const spo2Patterns = [
      /(?:oxygen|o2|spo2|saturation)\s*(?:is|of|:)?\s*(\d{2,3})\s*(?:percent|%)/gi,
      /(\d{2,3})\s*(?:percent|%)\s*(?:oxygen|o2|spo2)/gi,
    ];

    for (const pattern of spo2Patterns) {
      const match = pattern.exec(text);
      if (match) {
        const spo2 = parseInt(match[1], 10);
        if (spo2 >= 70 && spo2 <= 100) {
          vitals.oxygenSaturation = spo2;
          break;
        }
      }
    }

    // Weight patterns
    const weightPatterns = [
      /(?:weight|wt)\s*(?:is|of|:)?\s*(\d{1,3}\.?\d{0,2})\s*(?:kg|kilograms|kilos)/gi,
      /(\d{1,3}\.?\d{0,2})\s*(?:kg|kilograms|kilos)\s*(?:weight|wt)/gi,
    ];

    for (const pattern of weightPatterns) {
      const match = pattern.exec(text);
      if (match) {
        const weight = parseFloat(match[1]);
        if (weight >= 1 && weight <= 300) {
          vitals.weight = weight;
          break;
        }
      }
    }

    // Height patterns
    const heightPatterns = [
      /(?:height|ht|hgt)\s*(?:is|of|:)?\s*(\d{1,3}\.?\d{0,2})\s*(?:cm|centimeters|meters|m)/gi,
      /(\d{1,3}\.?\d{0,2})\s*(?:cm|centimeters|meters|m)\s*(?:height|ht)/gi,
    ];

    for (const pattern of heightPatterns) {
      const match = pattern.exec(text);
      if (match) {
        const height = parseFloat(match[1]);
        let heightCm = height;
        if (lowerText.includes('meters') || (lowerText.includes('m ') && height < 3)) {
          heightCm = height * 100;
        }
        if (heightCm >= 50 && heightCm <= 250) {
          vitals.height = heightCm;
          break;
        }
      }
    }

    // Blood Glucose patterns
    const glucosePatterns = [
      /(?:blood glucose|glucose|sugar|bs|bg)\s*(?:is|of|:)?\s*(\d{1,3}\.?\d{0,1})\s*(?:mg\/dl|mmol\/l|mg|mmol)/gi,
      /(\d{1,3}\.?\d{0,1})\s*(?:mg\/dl|mmol\/l)\s*(?:glucose|sugar)/gi,
    ];

    for (const pattern of glucosePatterns) {
      const match = pattern.exec(text);
      if (match) {
        const glucose = parseFloat(match[1]);
        let glucoseMgdl = glucose;
        if (lowerText.includes('mmol')) {
          glucoseMgdl = glucose * 18;
        }
        if (glucoseMgdl >= 20 && glucoseMgdl <= 600) {
          vitals.bloodGlucose = Math.round(glucoseMgdl);
          break;
        }
      }
    }

    return vitals;
  }

  /**
   * Extract symptoms from text
   */
  private extractSymptoms(text: string): string[] {
    const symptoms: string[] = [];
    const lowerText = text.toLowerCase();

    const symptomKeywords = [
      'headache', 'fever', 'cough', 'pain', 'nausea', 'vomiting', 'diarrhea',
      'dizziness', 'fatigue', 'weakness', 'shortness of breath', 'chest pain',
      'abdominal pain', 'back pain', 'joint pain', 'rash', 'itching',
      'sore throat', 'runny nose', 'congestion', 'sneezing', 'chills',
      'sweating', 'loss of appetite', 'weight loss', 'insomnia', 'anxiety',
    ];

    // SADC-first multilingual symptom terms
    const shonaSymptoms = [
      'kurwadza', 'kupisa', 'kukosora', 'kurutsa', 'kubuda', 'kufema',
      'kutemwa nemusoro', 'kutemwa nemuviri', 'kushaya simba',
    ];
    const ndebeleSymptoms = [
      'ubuhlungu', 'ukushisa', 'ukukhwehlela', 'ukugabha', 'ukubhuda',
      'ukuphefumula', 'ukubhida', 'ukudla',
    ];
    const zuluSymptoms = [
      'ubuhlungu', 'ukushisa komzimba', 'ukukhwehlela', 'ukuhlanza', 'ukukhathala',
    ];
    const swahiliSymptoms = [
      'homa', 'kikohozi', 'maumivu', 'kuhara', 'kutapika', 'uchovu', 'kizunguzungu',
    ];
    const afrikaansSymptoms = [
      'koors', 'hoes', 'hoofpyn', 'pyn', 'duiseligheid', 'moegheid', 'braking',
    ];

    const allSymptoms = [
      ...symptomKeywords,
      ...shonaSymptoms, ...ndebeleSymptoms, ...zuluSymptoms,
      ...swahiliSymptoms, ...afrikaansSymptoms,
    ];

    for (const symptom of allSymptoms) {
      if (lowerText.includes(symptom)) {
        symptoms.push(symptom);
      }
    }

    const complaintPatterns = [
      /(?:complains? of|symptoms? include|symptoms? are|presenting with)\s*:?\s*([^.]+)/gi,
      /(?:chief complaint|presenting complaint)\s*:?\s*([^.]+)/gi,
    ];

    for (const pattern of complaintPatterns) {
      const match = pattern.exec(text);
      if (match) {
        const complaintText = match[1].trim();
        if (complaintText.length > 5) {
          symptoms.push(complaintText);
        }
      }
    }

    return Array.from(new Set(symptoms));
  }

  /**
   * Extract problems/diagnoses from text
   */
  private extractProblems(text: string): string[] {
    const problems: string[] = [];
    const lowerText = text.toLowerCase();

    const problemPatterns = [
      /(?:diagnosed with|diagnosis|suffering from|history of|has)\s+([a-z\s]+(?:hypertension|diabetes|asthma|pneumonia|infection|disease|disorder|syndrome))/gi,
      /(?:diagnosis|diagnoses)\s*:?\s*([^.]+)/gi,
    ];

    for (const pattern of problemPatterns) {
      const matches = Array.from(text.matchAll(pattern));
      for (const match of matches) {
        const problem = match[1].trim();
        if (problem.length > 3 && problem.length < 100) {
          problems.push(problem);
        }
      }
    }

    return Array.from(new Set(problems));
  }

  /**
   * Extract chief complaint
   */
  private extractChiefComplaint(text: string): string | undefined {
    const patterns = [
      /(?:chief complaint|presenting complaint|cc)\s*:?\s*([^.]+)/gi,
      /(?:patient|pt)\s+(?:presents?|complains?)\s+(?:with|of)\s*:?\s*([^.]+)/gi,
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(text);
      if (match) {
        const complaint = match[1].trim();
        if (complaint.length > 5) {
          return complaint;
        }
      }
    }

    const firstSentence = text.split(/[.!?]/)[0].trim();
    if (firstSentence.length > 10) {
      return firstSentence;
    }

    return undefined;
  }

  /**
   * Extract medications mentioned
   */
  private extractMedications(text: string): string[] {
    const medications: string[] = [];
    const lowerText = text.toLowerCase();

    const medPatterns = [
      /(?:taking|on|prescribed|prescription)\s+([a-z]+(?:\s+[a-z]+)?)\s+(?:mg|tablet|capsule|dose)/gi,
      /(?:medication|meds|drugs?)\s*:?\s*([^.]+)/gi,
    ];

    for (const pattern of medPatterns) {
      const matches = Array.from(text.matchAll(pattern));
      for (const match of matches) {
        const med = match[1].trim();
        if (med.length > 2 && med.length < 50) {
          medications.push(med);
        }
      }
    }

    return Array.from(new Set(medications));
  }

  /**
   * Extract allergies mentioned
   */
  private extractAllergies(text: string): string[] {
    const allergies: string[] = [];
    const lowerText = text.toLowerCase();

    const allergyPatterns = [
      /(?:allergic to|allergy to|allergies?)\s*:?\s*([^.]+)/gi,
      /(?:no known allergies|nka|nadh)/gi,
    ];

    for (const pattern of allergyPatterns) {
      const match = pattern.exec(text);
      if (match) {
        if (match[0].toLowerCase().includes('no known')) {
          return ['No known allergies'];
        }
        const allergy = match[1]?.trim();
        if (allergy && allergy.length > 2) {
          allergies.push(allergy);
        }
      }
    }

    return Array.from(new Set(allergies));
  }
}

export default new MedicalEntityExtractor();
