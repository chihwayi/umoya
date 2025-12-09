/**
 * Vitals Alerts Utility
 * Checks vital signs against normal ranges and returns alerts for abnormal values
 */

export interface VitalsAlert {
  type: 'critical' | 'warning' | 'info';
  vital: string;
  message: string;
  value: string | number;
  normalRange: string;
}

export interface VitalsData {
  temperature?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  heartRate?: number;
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
        message: 'Critical bradycardia - Immediate attention required',
        value: `${hr} bpm`,
        normalRange: '60-100 bpm',
      });
    } else if (hr > THRESHOLDS.heartRate.criticalHigh) {
      alerts.push({
        type: 'critical',
        vital: 'Heart Rate',
        message: 'Critical tachycardia - Immediate attention required',
        value: `${hr} bpm`,
        normalRange: '60-100 bpm',
      });
    } else if (hr < THRESHOLDS.heartRate.low || hr > THRESHOLDS.heartRate.high) {
      alerts.push({
        type: 'warning',
        vital: 'Heart Rate',
        message: hr < THRESHOLDS.heartRate.low ? 'Bradycardia detected' : 'Tachycardia detected',
        value: `${hr} bpm`,
        normalRange: '60-100 bpm',
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
        message: 'Critical hypothermia - Immediate attention required',
        value: `${temp}°C`,
        normalRange: '36.0-37.5°C',
      });
    } else if (temp > THRESHOLDS.temperature.criticalHigh) {
      alerts.push({
        type: 'critical',
        vital: 'Temperature',
        message: 'Critical hyperthermia - Immediate attention required',
        value: `${temp}°C`,
        normalRange: '36.0-37.5°C',
      });
    } else if (temp < THRESHOLDS.temperature.low || temp > THRESHOLDS.temperature.high) {
      alerts.push({
        type: 'warning',
        vital: 'Temperature',
        message: temp < THRESHOLDS.temperature.low ? 'Hypothermia' : 'Fever',
        value: `${temp}°C`,
        normalRange: '36.0-37.5°C',
      });
    }
  }

  // Blood Pressure - Handle both formats (separate fields or string)
  let systolic: number | undefined;
  let diastolic: number | undefined;
  
  if (vitals.bloodPressureSystolic !== undefined && vitals.bloodPressureDiastolic !== undefined) {
    systolic = vitals.bloodPressureSystolic;
    diastolic = vitals.bloodPressureDiastolic;
  } else if ((vitals as any).bloodPressure && typeof (vitals as any).bloodPressure === 'string') {
    // Handle string format "120/80" like EHR
    const bpMatch = (vitals as any).bloodPressure.match(/(\d+)\s*\/\s*(\d+)/);
    if (bpMatch) {
      systolic = parseInt(bpMatch[1], 10);
      diastolic = parseInt(bpMatch[2], 10);
    }
  }
  
  if (systolic !== undefined && diastolic !== undefined) {

    // Check systolic
    if (systolic < THRESHOLDS.systolicBP.criticalLow) {
      alerts.push({
        type: 'critical',
        vital: 'Blood Pressure',
        message: 'Critical hypotension - Immediate attention required',
        value: `${systolic}/${diastolic} mmHg`,
        normalRange: '90-140/60-90 mmHg',
      });
    } else if (systolic > THRESHOLDS.systolicBP.criticalHigh) {
      alerts.push({
        type: 'critical',
        vital: 'Blood Pressure',
        message: 'Hypertensive emergency - Immediate attention required',
        value: `${systolic}/${diastolic} mmHg`,
        normalRange: '90-140/60-90 mmHg',
      });
    } else if (systolic < THRESHOLDS.systolicBP.low || systolic > THRESHOLDS.systolicBP.high) {
      alerts.push({
        type: 'warning',
        vital: 'Blood Pressure',
        message: systolic < THRESHOLDS.systolicBP.low ? 'Hypotension' : 'Hypertension',
        value: `${systolic}/${diastolic} mmHg`,
        normalRange: '90-140/60-90 mmHg',
      });
    }

    // Check diastolic
    if (diastolic < THRESHOLDS.diastolicBP.criticalLow || diastolic > THRESHOLDS.diastolicBP.criticalHigh) {
      if (!alerts.find(a => a.vital === 'Blood Pressure' && a.type === 'critical')) {
        alerts.push({
          type: 'critical',
          vital: 'Blood Pressure',
          message: diastolic < THRESHOLDS.diastolicBP.criticalLow 
            ? 'Critical hypotension - Immediate attention required'
            : 'Hypertensive emergency - Immediate attention required',
          value: `${systolic}/${diastolic} mmHg`,
          normalRange: '90-140/60-90 mmHg',
        });
      }
    } else if (diastolic < THRESHOLDS.diastolicBP.low || diastolic > THRESHOLDS.diastolicBP.high) {
      if (!alerts.find(a => a.vital === 'Blood Pressure' && a.type === 'warning')) {
        alerts.push({
          type: 'warning',
          vital: 'Blood Pressure',
          message: diastolic < THRESHOLDS.diastolicBP.low ? 'Hypotension' : 'Hypertension',
          value: `${systolic}/${diastolic} mmHg`,
          normalRange: '90-140/60-90 mmHg',
        });
      }
    }
  }

  // Oxygen Saturation
  if (vitals.oxygenSaturation !== undefined) {
    const spo2 = vitals.oxygenSaturation;
    if (spo2 < THRESHOLDS.oxygenSaturation.criticalLow) {
      alerts.push({
        type: 'critical',
        vital: 'Oxygen Saturation',
        message: 'Critical hypoxia - Immediate oxygen therapy required',
        value: `${spo2}%`,
        normalRange: '95-100%',
      });
    } else if (spo2 < THRESHOLDS.oxygenSaturation.low) {
      alerts.push({
        type: 'warning',
        vital: 'Oxygen Saturation',
        message: 'Low oxygen saturation - Monitor closely',
        value: `${spo2}%`,
        normalRange: '95-100%',
      });
    }
  }

  // Respiratory Rate
  if (vitals.respiratoryRate !== undefined) {
    const rr = vitals.respiratoryRate;
    if (rr < THRESHOLDS.respiratoryRate.criticalLow || rr > THRESHOLDS.respiratoryRate.criticalHigh) {
      alerts.push({
        type: 'critical',
        vital: 'Respiratory Rate',
        message: 'Abnormal respiratory rate - Immediate attention required',
        value: `${rr} /min`,
        normalRange: '12-20 /min',
      });
    } else if (rr < THRESHOLDS.respiratoryRate.low || rr > THRESHOLDS.respiratoryRate.high) {
      alerts.push({
        type: 'warning',
        vital: 'Respiratory Rate',
        message: 'Abnormal respiratory rate',
        value: `${rr} /min`,
        normalRange: '12-20 /min',
      });
    }
  }

  // Blood Glucose
  if (vitals.bloodGlucose !== undefined) {
    const bg = vitals.bloodGlucose;
    if (bg < THRESHOLDS.bloodGlucose.criticalLow) {
      alerts.push({
        type: 'critical',
        vital: 'Blood Glucose',
        message: 'Critical hypoglycemia - Immediate treatment required',
        value: `${bg} mg/dL`,
        normalRange: '70-140 mg/dL',
      });
    } else if (bg > THRESHOLDS.bloodGlucose.criticalHigh) {
      alerts.push({
        type: 'critical',
        vital: 'Blood Glucose',
        message: 'Critical hyperglycemia - Immediate attention required',
        value: `${bg} mg/dL`,
        normalRange: '70-140 mg/dL',
      });
    } else if (bg < THRESHOLDS.bloodGlucose.low || bg > THRESHOLDS.bloodGlucose.high) {
      alerts.push({
        type: 'warning',
        vital: 'Blood Glucose',
        message: bg < THRESHOLDS.bloodGlucose.low ? 'Hypoglycemia' : 'Hyperglycemia',
        value: `${bg} mg/dL`,
        normalRange: '70-140 mg/dL',
      });
    }
  }

  return alerts;
}

export function hasCriticalAlerts(vitals: VitalsData): boolean {
  const alerts = checkVitalsAlerts(vitals);
  return alerts.some(alert => alert.type === 'critical');
}

export function getVitalStatusColor(vital: string, value: number, alerts: VitalsAlert[]): string {
  const alert = alerts.find(a => a.vital === vital);
  if (!alert) return '#10B981'; // green - normal
  
  switch (alert.type) {
    case 'critical':
      return '#EF4444'; // red
    case 'warning':
      return '#F59E0B'; // amber
    default:
      return '#10B981'; // green
  }
}
