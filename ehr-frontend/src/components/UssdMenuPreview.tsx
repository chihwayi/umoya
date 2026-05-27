import React from 'react';

interface MenuNode {
  label: string;
  key?: string;
  children?: MenuNode[];
  isEnd?: boolean;
}

const MENU_TREE: MenuNode[] = [
  {
    label: 'MAIN MENU',
    children: [
      {
        label: '1. My next appointment',
        key: '1',
        children: [
          { label: '→ Shows date, time, provider', children: [
            { label: '1. Confirm attendance', isEnd: true },
            { label: '2. Cannot make it', children: [
              { label: '1–5. Select reason', isEnd: true },
            ]},
            { label: '0. Back to main menu' },
          ]},
        ],
      },
      {
        label: '2. Request medication refill',
        key: '2',
        children: [
          { label: '→ Shows regimen + pickup date', children: [
            { label: '1. Request refill now', isEnd: true },
            { label: '2. Visit in person', isEnd: true },
            { label: '0. Back to main menu' },
          ]},
        ],
      },
      {
        label: '3. My recent results',
        key: '3',
        children: [
          { label: '→ Shows latest lab result', isEnd: true },
        ],
      },
      {
        label: '4. Stop SMS reminders',
        key: '4',
        children: [
          { label: '1. Yes, stop reminders', isEnd: true },
          { label: '2. No, keep them', isEnd: true },
        ],
      },
      { label: '99. Exit', key: '99', isEnd: true },
    ],
  },
];

function MenuTreeNode({ node, depth }: { node: MenuNode; depth: number }) {
  const bg = depth === 0 ? '#1e40af' : depth === 1 ? '#3b82f6' : depth === 2 ? '#93c5fd' : '#dbeafe';
  const textColor = depth < 2 ? '#fff' : '#1e3a8a';
  const borderColor = node.isEnd ? '#dc2626' : '#60a5fa';

  return (
    <div style={{ marginLeft: depth * 20, marginBottom: 4 }}>
      <div
        style={{
          display: 'inline-block',
          padding: '4px 10px',
          borderRadius: 6,
          background: bg,
          color: textColor,
          fontSize: 12,
          border: node.isEnd ? '2px solid #dc2626' : `1px solid ${borderColor}`,
          fontWeight: depth === 0 ? 700 : 400,
          marginBottom: 2,
        }}
      >
        {node.isEnd && <span style={{ color: '#fca5a5', marginRight: 4 }}>END</span>}
        {node.label}
      </div>
      {node.children && (
        <div style={{ borderLeft: '2px solid #93c5fd', marginLeft: 8, paddingLeft: 8, marginTop: 4 }}>
          {node.children.map((child, i) => (
            <MenuTreeNode key={i} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function UssdMenuPreview() {
  return (
    <div style={{ padding: 16, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 12 }}>
        USSD Menu Tree — *123# Newlands Clinic
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 14, height: 14, borderRadius: 3, background: '#1e40af' }} />
          <span>Root</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 14, height: 14, borderRadius: 3, background: '#3b82f6' }} />
          <span>Level 1 option</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 14, height: 14, borderRadius: 3, background: '#93c5fd' }} />
          <span>Level 2</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 14, height: 14, borderRadius: 3, border: '2px solid #dc2626', background: '#fff' }} />
          <span style={{ color: '#dc2626' }}>Session ends (END)</span>
        </div>
      </div>
      {MENU_TREE.map((node, i) => (
        <MenuTreeNode key={i} node={node} depth={0} />
      ))}
    </div>
  );
}
