import React from 'react';

export interface LabTrendPoint {
  value: number;
  unit: string;
  createdAt: string;
}

export interface LabTrendItem {
  key: string;
  name: string;
  unit: string;
  points: LabTrendPoint[];
  latest: number | null;
  previous: number | null;
  min: number;
  max: number;
}

interface LabTrendChartProps {
  trends: LabTrendItem[];
  title?: string;
  formatDate?: (iso: string) => string;
}

const defaultFormatDate = (iso: string) => {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
  } catch {
    return iso;
  }
};

export const LabTrendChart: React.FC<LabTrendChartProps> = ({
  trends,
  title = 'Lab trend (recent)',
  formatDate = defaultFormatDate,
}) => {
  if (!trends.length) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">{title}</h4>
      <div className="grid gap-2 sm:grid-cols-2">
        {trends.map((trend) => {
          const spread = Math.max(0.000001, trend.max - trend.min);
          return (
            <article key={trend.key} className="rounded-lg border border-slate-200 bg-white p-2.5">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-800">{trend.name}</p>
                <p className="text-[11px] text-slate-500">
                  Latest: {trend.latest}
                  {trend.unit ? ` ${trend.unit}` : ''}
                </p>
              </div>
              <div className="mb-1 flex h-10 items-end gap-1">
                {trend.points.map((point, index) => {
                  const normalizedHeight = ((point.value - trend.min) / spread) * 100;
                  const safeHeight = Math.max(
                    10,
                    Math.round(Number.isFinite(normalizedHeight) ? normalizedHeight : 10),
                  );
                  return (
                    <div
                      key={`${trend.key}-${index}`}
                      className="w-2.5 rounded-sm bg-cyan-500/80"
                      style={{ height: `${safeHeight}%` }}
                      title={`${point.value}${point.unit ? ` ${point.unit}` : ''} @ ${formatDate(point.createdAt)}`}
                    />
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-500">
                {trend.previous === null || trend.latest === null
                  ? 'Only one data point so far.'
                  : `Delta: ${(trend.latest - trend.previous).toFixed(2)}${trend.unit ? ` ${trend.unit}` : ''}`}
              </p>
            </article>
          );
        })}
      </div>
    </div>
  );
};
