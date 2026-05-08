import { Injectable } from '@nestjs/common';

export type Severity = 'minimal' | 'mild' | 'moderate' | 'moderately-severe' | 'severe' | 'critical' | 'normal' | 'elevated' | 'high' | 'very-high';

export interface ProInterpretation {
  severity: Severity;
  label: string;
  patientMessage: string;
  clinicianSummary: string;
  colorHex: string;
}

interface ScoreRange {
  min: number;
  max: number;
  severity: Severity;
  label: string;
  patientMessage: string;
  clinicianSummary: string;
  colorHex: string;
}

const SCALES: Record<string, ScoreRange[]> = {
  // PHQ-9: Depression
  'PHQ-9': [
    { min: 0, max: 4,  severity: 'minimal',          label: 'Minimal Depression',           patientMessage: 'Your responses suggest minimal depressive symptoms. Keep monitoring your mood and reach out if things change.',    clinicianSummary: 'PHQ-9 minimal. No active intervention indicated. Monitor at next visit.',     colorHex: '#22c55e' },
    { min: 5, max: 9,  severity: 'mild',              label: 'Mild Depression',              patientMessage: 'Your responses suggest mild depressive symptoms. Your care team has been notified and may be in touch.',          clinicianSummary: 'PHQ-9 mild. Watchful waiting; consider psychoeducation and follow-up in 4 weeks.',  colorHex: '#84cc16' },
    { min: 10, max: 14, severity: 'moderate',         label: 'Moderate Depression',          patientMessage: 'Your responses suggest moderate depression. Your care team has been notified and will follow up with you.',       clinicianSummary: 'PHQ-9 moderate. Treatment plan warranted. Consider counselling or pharmacotherapy.',  colorHex: '#f59e0b' },
    { min: 15, max: 19, severity: 'moderately-severe', label: 'Moderately Severe Depression', patientMessage: 'Your care team has been notified. Please do not hesitate to call the clinic — help is available.',              clinicianSummary: 'PHQ-9 moderately severe. Active treatment required. Initiate antidepressant and/or therapy.',  colorHex: '#f97316' },
    { min: 20, max: 27, severity: 'severe',           label: 'Severe Depression',            patientMessage: 'Please contact your care team or emergency services immediately. You are not alone — help is available now.',    clinicianSummary: 'PHQ-9 severe. Urgent review required. Assess suicidality and consider referral.',  colorHex: '#ef4444' },
  ],

  // PHQ-2: Depression screen
  'PHQ-2': [
    { min: 0, max: 2, severity: 'minimal', label: 'Negative Screen', patientMessage: 'Your responses do not indicate significant depressive symptoms at this time.',  clinicianSummary: 'PHQ-2 negative screen. No further action required unless clinically indicated.',  colorHex: '#22c55e' },
    { min: 3, max: 6, severity: 'moderate', label: 'Positive Screen', patientMessage: 'Your responses suggest you may be experiencing depressive symptoms. Your care team will follow up.',  clinicianSummary: 'PHQ-2 positive. Administer PHQ-9 for full assessment.',  colorHex: '#f59e0b' },
  ],

  // GAD-7: Anxiety
  'GAD-7': [
    { min: 0, max: 4,  severity: 'minimal',  label: 'Minimal Anxiety', patientMessage: 'Your responses suggest minimal anxiety. Continue your usual activities and monitor how you feel.',  clinicianSummary: 'GAD-7 minimal anxiety. No active treatment indicated.',  colorHex: '#22c55e' },
    { min: 5, max: 9,  severity: 'mild',     label: 'Mild Anxiety',    patientMessage: 'Your responses suggest mild anxiety. Your care team has been notified.',  clinicianSummary: 'GAD-7 mild. Consider watchful waiting and self-help resources.',  colorHex: '#84cc16' },
    { min: 10, max: 14, severity: 'moderate', label: 'Moderate Anxiety', patientMessage: 'Your responses suggest moderate anxiety. Your care team will follow up with next steps.',  clinicianSummary: 'GAD-7 moderate. Consider CBT referral and/or pharmacotherapy.',  colorHex: '#f59e0b' },
    { min: 15, max: 21, severity: 'severe',   label: 'Severe Anxiety',  patientMessage: 'Your care team has been notified. Please contact the clinic if you feel overwhelmed — support is available.',  clinicianSummary: 'GAD-7 severe. Active treatment required. Refer to mental health services.',  colorHex: '#ef4444' },
  ],

  // WHO-5: Wellbeing (higher is better; raw score 0–25, rescaled ×4 = 0–100)
  'WHO-5': [
    { min: 0,  max: 28,  severity: 'severe',   label: 'Poor Wellbeing',       patientMessage: 'Your wellbeing score is low. Please speak with your care team — they want to help.',  clinicianSummary: 'WHO-5 poor wellbeing (<28). Screen for depression; consider immediate support.',  colorHex: '#ef4444' },
    { min: 29, max: 50,  severity: 'moderate', label: 'Below Average Wellbeing', patientMessage: 'Your wellbeing score is below average. Your care team has been notified.',  clinicianSummary: 'WHO-5 below average. Explore contributing factors; consider follow-up.',  colorHex: '#f59e0b' },
    { min: 51, max: 72,  severity: 'mild',     label: 'Average Wellbeing',    patientMessage: 'Your wellbeing is in the average range. Keep monitoring — your care team is here if things change.',  clinicianSummary: 'WHO-5 average wellbeing. Monitor; no immediate action required.',  colorHex: '#84cc16' },
    { min: 73, max: 100, severity: 'minimal',  label: 'Good Wellbeing',       patientMessage: 'Your wellbeing score is good. Keep up the great work!',  clinicianSummary: 'WHO-5 good wellbeing. No intervention required.',  colorHex: '#22c55e' },
  ],

  // AUDIT: Alcohol use
  'AUDIT': [
    { min: 0,  max: 7,  severity: 'minimal',  label: 'Low Risk',             patientMessage: 'Your responses suggest low-risk alcohol use.',  clinicianSummary: 'AUDIT low risk. Brief advice on sensible drinking.',  colorHex: '#22c55e' },
    { min: 8,  max: 15, severity: 'mild',     label: 'Hazardous Use',        patientMessage: 'Your responses suggest hazardous alcohol use. Your care team will discuss this with you.',  clinicianSummary: 'AUDIT hazardous. Simple brief advice recommended.',  colorHex: '#f59e0b' },
    { min: 16, max: 19, severity: 'moderate', label: 'Harmful Use',          patientMessage: 'Your responses suggest harmful alcohol use. Please speak with your care team.',  clinicianSummary: 'AUDIT harmful. Brief counselling and monitoring required.',  colorHex: '#f97316' },
    { min: 20, max: 40, severity: 'severe',   label: 'Possible Dependence',  patientMessage: 'Your responses suggest possible alcohol dependence. Please contact your care team — confidential support is available.',  clinicianSummary: 'AUDIT possible dependence. Referral to specialist required.',  colorHex: '#ef4444' },
  ],

  // FACT-G: Cancer quality of life (higher is better; max 108)
  'FACT-G': [
    { min: 0,  max: 40,  severity: 'severe',   label: 'Very Poor QoL',    patientMessage: 'Your quality of life score is very low. Your care team has been notified and will follow up urgently.',  clinicianSummary: 'FACT-G very poor QoL. Urgent multidisciplinary review.',  colorHex: '#ef4444' },
    { min: 41, max: 65,  severity: 'moderate', label: 'Poor QoL',         patientMessage: 'Your quality of life score is below average. Your care team will discuss support options with you.',  clinicianSummary: 'FACT-G poor QoL. Review pain, fatigue, and psychosocial support.',  colorHex: '#f97316' },
    { min: 66, max: 85,  severity: 'mild',     label: 'Moderate QoL',     patientMessage: 'Your quality of life is in the moderate range. Continue your care plan and let your team know if things change.',  clinicianSummary: 'FACT-G moderate QoL. Continue treatment; address specific subscale concerns.',  colorHex: '#f59e0b' },
    { min: 86, max: 108, severity: 'minimal',  label: 'Good QoL',         patientMessage: 'Your quality of life score is good. Keep up the great work with your care plan.',  clinicianSummary: 'FACT-G good QoL. Maintain current plan.',  colorHex: '#22c55e' },
  ],

  // ESAS: Edmonton Symptom Assessment (palliative; sum of 10 items 0–10 each; lower is better)
  'ESAS': [
    { min: 0,  max: 20,  severity: 'minimal',  label: 'Low Symptom Burden',       patientMessage: 'Your symptom burden is low. Your care team will continue to monitor.',  clinicianSummary: 'ESAS low burden. Maintain current supportive care.',  colorHex: '#22c55e' },
    { min: 21, max: 50,  severity: 'moderate', label: 'Moderate Symptom Burden',  patientMessage: 'You are experiencing moderate symptoms. Your care team has been notified and will review your comfort plan.',  clinicianSummary: 'ESAS moderate burden. Review and adjust symptom management.',  colorHex: '#f59e0b' },
    { min: 51, max: 100, severity: 'severe',   label: 'High Symptom Burden',      patientMessage: 'Your symptoms are significantly affecting your comfort. Your care team has been notified and will contact you.',  clinicianSummary: 'ESAS high burden. Urgent palliative care review required.',  colorHex: '#ef4444' },
  ],

  // PSS-10: Perceived Stress Scale
  'PSS': [
    { min: 0,  max: 13, severity: 'minimal',  label: 'Low Stress',      patientMessage: 'Your stress levels appear to be well-managed.',  clinicianSummary: 'PSS low stress. No immediate intervention.',  colorHex: '#22c55e' },
    { min: 14, max: 26, severity: 'moderate', label: 'Moderate Stress', patientMessage: 'Your responses suggest moderate stress. Your care team may discuss coping strategies with you.',  clinicianSummary: 'PSS moderate stress. Discuss stress management strategies.',  colorHex: '#f59e0b' },
    { min: 27, max: 40, severity: 'severe',   label: 'High Stress',     patientMessage: 'You are experiencing high levels of stress. Please speak with your care team — support is available.',  clinicianSummary: 'PSS high stress. Referral to psychologist or social worker recommended.',  colorHex: '#ef4444' },
  ],

  // KCCQ-12: Heart failure QoL (higher is better; 0–100)
  'KCCQ-12': [
    { min: 0,  max: 24,  severity: 'severe',   label: 'Very Poor Cardiac QoL', patientMessage: 'Your heart failure symptoms are significantly affecting your daily life. Your care team has been notified.',  clinicianSummary: 'KCCQ-12 very poor. Urgent cardiology review.',  colorHex: '#ef4444' },
    { min: 25, max: 49,  severity: 'moderate', label: 'Poor Cardiac QoL',      patientMessage: 'Your cardiac symptoms are limiting your activities. Your care team will review your treatment plan.',  clinicianSummary: 'KCCQ-12 poor. Optimize HF management; consider specialist referral.',  colorHex: '#f97316' },
    { min: 50, max: 74,  severity: 'mild',     label: 'Moderate Cardiac QoL',  patientMessage: 'Your cardiac symptoms are moderately affecting you. Keep following your care plan.',  clinicianSummary: 'KCCQ-12 moderate. Continue optimization.',  colorHex: '#f59e0b' },
    { min: 75, max: 100, severity: 'minimal',  label: 'Good Cardiac QoL',      patientMessage: 'Your quality of life with heart failure is relatively well-managed. Keep it up!',  clinicianSummary: 'KCCQ-12 good QoL. Maintain current HF regimen.',  colorHex: '#22c55e' },
  ],

  // MFIS-5: Fatigue (Multiple Sclerosis; higher = more fatigue)
  'MFIS-5': [
    { min: 0,  max: 7,  severity: 'minimal',  label: 'Minimal Fatigue', patientMessage: 'Your fatigue levels appear low. Continue your current activity plan.',  clinicianSummary: 'MFIS-5 minimal fatigue. No intervention required.',  colorHex: '#22c55e' },
    { min: 8,  max: 14, severity: 'moderate', label: 'Moderate Fatigue', patientMessage: 'You are experiencing moderate fatigue. Your care team may discuss energy-conservation strategies.',  clinicianSummary: 'MFIS-5 moderate. Refer to occupational therapy; review medications.',  colorHex: '#f59e0b' },
    { min: 15, max: 20, severity: 'severe',   label: 'Severe Fatigue',   patientMessage: 'Fatigue is significantly affecting your daily life. Please let your care team know.',  clinicianSummary: 'MFIS-5 severe. Active management required.',  colorHex: '#ef4444' },
  ],

  // DES-II: Diabetes Empowerment Scale (higher is better; 0–100)
  'DES-II': [
    { min: 0,  max: 40,  severity: 'severe',  label: 'Low Empowerment',      patientMessage: 'Your responses suggest you may need more support managing your diabetes. Your care team will follow up.',  clinicianSummary: 'DES-II low empowerment. Provide structured diabetes self-management education.',  colorHex: '#ef4444' },
    { min: 41, max: 69,  severity: 'moderate', label: 'Moderate Empowerment', patientMessage: 'You have some confidence in managing your diabetes — your care team can help build on this.',  clinicianSummary: 'DES-II moderate. Reinforce education; identify barriers to self-management.',  colorHex: '#f59e0b' },
    { min: 70, max: 100, severity: 'minimal',  label: 'High Empowerment',     patientMessage: 'You feel confident managing your diabetes. Keep up the great work!',  clinicianSummary: 'DES-II high empowerment. Maintain engagement; review at next visit.',  colorHex: '#22c55e' },
  ],

  // CORE-10: Mental health (lower is better; 0–40)
  'CORE-10': [
    { min: 0,  max: 4,  severity: 'minimal',  label: 'Healthy',        patientMessage: 'Your responses suggest you are coping well.',  clinicianSummary: 'CORE-10 healthy range. No action required.',  colorHex: '#22c55e' },
    { min: 5,  max: 9,  severity: 'mild',     label: 'Low Distress',   patientMessage: 'Your responses suggest low levels of distress. Your care team will check in with you.',  clinicianSummary: 'CORE-10 low. Monitor; provide self-help resources.',  colorHex: '#84cc16' },
    { min: 10, max: 14, severity: 'moderate', label: 'Mild Distress',  patientMessage: 'Your responses suggest mild emotional distress. Your care team has been notified.',  clinicianSummary: 'CORE-10 mild distress. Consider brief counselling.',  colorHex: '#f59e0b' },
    { min: 15, max: 19, severity: 'moderately-severe', label: 'Moderate Distress', patientMessage: 'You are experiencing significant distress. Your care team will follow up with support.',  clinicianSummary: 'CORE-10 moderate. Refer to psychology or counselling service.',  colorHex: '#f97316' },
    { min: 20, max: 40, severity: 'severe',   label: 'Severe Distress', patientMessage: 'Please contact your care team now — support is available and you do not have to manage this alone.',  clinicianSummary: 'CORE-10 severe. Urgent referral to mental health services.',  colorHex: '#ef4444' },
  ],
};

const FALLBACK: ProInterpretation = {
  severity: 'minimal',
  label: 'Score recorded',
  patientMessage: 'Your responses have been recorded. Your care team will review your results.',
  clinicianSummary: 'Score recorded. No specific interpretation available for this questionnaire type.',
  colorHex: '#64748b',
};

@Injectable()
export class ProInterpretationService {
  interpret(questionnaireCode: string, score: number): ProInterpretation {
    const key = Object.keys(SCALES).find(
      (k) => questionnaireCode.toUpperCase().startsWith(k.toUpperCase()) || questionnaireCode.toUpperCase() === k,
    );

    if (!key) return { ...FALLBACK };

    const ranges = SCALES[key];
    const match =
      ranges.find((r) => score >= r.min && score <= r.max) ??
      (score < ranges[0].min ? ranges[0] : ranges[ranges.length - 1]);
    if (!match) return { ...FALLBACK };

    return {
      severity: match.severity,
      label: match.label,
      patientMessage: match.patientMessage,
      clinicianSummary: match.clinicianSummary,
      colorHex: match.colorHex,
    };
  }
}
