import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceLine, ResponsiveContainer,
} from 'recharts';

interface GrowthPoint {
  measurementDate: string;
  ageMonths: number;
  waz: number | null;
  haz: number | null;
  wazCategory: string;
}

interface GrowthChartPlotProps {
  measurements: GrowthPoint[];
  showWaz?: boolean;
  showHaz?: boolean;
}

const categoryColor = (category: string): string => {
  if (category === 'severe_underweight' || category === 'severely_stunted') return '#ef4444';
  if (category === 'underweight' || category === 'stunted') return '#f97316';
  return '#22c55e';
};

const CustomDot = (props: any) => {
  const { cx, cy, payload } = props;
  const color = categoryColor(payload.wazCategory);
  return <circle cx={cx} cy={cy} r={5} fill={color} stroke="#fff" strokeWidth={1} />;
};

export const GrowthChartPlot: React.FC<GrowthChartPlotProps> = ({
  measurements,
  showWaz = true,
  showHaz = false,
}) => {
  if (measurements.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
        No growth measurements recorded yet.
      </div>
    );
  }

  const data = measurements
    .filter((m) => m.ageMonths != null)
    .sort((a, b) => a.ageMonths - b.ageMonths)
    .map((m) => ({
      ...m,
      ageLabel: `${m.ageMonths}m`,
    }));

  return (
    <div style={{ padding: 8 }}>
      <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600 }}>
        Paediatric Growth Chart (WHO Standards)
      </h4>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis dataKey="ageLabel" tick={{ fontSize: 11 }} />
          <YAxis
            domain={[-4, 4]}
            tickCount={9}
            tick={{ fontSize: 11 }}
            label={{ value: 'Z-score (SD)', angle: -90, position: 'insideLeft', fontSize: 11 }}
          />
          <Tooltip formatter={(val: any) => (val != null ? Number(val).toFixed(2) : 'N/A')} />
          <Legend />

          {/* WHO Z-score reference lines */}
          <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="4 2" label={{ value: 'Median', fontSize: 10 }} />
          <ReferenceLine y={-2} stroke="#f97316" strokeDasharray="4 2" label={{ value: '-2 SD', fontSize: 10 }} />
          <ReferenceLine y={-3} stroke="#ef4444" strokeDasharray="4 2" label={{ value: '-3 SD', fontSize: 10 }} />
          <ReferenceLine y={2} stroke="#3b82f6" strokeDasharray="4 2" label={{ value: '+2 SD', fontSize: 10 }} />

          {showWaz && (
            <Line
              type="monotone"
              dataKey="waz"
              name="WAZ (Weight-for-Age)"
              stroke="#1d4ed8"
              strokeWidth={2}
              dot={<CustomDot />}
              connectNulls={false}
            />
          )}
          {showHaz && (
            <Line
              type="monotone"
              dataKey="haz"
              name="HAZ (Height-for-Age)"
              stroke="#7c3aed"
              strokeWidth={2}
              dot={{ r: 4 }}
              connectNulls={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>

      <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, background: '#22c55e', borderRadius: '50%', display: 'inline-block' }} />
          Normal (WAZ &gt; -2)
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, background: '#f97316', borderRadius: '50%', display: 'inline-block' }} />
          Underweight (WAZ -3 to -2)
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, background: '#ef4444', borderRadius: '50%', display: 'inline-block' }} />
          Severe underweight (WAZ &lt; -3)
        </span>
      </div>
    </div>
  );
};
