export interface ReportDefinition {
  title: string;
  subtitle?: string;
  facility: string;
  district?: string;
  period: string;
  generatedBy: string;
  generatedAt: string | Date;
  sections: ReportSection[];
  footer?: string;
}

export type ReportSection =
  | SummaryCardsSection
  | TableSection
  | ChartImageSection
  | CascadeFunnelSection
  | NarrativeSection;

export interface SummaryCardsSection {
  type: 'summary_cards';
  title: string;
  cards: { label: string; value: string | number; unit?: string; status?: 'good' | 'warning' | 'critical' }[];
}

export interface TableSection {
  type: 'table';
  title: string;
  columns: { key: string; label: string; width?: number }[];
  rows: Record<string, any>[];
  totals?: Record<string, number>;
  conditionalColour?: {
    column: string;
    thresholds: { max: number; colour: string }[];
  };
}

export interface ChartImageSection {
  type: 'chart_image';
  title: string;
  imageBase64: string;
  caption?: string;
}

export interface CascadeFunnelSection {
  type: 'cascade_funnel';
  title: string;
  steps: { label: string; value: number; percentage: number }[];
}

export interface NarrativeSection {
  type: 'narrative';
  title: string;
  text: string;
}
