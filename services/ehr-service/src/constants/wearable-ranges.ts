export type ReadingType =
  | 'bp_systolic'
  | 'bp_diastolic'
  | 'glucose'
  | 'heart_rate'
  | 'spo2'
  | 'weight';

export interface ReferenceRange {
  low: number;
  high: number;
  criticalLow?: number;
  criticalHigh?: number;
}

export const REFERENCE_RANGES: Record<ReadingType, ReferenceRange> = {
  bp_systolic:  { criticalLow: 80,  low: 90,  high: 140, criticalHigh: 180 },
  bp_diastolic: { criticalLow: 50,  low: 60,  high: 90,  criticalHigh: 120 },
  glucose:      { criticalLow: 54,  low: 70,  high: 180, criticalHigh: 250 },
  heart_rate:   { criticalLow: 40,  low: 50,  high: 100, criticalHigh: 150 },
  spo2:         { criticalLow: 88,  low: 92,  high: 100 },
  weight:       { low: 30, high: 250 },
};

export function flagReading(
  type: ReadingType,
  value: number,
): { flagged: boolean; reason?: string } {
  const range = REFERENCE_RANGES[type];
  if (!range) return { flagged: false };

  if (range.criticalLow !== undefined && value < range.criticalLow)
    return { flagged: true, reason: `Critical low ${type}: ${value}` };
  if (range.criticalHigh !== undefined && value > range.criticalHigh)
    return { flagged: true, reason: `Critical high ${type}: ${value}` };
  if (value < range.low) return { flagged: true, reason: `Low ${type}: ${value}` };
  if (value > range.high) return { flagged: true, reason: `High ${type}: ${value}` };

  return { flagged: false };
}
