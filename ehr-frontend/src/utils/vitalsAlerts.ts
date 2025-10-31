// Vitals-based clinical alerts utility
// Checks vitals against critical thresholds and returns alerts

export interface VitalsAlert {
  type: 'critical' | 'warning' | 'info';
  vital: string;
  value: string | number;
  threshold: string;
  message: string;
  recommendation?: string;
}

export interface VitalsData {
  bloodPressure?: string; // Format: "120/80"
  heartRate?: number;
  temperature?: number;
  oxygenSaturation?: number;
  respiratoryRate?: number;
  bloodGlucose?: number;
  weight?: number;
  height?: number;
  bmi?: number;
}

// Critical thresholds based on medical standards
const THRESHOLDS = {
  heartRate: { low: 50, high: 120, criticalLow: 40, criticalHigh: 150 },
  temperature: { low: 36.0, high: 37.5, criticalLow: 35.0, criticalHigh: 40.0 }, // Celsius
  oxygenSaturation: { low: 95, high: 100, criticalLow: 90, criticalHigh: 100 },
  respiratoryRate: { low: 12, high: 20, criticalLow: 8, criticalHigh: 25 },
  bloodGlucose: { low: 70, high: 140, criticalLow: 54, criticalHigh: 250 }, // mg/dL
  systolicBP: { low: 90, high: 140, criticalLow: 70, criticalHigh: 180 },
  diastolicBP: { low: 60, high: 90, criticalLow: 40, criticalHigh: 120 },
  bmi: { low: 18.5, high: 25, criticalLow: 16, criticalHigh: 35 },
};

export function checkVitalsAlerts(vitals: VitalsData): VitalsAlert[] {
  const alerts: VitalsAlert[] = [];

  // Heart Rate
  if (vitals.heartRate !== undefined) {
    const hr = vitals.heartRate;
    if (hr < THRESHOLDS.heartRate.criticalLow) {
      alerts.push({
        type: 'critical',
        vital: 'Heart Rate',
        value: hr,
        threshold: `< ${THRESHOLDS.heartRate.criticalLow} bpm`,
        message: `Critical: Severely low heart rate (bradycardia)`,
        recommendation: 'Immediate medical attention required. Consider ECG and cardiac monitoring.'
      });
    } else if (hr > THRESHOLDS.heartRate.criticalHigh) {
      alerts.push({
        type: 'critical',
        vital: 'Heart Rate',
        value: hr,
        threshold: `> ${THRESHOLDS.heartRate.criticalHigh} bpm`,
        message: `Critical: Severely elevated heart rate (tachycardia)`,
        recommendation: 'Immediate medical attention required. Consider ECG and investigation for causes.'
      });
    } else if (hr < THRESHOLDS.heartRate.low || hr > THRESHOLDS.heartRate.high) {
      alerts.push({
        type: 'warning',
        vital: 'Heart Rate',
        value: hr,
        threshold: `${THRESHOLDS.heartRate.low}-${THRESHOLDS.heartRate.high} bpm`,
        message: hr < THRESHOLDS.heartRate.low 
          ? `Low heart rate: ${hr} bpm (expected: ${THRESHOLDS.heartRate.low}-${THRESHOLDS.heartRate.high} bpm)`
          : `Elevated heart rate: ${hr} bpm (expected: ${THRESHOLDS.heartRate.low}-${THRESHOLDS.heartRate.high} bpm)`,
        recommendation: 'Monitor closely and investigate if symptomatic.'
      });
    }
  }

  // Temperature
  if (vitals.temperature !== undefined) {
    const temp = vitals.temperature;
    if (temp < THRESHOLDS.temperature.criticalLow) {
      alerts.push({
        type: 'critical',
        vital: 'Temperature',
        value: `${temp}°C`,
        threshold: `< ${THRESHOLDS.temperature.criticalLow}°C`,
        message: `Critical: Severe hypothermia`,
        recommendation: 'Immediate warming measures and medical attention required.'
      });
    } else if (temp > THRESHOLDS.temperature.criticalHigh) {
      alerts.push({
        type: 'critical',
        vital: 'Temperature',
        value: `${temp}°C`,
        threshold: `> ${THRESHOLDS.temperature.criticalHigh}°C`,
        message: `Critical: Severe hyperthermia/fever`,
        recommendation: 'Immediate cooling measures and medical attention required. Consider antipyretics.'
      });
    } else if (temp < THRESHOLDS.temperature.low || temp > THRESHOLDS.temperature.high) {
      alerts.push({
        type: 'warning',
        vital: 'Temperature',
        value: `${temp}°C`,
        threshold: `${THRESHOLDS.temperature.low}-${THRESHOLDS.temperature.high}°C`,
        message: temp < THRESHOLDS.temperature.low 
          ? `Low temperature: ${temp}°C (expected: ${THRESHOLDS.temperature.low}-${THRESHOLDS.temperature.high}°C)`
          : `Fever: ${temp}°C (expected: ${THRESHOLDS.temperature.low}-${THRESHOLDS.temperature.high}°C)`,
        recommendation: 'Monitor and investigate if symptomatic.'
      });
    }
  }

  // Oxygen Saturation
  if (vitals.oxygenSaturation !== undefined) {
    const o2 = vitals.oxygenSaturation;
    if (o2 < THRESHOLDS.oxygenSaturation.criticalLow) {
      alerts.push({
        type: 'critical',
        vital: 'Oxygen Saturation',
        value: `${o2}%`,
        threshold: `< ${THRESHOLDS.oxygenSaturation.criticalLow}%`,
        message: `Critical: Severe hypoxemia`,
        recommendation: 'Immediate oxygen therapy and medical attention required. Consider ABG.'
      });
    } else if (o2 < THRESHOLDS.oxygenSaturation.low) {
      alerts.push({
        type: 'warning',
        vital: 'Oxygen Saturation',
        value: `${o2}%`,
        threshold: `> ${THRESHOLDS.oxygenSaturation.low}%`,
        message: `Low oxygen saturation: ${o2}% (expected: > ${THRESHOLDS.oxygenSaturation.low}%)`,
        recommendation: 'Monitor closely and consider oxygen therapy if symptomatic.'
      });
    }
  }

  // Respiratory Rate
  if (vitals.respiratoryRate !== undefined) {
    const rr = vitals.respiratoryRate;
    if (rr < THRESHOLDS.respiratoryRate.criticalLow) {
      alerts.push({
        type: 'critical',
        vital: 'Respiratory Rate',
        value: `${rr}/min`,
        threshold: `< ${THRESHOLDS.respiratoryRate.criticalLow}/min`,
        message: `Critical: Severe bradypnea`,
        recommendation: 'Immediate medical attention required. Consider airway assessment and support.'
      });
    } else if (rr > THRESHOLDS.respiratoryRate.criticalHigh) {
      alerts.push({
        type: 'critical',
        vital: 'Respiratory Rate',
        value: `${rr}/min`,
        threshold: `> ${THRESHOLDS.respiratoryRate.criticalHigh}/min`,
        message: `Critical: Severe tachypnea`,
        recommendation: 'Immediate medical attention required. Consider respiratory support.'
      });
    } else if (rr < THRESHOLDS.respiratoryRate.low || rr > THRESHOLDS.respiratoryRate.high) {
      alerts.push({
        type: 'warning',
        vital: 'Respiratory Rate',
        value: `${rr}/min`,
        threshold: `${THRESHOLDS.respiratoryRate.low}-${THRESHOLDS.respiratoryRate.high}/min`,
        message: rr < THRESHOLDS.respiratoryRate.low 
          ? `Low respiratory rate: ${rr}/min (expected: ${THRESHOLDS.respiratoryRate.low}-${THRESHOLDS.respiratoryRate.high}/min)`
          : `Elevated respiratory rate: ${rr}/min (expected: ${THRESHOLDS.respiratoryRate.low}-${THRESHOLDS.respiratoryRate.high}/min)`,
        recommendation: 'Monitor closely.'
      });
    }
  }

  // Blood Pressure
  if (vitals.bloodPressure) {
    const bpMatch = vitals.bloodPressure.match(/(\d+)\s*\/\s*(\d+)/);
    if (bpMatch) {
      const systolic = parseInt(bpMatch[1]);
      const diastolic = parseInt(bpMatch[2]);

      // Systolic BP
      if (systolic < THRESHOLDS.systolicBP.criticalLow) {
        alerts.push({
          type: 'critical',
          vital: 'Blood Pressure (Systolic)',
          value: `${systolic} mmHg`,
          threshold: `< ${THRESHOLDS.systolicBP.criticalLow} mmHg`,
          message: `Critical: Severe hypotension`,
          recommendation: 'Immediate medical attention required. Consider IV fluids and vasopressors.'
        });
      } else if (systolic > THRESHOLDS.systolicBP.criticalHigh) {
        alerts.push({
          type: 'critical',
          vital: 'Blood Pressure (Systolic)',
          value: `${systolic} mmHg`,
          threshold: `> ${THRESHOLDS.systolicBP.criticalHigh} mmHg`,
          message: `Critical: Severe hypertension`,
          recommendation: 'Immediate medical attention required. Consider antihypertensive therapy.'
        });
      } else if (systolic < THRESHOLDS.systolicBP.low || systolic > THRESHOLDS.systolicBP.high) {
        alerts.push({
          type: 'warning',
          vital: 'Blood Pressure (Systolic)',
          value: `${systolic} mmHg`,
          threshold: `${THRESHOLDS.systolicBP.low}-${THRESHOLDS.systolicBP.high} mmHg`,
          message: systolic < THRESHOLDS.systolicBP.low 
            ? `Low systolic BP: ${systolic} mmHg (expected: ${THRESHOLDS.systolicBP.low}-${THRESHOLDS.systolicBP.high} mmHg)`
            : `Elevated systolic BP: ${systolic} mmHg (expected: ${THRESHOLDS.systolicBP.low}-${THRESHOLDS.systolicBP.high} mmHg)`,
          recommendation: 'Monitor closely.'
        });
      }

      // Diastolic BP
      if (diastolic < THRESHOLDS.diastolicBP.criticalLow) {
        alerts.push({
          type: 'critical',
          vital: 'Blood Pressure (Diastolic)',
          value: `${diastolic} mmHg`,
          threshold: `< ${THRESHOLDS.diastolicBP.criticalLow} mmHg`,
          message: `Critical: Severely low diastolic BP`,
          recommendation: 'Immediate medical attention required.'
        });
      } else if (diastolic > THRESHOLDS.diastolicBP.criticalHigh) {
        alerts.push({
          type: 'critical',
          vital: 'Blood Pressure (Diastolic)',
          value: `${diastolic} mmHg`,
          threshold: `> ${THRESHOLDS.diastolicBP.criticalHigh} mmHg`,
          message: `Critical: Severely elevated diastolic BP`,
          recommendation: 'Immediate medical attention required. Consider antihypertensive therapy.'
        });
      } else if (diastolic < THRESHOLDS.diastolicBP.low || diastolic > THRESHOLDS.diastolicBP.high) {
        alerts.push({
          type: 'warning',
          vital: 'Blood Pressure (Diastolic)',
          value: `${diastolic} mmHg`,
          threshold: `${THRESHOLDS.diastolicBP.low}-${THRESHOLDS.diastolicBP.high} mmHg`,
          message: diastolic < THRESHOLDS.diastolicBP.low 
            ? `Low diastolic BP: ${diastolic} mmHg (expected: ${THRESHOLDS.diastolicBP.low}-${THRESHOLDS.diastolicBP.high} mmHg)`
            : `Elevated diastolic BP: ${diastolic} mmHg (expected: ${THRESHOLDS.diastolicBP.low}-${THRESHOLDS.diastolicBP.high} mmHg)`,
          recommendation: 'Monitor closely.'
        });
      }
    }
  }

  // Blood Glucose
  if (vitals.bloodGlucose !== undefined) {
    const bg = vitals.bloodGlucose;
    if (bg < THRESHOLDS.bloodGlucose.criticalLow) {
      alerts.push({
        type: 'critical',
        vital: 'Blood Glucose',
        value: `${bg} mg/dL`,
        threshold: `< ${THRESHOLDS.bloodGlucose.criticalLow} mg/dL`,
        message: `Critical: Severe hypoglycemia`,
        recommendation: 'Immediate glucose administration and medical attention required.'
      });
    } else if (bg > THRESHOLDS.bloodGlucose.criticalHigh) {
      alerts.push({
        type: 'critical',
        vital: 'Blood Glucose',
        value: `${bg} mg/dL`,
        threshold: `> ${THRESHOLDS.bloodGlucose.criticalHigh} mg/dL`,
        message: `Critical: Severe hyperglycemia`,
        recommendation: 'Immediate medical attention required. Consider insulin therapy.'
      });
    } else if (bg < THRESHOLDS.bloodGlucose.low || bg > THRESHOLDS.bloodGlucose.high) {
      alerts.push({
        type: 'warning',
        vital: 'Blood Glucose',
        value: `${bg} mg/dL`,
        threshold: `${THRESHOLDS.bloodGlucose.low}-${THRESHOLDS.bloodGlucose.high} mg/dL`,
        message: bg < THRESHOLDS.bloodGlucose.low 
          ? `Low blood glucose: ${bg} mg/dL (expected: ${THRESHOLDS.bloodGlucose.low}-${THRESHOLDS.bloodGlucose.high} mg/dL)`
          : `Elevated blood glucose: ${bg} mg/dL (expected: ${THRESHOLDS.bloodGlucose.low}-${THRESHOLDS.bloodGlucose.high} mg/dL)`,
        recommendation: 'Monitor closely and investigate if symptomatic.'
      });
    }
  }

  // Sort alerts: critical first, then warnings
  return alerts.sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return order[a.type] - order[b.type];
  });
}

