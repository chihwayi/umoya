import React, { useEffect, useState } from 'react';

export interface FunnelStep {
  label: string;
  value: number;
  denominator: number;
  percentage: number;
  colour: 'teal' | 'amber' | 'coral';
}

const COLOURS = {
  teal:  { bar: '#0AA98A', text: '#0AA98A', bg: '#0AA98A18' },
  amber: { bar: '#F0954A', text: '#F0954A', bg: '#F0954A18' },
  coral: { bar: '#E8614D', text: '#E8614D', bg: '#E8614D18' },
};

interface Props {
  steps: FunnelStep[];
  title: string;
  subtitle?: string;
  animate?: boolean;
}

export const CascadeFunnel: React.FC<Props> = ({ steps, title, subtitle, animate = true }) => {
  const [widths, setWidths] = useState<number[]>(steps.map(() => 0));

  useEffect(() => {
    if (!animate) { setWidths(steps.map((s) => s.percentage)); return; }
    // Stagger animations
    const timers = steps.map((s, i) =>
      setTimeout(() => {
        setWidths((prev) => {
          const next = [...prev];
          next[i] = s.percentage;
          return next;
        });
      }, i * 80),
    );
    return () => timers.forEach(clearTimeout);
  }, [steps, animate]);

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ color: '#e0e6f0', fontWeight: 700, fontSize: 16 }}>{title}</div>
        {subtitle && <div style={{ color: '#6b7a99', fontSize: 13, marginTop: 2 }}>{subtitle}</div>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {steps.map((step, i) => {
          const col = COLOURS[step.colour];
          const animW = widths[i] ?? 0;

          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Label */}
              <div style={{ width: 200, flexShrink: 0, color: '#c8d0e0', fontSize: 13, textAlign: 'right' }}>
                {step.label}
              </div>
              {/* Bar */}
              <div style={{ flex: 1, background: '#1e2436', borderRadius: 4, height: 28, overflow: 'hidden', position: 'relative' }}>
                <div style={{
                  width: `${animW}%`,
                  height: '100%',
                  background: col.bar,
                  borderRadius: 4,
                  transition: animate ? 'width 300ms ease-out' : 'none',
                  opacity: 0.85,
                }} />
              </div>
              {/* Value + % */}
              <div style={{ width: 140, flexShrink: 0, display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ color: '#e0e6f0', fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {step.value.toLocaleString()}
                </span>
                {i > 0 && (
                  <span style={{
                    background: col.bg,
                    color: col.text,
                    border: `1px solid ${col.bar}44`,
                    borderRadius: 4,
                    padding: '1px 7px',
                    fontSize: 12,
                    fontWeight: 600,
                  }}>
                    {step.percentage.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
