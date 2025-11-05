import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatDateToDDMMYYYY } from '../utils/dateFormatting';

interface LabTrendsChartProps {
  visits: any[];
  testType: 'viral_load' | 'cd4';
}

const HIVLabTrendsChart: React.FC<LabTrendsChartProps> = ({ visits, testType }) => {
  // Filter visits with lab results
  const dataPoints = visits
    .filter(v => {
      if (testType === 'viral_load') {
        return v.viral_load !== null && v.viral_load_test_date;
      } else {
        return v.cd4_count !== null && v.cd4_test_date;
      }
    })
    .map(v => ({
      date: new Date(testType === 'viral_load' ? v.viral_load_test_date : v.cd4_test_date),
      value: testType === 'viral_load' ? parseFloat(v.viral_load) : parseInt(v.cd4_count),
      visitDate: v.visit_date
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (dataPoints.length === 0) {
    return (
      <div className="bg-slate-50 rounded-lg p-6 text-center">
        <p className="text-slate-600">No {testType === 'viral_load' ? 'viral load' : 'CD4'} data available</p>
      </div>
    );
  }

  // Calculate trend
  const trend = dataPoints.length >= 2 
    ? dataPoints[dataPoints.length - 1].value - dataPoints[0].value
    : 0;

  const maxValue = Math.max(...dataPoints.map(d => d.value));
  const minValue = Math.min(...dataPoints.map(d => d.value));
  const range = maxValue - minValue || 1;

  // Determine if trend is good or bad
  const isGoodTrend = testType === 'viral_load' 
    ? trend < 0 // Decreasing VL is good
    : trend > 0; // Increasing CD4 is good

  return (
    <div className="bg-white rounded-lg p-6 border border-slate-200">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-slate-900 capitalize">
          {testType === 'viral_load' ? 'Viral Load' : 'CD4 Count'} Trends
        </h4>
        {dataPoints.length >= 2 && (
          <div className="flex items-center gap-2">
            {isGoodTrend ? (
              <TrendingDown className="w-5 h-5 text-green-600" />
            ) : (
              <TrendingUp className="w-5 h-5 text-red-600" />
            )}
            <span className={`text-sm font-semibold ${isGoodTrend ? 'text-green-600' : 'text-red-600'}`}>
              {isGoodTrend ? 'Improving' : 'Declining'}
            </span>
          </div>
        )}
      </div>

      {/* Simple Bar/Line Chart Visualization */}
      <div className="relative h-64 mb-4">
        <div className="absolute inset-0 flex items-end justify-between gap-1">
          {dataPoints.map((point, index) => {
            const height = ((point.value - minValue) / range) * 100;
            const isLatest = index === dataPoints.length - 1;
            const isSuppressed = testType === 'viral_load' ? point.value < 1000 : point.value > 350;

            return (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div className="w-full flex flex-col items-center relative">
                  <div
                    className={`w-full rounded-t ${
                      isLatest
                        ? isSuppressed ? 'bg-emerald-500' : 'bg-red-500'
                        : isSuppressed ? 'bg-emerald-300' : 'bg-red-300'
                    } transition-all`}
                    style={{ height: `${height}%`, minHeight: '4px' }}
                    title={`${point.value.toLocaleString()} ${testType === 'viral_load' ? 'copies/mL' : 'cells/mm³'} on ${formatDateToDDMMYYYY(point.date)}`}
                  />
                  {isLatest && (
                    <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
                      <div className="bg-slate-900 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
                        {point.value.toLocaleString()} {testType === 'viral_load' ? 'copies/mL' : 'cells/mm³'}
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-2 text-xs text-slate-500 text-center transform -rotate-45 origin-top-left whitespace-nowrap">
                  {formatDateToDDMMYYYY(point.date).split('/')[0]}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-2 px-3 text-slate-600">Date</th>
              <th className="text-right py-2 px-3 text-slate-600">Value</th>
              <th className="text-center py-2 px-3 text-slate-600">Status</th>
            </tr>
          </thead>
          <tbody>
            {dataPoints.map((point, index) => {
              const isSuppressed = testType === 'viral_load' ? point.value < 1000 : point.value > 350;
              const isUndetectable = testType === 'viral_load' && point.value < 50;

              return (
                <tr key={index} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 px-3">{formatDateToDDMMYYYY(point.date)}</td>
                  <td className="text-right py-2 px-3 font-semibold">
                    {point.value.toLocaleString()} {testType === 'viral_load' ? 'copies/mL' : 'cells/mm³'}
                  </td>
                  <td className="text-center py-2 px-3">
                    {testType === 'viral_load' ? (
                      isUndetectable ? (
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold">
                          Undetectable
                        </span>
                      ) : isSuppressed ? (
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded text-xs font-semibold">
                          Suppressed
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-semibold">
                          High
                        </span>
                      )
                    ) : (
                      isSuppressed ? (
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold">
                          Good
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs font-semibold">
                          Low
                        </span>
                      )
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary Stats */}
      <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-slate-600">First Recorded</p>
          <p className="font-semibold">{dataPoints[0]?.value.toLocaleString()}</p>
          <p className="text-xs text-slate-500">{formatDateToDDMMYYYY(dataPoints[0]?.date)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-600">Latest</p>
          <p className="font-semibold">{dataPoints[dataPoints.length - 1]?.value.toLocaleString()}</p>
          <p className="text-xs text-slate-500">{formatDateToDDMMYYYY(dataPoints[dataPoints.length - 1]?.date)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-600">Change</p>
          <p className={`font-semibold ${isGoodTrend ? 'text-green-600' : 'text-red-600'}`}>
            {trend > 0 ? '+' : ''}{trend.toLocaleString()}
          </p>
          <p className="text-xs text-slate-500">
            {dataPoints.length >= 2 
              ? `${Math.floor((dataPoints[dataPoints.length - 1].date.getTime() - dataPoints[0].date.getTime()) / (1000 * 60 * 60 * 24))} days`
              : 'N/A'
            }
          </p>
        </div>
      </div>
    </div>
  );
};

export default HIVLabTrendsChart;

