import React from 'react';
import { View } from 'react-native';
import Svg, { Polyline, Line, Rect } from 'react-native-svg';
import { C } from '../../design/tokens';

interface SparklineProps {
  data: { v: number }[];
  color?: string;
  width?: number;
  height?: number;
  refLow?: number;
  refHigh?: number;
}

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  color = C.teal,
  width = 280,
  height = 56,
  refLow,
  refHigh,
}) => {
  if (!data || data.length < 2) return <View style={{ width, height }} />;

  const values = data.map(d => d.v);
  const allVals = [...values, refLow ?? Infinity, refHigh ?? -Infinity].filter(isFinite);
  const minV = Math.min(...allVals) * 0.9;
  const maxV = Math.max(...allVals) * 1.1;
  const range = maxV - minV || 1;

  const pad = 4;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const toX = (i: number) => pad + (i / (data.length - 1)) * innerW;
  const toY = (v: number) => pad + (1 - (v - minV) / range) * innerH;

  const points = data.map((d, i) => `${toX(i)},${toY(d.v)}`).join(' ');

  const refLowY = refLow != null ? toY(refLow) : null;
  const refHighY = refHigh != null ? toY(refHigh) : null;

  return (
    <Svg width={width} height={height}>
      {/* Reference band */}
      {refLowY != null && refHighY != null && (
        <Rect
          x={pad}
          y={refHighY}
          width={innerW}
          height={refLowY - refHighY}
          fill={C.teal + '18'}
        />
      )}
      {/* Reference lines */}
      {refLowY != null && (
        <Line
          x1={pad} y1={refLowY} x2={pad + innerW} y2={refLowY}
          stroke={C.teal} strokeWidth={0.8} strokeDasharray="3,3" opacity={0.4}
        />
      )}
      {refHighY != null && (
        <Line
          x1={pad} y1={refHighY} x2={pad + innerW} y2={refHighY}
          stroke={C.teal} strokeWidth={0.8} strokeDasharray="3,3" opacity={0.4}
        />
      )}
      {/* Data line */}
      <Polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};
